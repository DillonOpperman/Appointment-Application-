const Appointment = require('../Model/Appointment');
const AvailabilityBlock = require('../Model/AvailabilityBlock');
const AuditLog = require('../Model/AuditLog');
const User = require('../Model/User');
const CenterHours = require('../Model/CenterHours');
const bcrypt = require('bcryptjs');
const { sendBookingConfirmation, sendCancellationConfirmation } = require('../middleware/emailService');
const { deleteEventFromCalendar, deleteMatchingEventsFromCalendar } = require('../middleware/googleCalendar');

const MAX_LOGIN_ATTEMPTS = 5;

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

function parseTimeToMinutes(timeValue) {
    const raw = String(timeValue || '').trim();
    if (!raw) return null;
    const twelveHourMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (twelveHourMatch) {
        let hours = Number(twelveHourMatch[1]);
        const minutes = Number(twelveHourMatch[2]);
        const meridiem = twelveHourMatch[3].toUpperCase();
        if (hours === 12) hours = 0;
        if (meridiem === 'PM') hours += 12;
        return hours * 60 + minutes;
    }
    const twentyFourHourMatch = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!twentyFourHourMatch) return null;
    const hours = Number(twentyFourHourMatch[1]);
    const minutes = Number(twentyFourHourMatch[2]);
    return hours * 60 + minutes;
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

    const student = await User.findOne({ email: normalizedEmail });

    if (!student) {
        return { error: 'No account found for this email. Please contact an admin to create your account.' };
    }

    if (student.role !== 'student') {
        return { error: 'That email belongs to a non-student account.' };
    }

    if (student.lockedOut) {
        return { error: 'Account locked due to too many failed login attempts. Please contact the Admin.' };
    }

    if (!student.active) {
        return { error: 'This student account is inactive. Please contact an admin.' };
    }

    const isMatch = await bcrypt.compare(trimmedPassword, student.passwordHash);
    if (!isMatch) {
        student.loginAttempts = (student.loginAttempts || 0) + 1;
        if (student.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
            student.active = false;
            student.lockedOut = true;
            await student.save();
            await AuditLog.create({
                actor: student._id,
                actorName: student.name || student.email,
                action: 'lockout',
                targetType: 'User',
                targetId: student._id,
                metadata: { reason: 'Too many failed login attempts', email: student.email, role: 'student' }
            });
            return { error: 'Account locked due to too many failed login attempts. Please contact the Admin.' };
        }
        await student.save();
        return { error: 'Invalid email/password for this student account.' };
    }

    // Successful login — reset attempts
    student.loginAttempts = 0;
    await student.save();
    return { student };
}

