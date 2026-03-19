const Appointment = require('../Model/Appointment');
const AvailabilityBlock = require('../Model/AvailabilityBlock');
const User = require('../Model/User');
const bcrypt = require('bcryptjs');
const { sendBookingConfirmation, sendCancellationConfirmation } = require('../middleware/emailService');

function combineDateAndTime(dateObj, timeString) {
    const raw = String(timeString || '').trim();
    const twelveHourMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

    let hours = 0;
    let minutes = 0;

    if (twelveHourMatch) {
        hours = Number(twelveHourMatch[1]);
        minutes = Number(twelveHourMatch[2]);
        const meridiem = twelveHourMatch[3].toUpperCase();

        if (hours === 12) {
            hours = 0;
        }
        if (meridiem === 'PM') {
            hours += 12;
        }
    } else {
        const [parsedHours, parsedMinutes] = (raw || '00:00').split(':').map(Number);
        hours = Number.isFinite(parsedHours) ? parsedHours : 0;
        minutes = Number.isFinite(parsedMinutes) ? parsedMinutes : 0;
    }

    const combined = new Date(dateObj);
    combined.setHours(hours || 0, minutes || 0, 0, 0);
    return combined;
}

function getDateKey(dateObj) {
    const clone = new Date(dateObj);
    clone.setHours(0, 0, 0, 0);
    return clone.toISOString().slice(0, 10);
}

async function authenticateOrCreateStudent(studentEmail, studentPassword) {
    const normalizedEmail = (studentEmail || '').toLowerCase().trim();
    const trimmedPassword = (studentPassword || '').trim();

    if (!normalizedEmail || !trimmedPassword) {
        return { error: 'Please provide both email and password.' };
    }

    if (trimmedPassword.length < 6) {
        return { error: 'Password must be at least 6 characters.' };
    }

    let student = await User.findOne({ email: normalizedEmail });
    if (student && student.role !== 'student') {
        return { error: 'That email belongs to a non-student account.' };
    }

    if (student && !student.active) {
        return { error: 'This student account is inactive. Please contact an admin.' };
    }

    if (student) {
        const isMatch = await bcrypt.compare(trimmedPassword, student.passwordHash);
        if (!isMatch) {
            return { error: 'Invalid email/password for this student account.' };
        }
        return { student };
    }

    const passwordHash = await bcrypt.hash(trimmedPassword, 12);
    const fallbackName = normalizedEmail.split('@')[0] || 'Student';
    student = await User.create({
        role: 'student',
        name: fallbackName,
        email: normalizedEmail,
        passwordHash,
        active: true
    });

    return { student };
}

async function createAppointmentForSlot({ tutorId, course, start, end, student }) {
    const tutor = await User.findOne({ _id: tutorId, role: 'tutor', active: true }).select('_id');
    if (!tutor) {
        return { errorCode: 'invalid_tutor' };
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
        return { errorCode: 'booking_failed' };
    }

    const overlap = await Appointment.findOne({
        tutor: tutor._id,
        status: 'booked',
        start: { $lt: endDate },
        end: { $gt: startDate }
    }).select('_id');

    if (overlap) {
        return { errorCode: 'slot_taken' };
    }

    const appointment = await Appointment.create({
        student: student._id,
        tutor: tutor._id,
        course: (course || 'IT 330').trim() || 'IT 330',
        start: startDate,
        end: endDate,
        status: 'booked'
    });
    
    const tutorUser = await User.findById(tutor._id).select('name');
    sendBookingConfirmation({
        studentEmail: student.email,
        studentName: student.name,
        tutorName: tutorUser ? tutorUser.name : 'Your Tutor',
        course: appointment.course,
        start: appointment.start,
        end: appointment.end
    }).catch(err => console.error('Booking email error:', err));
    
    return { ok: true };
}

exports.showLogin = (req, res) => {
    const pendingBooking = {
        tutorId: req.query.tutorId || '',
        tutorName: req.query.tutorName || '',
        course: req.query.course || '',
        start: req.query.start || '',
        end: req.query.end || ''
    };

    const hasPendingBooking = Boolean(
        pendingBooking.tutorId && pendingBooking.course && pendingBooking.start && pendingBooking.end
    );

    res.render('Student/studentLoginPage', {
        error: null,
        pendingBooking,
        hasPendingBooking
    });
};

