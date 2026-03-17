const Appointment = require('../Model/Appointment');
const AvailabilityBlock = require('../Model/AvailabilityBlock');
const User = require('../Model/User');
const bcrypt = require('bcryptjs');

function combineDateAndTime(dateObj, timeString) {
    const [hours, minutes] = (timeString || '00:00').split(':').map(Number);
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

    await Appointment.create({
        student: student._id,
        tutor: tutor._id,
        course: (course || 'IT 330').trim() || 'IT 330',
        start: startDate,
        end: endDate,
        status: 'booked'
    });

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

        if (!hasPendingBooking) {
            return res.redirect('/home');
        }

        const bookingResult = await createAppointmentForSlot({
            tutorId,
            course,
            start,
            end,
            student: authResult.student
        });

        if (bookingResult.errorCode) {
            return res.redirect(`/home?error=${bookingResult.errorCode}#appointments`);
        }

        return res.redirect('/home?booked=1#appointments');
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