async function createAppointmentForSlot({ tutorId, course, start, end, student }) {
    const tutor = await User.findOne({ _id: tutorId, role: 'tutor', active: true }).select('_id name email');
    if (!tutor) {
        return { errorCode: 'invalid_tutor' };
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
        return { errorCode: 'booking_failed' };
    }

    // Validate that the requested time falls within an availability block for this tutor
    const dayOfWeek = startDate.getDay();
    const dateKey = getDateKey(startDate);
    const requestedStart = startDate.getHours() * 60 + startDate.getMinutes();
    const requestedEnd = endDate.getHours() * 60 + endDate.getMinutes();

    const blocks = await AvailabilityBlock.find({ tutor: tutor._id, isBlackoutDate: { $ne: true } });
    const withinBlock = blocks.some(block => {
        let appliesToDay = false;
        if (block.isException && block.date) {
            appliesToDay = getDateKey(block.date) === dateKey;
        } else if (!block.isException && block.dayOfWeek === dayOfWeek) {
            appliesToDay = true;
        }
        if (!appliesToDay) return false;
        const blockStart = parseTimeToMinutes(block.startTime);
        const blockEnd = parseTimeToMinutes(block.endTime);
        if (blockStart === null || blockEnd === null) return false;
        return requestedStart >= blockStart && requestedEnd <= blockEnd;
    });

    if (!withinBlock) {
        return { errorCode: 'outside_availability' };
    }

    // Validate booking falls within center hours
    const chDoc = await CenterHours.findOne() || await CenterHours.create({});
    const DAY_KEYS_B = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const centerDay = chDoc[DAY_KEYS_B[startDate.getDay()]];
    if (!centerDay || !centerDay.open || !centerDay.close) {
        return { errorCode: 'outside_availability' };
    }
    const centerOpen = parseTimeToMinutes(centerDay.open);
    const centerClose = parseTimeToMinutes(centerDay.close);
    if (requestedStart < centerOpen || requestedEnd > centerClose) {
        return { errorCode: 'outside_availability' };
    }
const tutorOverlap = await Appointment.findOne({
    tutor: tutor._id,
    status: 'booked',
    start: { $lt: endDate },
    end: { $gt: startDate }
}).select('_id');

if (tutorOverlap) {
    return { errorCode: 'slot_taken' };
}

// FIX ISSUE 5: Check student overlap — prevent double-booking with different tutors
const studentOverlap = await Appointment.findOne({
    student: student._id,
    status: 'booked',
    start: { $lt: endDate },
    end: { $gt: startDate }
}).select('_id');

if (studentOverlap) {
    return { errorCode: 'student_conflict' };
}


    const appointment = await Appointment.create({
        student: student._id,
        studentName: student.name || '',
        tutor: tutor._id,
        tutorName: tutor.name || '',
        course: (course || 'IT 330').trim() || 'IT 330',
        start: startDate,
        end: endDate,
        status: 'booked'
    });
    
    const tutorUser = tutor;
    sendBookingConfirmation({
        studentEmail: student.email,
        studentName: student.name,
        tutorEmail: tutorUser ? tutorUser.email : null,
        tutorName: tutorUser ? tutorUser.name : 'Your Tutor',
        course: appointment.course,
        start: appointment.start,
        end: appointment.end,
        appointmentId: appointment._id
    }).catch(err => console.error('Booking email error:', err));
    
    return { ok: true, appointment, tutorUser };
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
    res.render('Student/studentLoginPage', { error: null, pendingBooking, hasPendingBooking });
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
            tutorId, course, start, end, student: authResult.student
        });

        if (bookingResult.errorCode) {
            return res.redirect(`/studentDashboard?error=${bookingResult.errorCode}`);
        }

        await AuditLog.create({
            actor: authResult.student._id,
            action: 'book',
                actorName: authResult.student.name || '',
            targetType: 'Appointment',
            targetId: bookingResult.appointment._id,
            metadata: {
                studentName: authResult.student.name,
                tutorName: bookingResult.tutorUser ? bookingResult.tutorUser.name : null,
                course: bookingResult.appointment.course
            }
        });

        return res.redirect('/studentDashboard?booked=1');
    } catch (error) {
        console.error(error);
        return res.status(500).render('Student/studentLoginPage', {
            error: 'Login or booking failed. Please try again.',
            hasPendingBooking: false,
            pendingBooking: { tutorId: '', tutorName: '', course: '', start: '', end: '' }
        });
    }
};

exports.showHome = async (req, res) => {
    try {
        const centerHours = await CenterHours.findOne() || await CenterHours.create({});
        res.render('Home/home', { availableSlots: [], notice: null, noticeType: 'error', centerHours });
    } catch (err) {
        console.error(err);
        res.render('Home/home', { availableSlots: [], notice: null, noticeType: 'error', centerHours: null });
    }
};