exports.showHome = async (req, res) => {
    try {
        const now = new Date();
        const horizonDays = 14;
        const horizonEnd = new Date(now);
        horizonEnd.setDate(horizonEnd.getDate() + horizonDays);

        const tutors = await User.find({ role: 'tutor', active: true }).select('_id name email');
        const tutorMap = new Map(tutors.map((tutor) => [String(tutor._id), tutor]));

        const blocks = await AvailabilityBlock.find({ tutor: { $in: tutors.map((t) => t._id) } })
            .sort({ createdAt: -1 });

        const bookedAppointments = await Appointment.find({
            status: 'booked',
            start: { $lt: horizonEnd },
            end: { $gt: now }
        }).select('tutor start end');

        const slotCandidates = [];
        for (let dayOffset = 0; dayOffset < horizonDays; dayOffset += 1) {
            const day = new Date(now);
            day.setHours(0, 0, 0, 0);
            day.setDate(day.getDate() + dayOffset);

            blocks.forEach((block) => {
                const tutor = tutorMap.get(String(block.tutor));
                if (!tutor || block.isBlackoutDate) {
                    return;
                }

                let appliesToDay = false;
                if (block.isException) {
                    if (block.date) {
                        appliesToDay = getDateKey(block.date) === getDateKey(day);
                    }
                } else if (block.dayOfWeek === day.getDay()) {
                    appliesToDay = true;
                }

                if (!appliesToDay) {
                    return;
                }

                const slotStart = combineDateAndTime(day, block.startTime);
                const slotEnd = combineDateAndTime(day, block.endTime);
                if (slotStart <= now || slotEnd <= slotStart) {
                    return;
                }

                slotCandidates.push({
                    tutorId: String(tutor._id),
                    tutorName: tutor.name,
                    tutorEmail: tutor.email,
                    course: block.course || 'IT 330',
                    start: slotStart,
                    end: slotEnd
                });
            });
        }

        const availableSlots = slotCandidates.filter((slot) => {
            return !bookedAppointments.some((appt) => {
                if (String(appt.tutor) !== slot.tutorId) {
                    return false;
                }
                return slot.start < appt.end && appt.start < slot.end;
            });
        });

        availableSlots.sort((a, b) => a.start - b.start);

        const viewSlots = availableSlots.slice(0, 40).map((slot) => ({
            ...slot,
            startIso: slot.start.toISOString(),
            endIso: slot.end.toISOString()
        }));

        const notice = req.query.booked === '1'
            ? 'Appointment booked successfully.'
            : req.query.error === 'slot_taken'
                ? 'That appointment slot was just taken. Please choose another.'
                : req.query.error === 'missing_fields'
                    ? 'Please fill out all booking fields.'
                    : req.query.error === 'invalid_tutor'
                        ? 'Selected tutor could not be found.'
                            : req.query.error === 'invalid_role'
                                ? 'That email belongs to a non-student account. Use another email.'
                            : req.query.error === 'booking_failed'
                                ? 'Booking failed. Please try again.'
                                : null;

        return res.render('Home/home', {
            availableSlots: viewSlots,
            notice,
            noticeType: req.query.booked === '1' ? 'success' : 'error'
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Unable to load home page appointment availability.');
    }
};

exports.submitLogin = async (req, res) => {
    try {
        const { studentEmail, studentPassword, tutorId, tutorName, course, start, end } = req.body;

        const hasPendingBooking = Boolean(tutorId && course && start && end);

        const authResult = await authenticateOrCreateStudent(studentEmail, studentPassword);
        if (authResult.error) {
            return res.status(401).render('Student/studentLoginPage', {
                error: authResult.error,
                hasPendingBooking,
                pendingBooking: {
                    tutorId: tutorId || '',
                    tutorName: tutorName || '',
                    course: course || '',
                    start: start || '',
                    end: end || ''
                }
            });
        }

        const jwt = require('jsonwebtoken');
    const token = jwt.sign(
    { id: authResult.student._id, email: authResult.student.email, role: 'student' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
            );
            res.setHeader('Set-Cookie', `auth_token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`);

            if (!hasPendingBooking) {
                return res.redirect('/studentDashboard');
            }

        const bookingResult = await createAppointmentForSlot({
            tutorId,
            course,
            start,
            end,
            student: authResult.student
        });

        if (bookingResult.errorCode) {
            return res.redirect(`/studentDashboard?error=${bookingResult.errorCode}`);
        }

        return res.redirect('/studentDashboard?booked=1');
    } catch (error) {
        console.error(error);
        return res.status(500).render('Student/studentLoginPage', {
            error: 'Login or booking failed. Please try again.',
            hasPendingBooking: false,
            pendingBooking: {
                tutorId: '',
                tutorName: '',
                course: '',
                start: '',
                end: ''
            }
        });
    }

};

exports.showDashboard = async (req, res) => {
    try {
        const student = await User.findById(req.user.id).select('name email');
        if (!student) return res.redirect('/studentLogin');

        const appointments = await Appointment.find({ student: student._id })
            .populate('tutor', 'name email')
            .sort({ start: -1 });

        const now = new Date();
        const horizonDays = 14;
        const horizonEnd = new Date(now);
        horizonEnd.setDate(horizonEnd.getDate() + horizonDays);

        const tutors = await User.find({ role: 'tutor', active: true }).select('_id name email');
        const tutorMap = new Map(tutors.map(t => [String(t._id), t]));

        const blocks = await AvailabilityBlock.find({ tutor: { $in: tutors.map(t => t._id) } })
            .sort({ createdAt: -1 });

        const bookedAppointments = await Appointment.find({
            status: 'booked',
            start: { $lt: horizonEnd },
            end: { $gt: now }
        }).select('tutor start end');

        const slotCandidates = [];
        for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
            const day = new Date(now);
            day.setHours(0, 0, 0, 0);
            day.setDate(day.getDate() + dayOffset);

            blocks.forEach(block => {
                const tutor = tutorMap.get(String(block.tutor));
                if (!tutor || block.isBlackoutDate) return;

                let appliesToDay = false;
                if (block.isException) {
                    if (block.date) appliesToDay = getDateKey(block.date) === getDateKey(day);
                } else if (block.dayOfWeek === day.getDay()) {
                    appliesToDay = true;
                }

                if (!appliesToDay) return;

                const slotStart = combineDateAndTime(day, block.startTime);
                const slotEnd = combineDateAndTime(day, block.endTime);
                if (slotStart <= now || slotEnd <= slotStart) return;

                slotCandidates.push({
                    tutorId: String(tutor._id),
                    tutorName: tutor.name,
                    tutorEmail: tutor.email,
                    course: block.course || 'IT 330',
                    start: slotStart,
                    end: slotEnd,
                    startIso: slotStart.toISOString(),
                    endIso: slotEnd.toISOString()
                });
            });
        }

        const availableSlots = slotCandidates.filter(slot =>
            !bookedAppointments.some(appt =>
                String(appt.tutor) === slot.tutorId &&
                slot.start < appt.end && appt.start < slot.end
            )
        ).sort((a, b) => a.start - b.start).slice(0, 40);

        const notice = req.query.booked === '1'
            ? 'Appointment booked successfully!'
            : req.query.cancelled === '1'
                ? 'Appointment cancelled successfully.'
                : req.query.error === 'slot_taken'
                    ? 'That slot was just taken. Please choose another.'
                    : req.query.error === 'already_cancelled'
                        ? 'That appointment is already cancelled.'
                        : null;

        const noticeType = req.query.booked === '1' ? 'success' :
                           req.query.cancelled === '1' ? 'warning' : 'error';

        return res.render('Student/dashboard', {
            student,
            appointments,
            availableSlots,
            notice,
            noticeType
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error loading student dashboard.');
    }
};

exports.cancelAppointment = async (req, res) => {
    try {
        const student = await User.findById(req.user.id).select('name email');
        if (!student) return res.redirect('/studentLogin');

        const appointment = await Appointment.findOne({
            _id: req.params.id,
            student: student._id,
            status: 'booked'
        }).populate('tutor', 'name');

        if (!appointment) {
            return res.redirect('/studentDashboard?error=already_cancelled');
        }

        appointment.status = 'cancelled';
        await appointment.save();

        sendCancellationConfirmation({
            studentEmail: student.email,
            studentName: student.name,
            tutorName: appointment.tutor ? appointment.tutor.name : 'Your Tutor',
            course: appointment.course,
            start: appointment.start,
            end: appointment.end
        }).catch(err => console.error('Cancellation email error:', err));

        return res.redirect('/studentDashboard?cancelled=1');
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error cancelling appointment.');
    }
};

exports.bookAppointment = async (req, res) => {
    try {
        const student = await User.findById(req.user.id).select('name email');
        if (!student) return res.redirect('/studentLogin');

        const { tutorId, course, start, end } = req.body;
        if (!tutorId || !course || !start || !end) {
            return res.redirect('/studentDashboard?error=missing_fields');
        }

        const bookingResult = await createAppointmentForSlot({ tutorId, course, start, end, student });

        if (bookingResult.errorCode) {
            return res.redirect(`/studentDashboard?error=${bookingResult.errorCode}`);
        }

        return res.redirect('/studentDashboard?booked=1');
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error booking appointment.');
    }
};