exports.showDashboard = async (req, res) => {
    try {
        const student = await User.findById(req.user.id).select('name email googleRefreshToken googleAccountEmail enrolledCourses');
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

        // Load center hours for slot filtering
        const chDoc = await CenterHours.findOne() || await CenterHours.create({});
        const DAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

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

                // Filter slot against center hours — don't show slots outside open hours
                const dayKey = DAY_KEYS[day.getDay()];
                const centerDay = chDoc[dayKey];
                if (!centerDay || !centerDay.open || !centerDay.close) return; // center closed
                const centerOpen = parseTimeToMinutes(centerDay.open);
                const centerClose = parseTimeToMinutes(centerDay.close);
                const slotStartMins = slotStart.getHours() * 60 + slotStart.getMinutes();
                const slotEndMins = slotEnd.getHours() * 60 + slotEnd.getMinutes();
                if (slotStartMins < centerOpen || slotEndMins > centerClose) return;

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

        const enrolledCourses = student.enrolledCourses || [];
        const availableSlots = slotCandidates.filter(slot => {
            if (!bookedAppointments.some(appt =>
                String(appt.tutor) === slot.tutorId &&
                slot.start < appt.end && appt.start < slot.end
            )) {
                // Filter by enrolled courses if student has any set
                if (enrolledCourses.length > 0) {
                    return enrolledCourses.includes(slot.course);
                }
                return true;
            }
            return false;
        }).sort((a, b) => a.start - b.start).slice(0, 40);

        const notice = req.query.google_connected === '1'
            ? 'Google Calendar connected successfully.'
            : req.query.booked === '1'
            ? 'Appointment booked successfully!'
            : req.query.cancelled === '1'
                ? 'Appointment cancelled successfully.'
                : req.query.error === 'slot_taken'
                    ? 'That slot was just taken. Please choose another.'
                    : req.query.error === 'already_cancelled'
                        ? 'That appointment is already cancelled.'
                        : req.query.error === 'outside_availability'
                            ? 'That time is outside the tutor\'s available hours.'
                        : req.query.error === 'student_conflict'
                            ? 'You already have an appointment at that time. Please choose a different slot.'
                            : req.query.error === 'oauth_failed'
                                ? 'Google Calendar authorization failed. Please try again.'
                                : req.query.error === 'oauth_state_mismatch'
                                    ? 'Google Calendar authorization did not match the signed-in student.'
                            : null;

        const noticeType = req.query.google_connected === '1' ? 'success' :
                           req.query.booked === '1' ? 'success' :
                           req.query.cancelled === '1' ? 'warning' : 'error';

        const googleConnected = !!student.googleRefreshToken;

        return res.render('Student/dashboard', {
            student,
            appointments,
            availableSlots,
            notice,
            noticeType,
            googleConnected,
            googleAccountEmail: student.googleAccountEmail || null
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error loading student dashboard.');
    }
};

exports.cancelAppointment = async (req, res) => {
    try {
        const student = await User.findById(req.user.id).select('name email googleRefreshToken');
        if (!student) return res.redirect('/studentLogin');

        const appointment = await Appointment.findOne({
            _id: req.params.id,
            student: student._id,
            status: 'booked'
        }).populate('tutor', 'name email');

        if (!appointment) {
            return res.redirect('/studentDashboard?error=already_cancelled');
        }

        if (student.googleRefreshToken) {
            if (appointment.googleCalendarEventId) {
                const deleteResult = await deleteEventFromCalendar(student.googleRefreshToken, appointment.googleCalendarEventId);
                if (deleteResult.success) {
                    appointment.googleCalendarEventId = null;
                    appointment.googleCalendarSyncedAt = null;
                }
            } else {
                const fallbackSummary = `${appointment.course} with ${appointment.tutor ? appointment.tutor.name : 'Tutor'}`;
                const fallbackResult = await deleteMatchingEventsFromCalendar(student.googleRefreshToken, {
                    summary: fallbackSummary,
                    start: appointment.start,
                    end: appointment.end
                });

                if (fallbackResult.success && fallbackResult.deletedCount > 0) {
                    appointment.googleCalendarEventId = null;
                    appointment.googleCalendarSyncedAt = null;
                }
            }
        }

        appointment.status = 'cancelled';
        await appointment.save();


        sendCancellationConfirmation({
            studentEmail: student.email,
            studentName: student.name,
            tutorEmail: appointment.tutor ? appointment.tutor.email : null,
            tutorName: appointment.tutor ? appointment.tutor.name : 'Your Tutor',
            course: appointment.course,
            start: appointment.start,
            end: appointment.end,
            appointmentId: appointment._id
        }).catch(err => console.error('Cancellation email error:', err));

        await AuditLog.create({
            actor: student._id,
            action: 'cancel',
                actorName: student.name || '',
            targetType: 'Appointment',
            targetId: appointment._id,
            metadata: {
                cancelledBy: 'student',
                studentName: student.name,
                tutorName: appointment.tutor ? appointment.tutor.name : null,
                course: appointment.course
            }
        });

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

        await AuditLog.create({
            actor: student._id,
            action: 'book',
                actorName: student.name || '',
            targetType: 'Appointment',
            targetId: bookingResult.appointment._id,
            metadata: {
                studentName: student.name,
                tutorName: bookingResult.tutorUser ? bookingResult.tutorUser.name : null,
                course: bookingResult.appointment.course
            }
        });

        return res.redirect('/studentDashboard?booked=1');
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error booking appointment.');
    }
};
