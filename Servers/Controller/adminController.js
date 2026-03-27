const Appointment = require('../Model/Appointment');
const AvailabilityBlock = require('../Model/AvailabilityBlock');
const AuditLog = require('../Model/AuditLog');
const NotificationLog = require('../Model/NotificationLog');
const User = require('../Model/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendCancellationConfirmation } = require('../middleware/emailService');

function formatDateTime(value) {
    if (!value) {
        return 'N/A';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return 'N/A';
    }

    return parsed.toLocaleString('en-US', { hour12: true });
}

function formatAvailabilityLabel(block) {
    if (!block) {
        return 'Unknown availability block';
    }

    const tutorName = block.tutor && block.tutor.name ? block.tutor.name : (block.tutorName || 'Unknown tutor');
    const dayOrDate = block.isException && block.date
        ? new Date(block.date).toLocaleDateString('en-US')
        : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][block.dayOfWeek] || 'Unscheduled';

    return `${tutorName} - ${block.course || 'IT 330'} - ${dayOrDate} ${block.startTime || ''} to ${block.endTime || ''}`.trim();
}

function formatAppointmentLabel(appointment) {
    if (!appointment) {
        return 'Unknown appointment';
    }

    const studentName = appointment.student && appointment.student.name ? appointment.student.name : 'Unknown student';
    const tutorName = appointment.tutor && appointment.tutor.name ? appointment.tutor.name : 'Unknown tutor';
    return `${studentName} with ${tutorName} for ${appointment.course || 'IT 330'} on ${formatDateTime(appointment.start)}`;
}

function summarizeAuditLog(log, targetLabel) {
    const metadata = log.metadata || {};

    switch (log.action) {
    case 'book':
        return `Booked ${targetLabel}`;
    case 'cancel':
        return `Cancelled ${targetLabel}`;
    case 'edit':
        return `Updated appointment window to ${formatDateTime(metadata.newStart)} - ${formatDateTime(metadata.newEnd)}`;
    case 'activate':
        return `Activated ${targetLabel}`;
    case 'deactivate':
        return `Deactivated ${targetLabel}`;
    case 'createUser':
        return `Created user ${metadata.userName || targetLabel}`;
    case 'addAvailability':
        return `Added availability for ${metadata.tutorName || targetLabel}`;
    case 'deleteAvailability':
        return `Deleted availability for ${metadata.tutorName || targetLabel}`;
    case 'updateSession':
        if (metadata.attendance === 'show') {
            return `Marked session completed${metadata.hasComment ? ' and added notes' : ''}`;
        }
        if (metadata.attendance === 'noshow') {
            return `Marked student as no-show${metadata.hasComment ? ' and added notes' : ''}`;
        }
        return metadata.hasComment ? 'Added session notes' : 'Updated tutoring session';
    default:
        return metadata.summary || targetLabel || String(log.targetId || 'Unknown target');
    }
}

function summarizeNotificationLog(log) {
    const details = log.providerResponse || {};
    const studentName = details.studentName || 'Unknown student';
    const tutorName = details.tutorName || 'Unknown tutor';
    const course = details.course || 'IT 330';
    const actionMap = {
        book: 'Booking confirmation',
        cancel: 'Cancellation notice',
        reminder: 'Reminder notice',
        other: 'Notification'
    };
    return details.summary || `${actionMap[log.event] || 'Notification'} for ${studentName} and ${tutorName} (${course})`;
}

async function buildAuditLogEntries(rawLogs) {
    const appointmentIds = [];
    const userIds = [];
    const availabilityIds = [];

    rawLogs.forEach((log) => {
        if (log.targetType === 'Appointment') appointmentIds.push(log.targetId);
        if (log.targetType === 'User') userIds.push(log.targetId);
        if (log.targetType === 'AvailabilityBlock') availabilityIds.push(log.targetId);
    });

    const [appointments, users, availabilityBlocks] = await Promise.all([
        appointmentIds.length
            ? Appointment.find({ _id: { $in: appointmentIds } })
                .populate('student', 'name email')
                .populate('tutor', 'name email')
            : [],
        userIds.length
            ? User.find({ _id: { $in: userIds } }).select('name email role active')
            : [],
        availabilityIds.length
            ? AvailabilityBlock.find({ _id: { $in: availabilityIds } })
                .populate('tutor', 'name email')
            : []
    ]);

    const appointmentMap = new Map(appointments.map((item) => [String(item._id), item]));
    const userMap = new Map(users.map((item) => [String(item._id), item]));
    const availabilityMap = new Map(availabilityBlocks.map((item) => [String(item._id), item]));

    return rawLogs.map((log) => {
        let targetLabel = 'Unknown target';

        if (log.targetType === 'Appointment') {
            targetLabel = formatAppointmentLabel(appointmentMap.get(String(log.targetId)));
        } else if (log.targetType === 'User') {
            const user = userMap.get(String(log.targetId));
            targetLabel = user ? `${user.name} (${user.role})` : (log.metadata.userName || 'Unknown user');
        } else if (log.targetType === 'AvailabilityBlock') {
            targetLabel = formatAvailabilityLabel(availabilityMap.get(String(log.targetId)));
        }

        return {
            ...log.toObject(),
            actorDisplayName: log.actor && log.actor.name ? `${log.actor.name} (${log.actor.role})` : 'Unknown user',
            targetLabel,
            summary: summarizeAuditLog(log, targetLabel)
        };
    });
}

function parseTimeToMinutes(timeValue) {
    const raw = String(timeValue || '').trim();
    if (!raw) {
        return null;
    }

    const twelveHourMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (twelveHourMatch) {
        let hours = Number(twelveHourMatch[1]);
        const minutes = Number(twelveHourMatch[2]);
        const meridiem = twelveHourMatch[3].toUpperCase();

        if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
            return null;
        }

        if (hours === 12) {
            hours = 0;
        }
        if (meridiem === 'PM') {
            hours += 12;
        }

        return hours * 60 + minutes;
    }

    const twentyFourHourMatch = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!twentyFourHourMatch) {
        return null;
    }

    const hours = Number(twentyFourHourMatch[1]);
    const minutes = Number(twentyFourHourMatch[2]);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
    }

    return hours * 60 + minutes;
}

function formatMinutesTo12Hour(totalMinutes) {
    const hours24 = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const meridiem = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = ((hours24 + 11) % 12) + 1;
    return `${hours12}:${String(minutes).padStart(2, '0')} ${meridiem}`;
}

exports.showLogin = (req, res) => {
    res.render('Admin/login', { error: null });
};

exports.submitLogin = async (req, res) => {
    try {
        const email = (req.body.adminEmail || '').toLowerCase().trim();
        const password = req.body.adminPassword || '';

        const admin = await User.findOne({ email, role: 'admin', active: true });
        if (!admin) {
            return res.status(401).render('Admin/login', { error: 'Invalid admin credentials.' });
        }

        const isMatch = await bcrypt.compare(password, admin.passwordHash);
        if (!isMatch) {
            return res.status(401).render('Admin/login', { error: 'Invalid admin credentials.' });
        }

        const token = jwt.sign(
              { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.setHeader('Set-Cookie', `auth_token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`);
        return res.redirect('/adminDashboard');
    } catch (err) {
        console.error(err);
        return res.status(500).render('Admin/login', { error: 'Admin login failed.' });
    }
};

exports.showDashboard = async (req, res) => {
    try {
        const appointments = await Appointment.find()
            .populate('student', 'name email')
            .populate('tutor', 'name email')
            .sort({ start: -1 });

        const users = await User.find({ role: { $in: ['student', 'tutor'] } })
            .sort({ role: 1, name: 1 });

        const tutors = await User.find({ role: 'tutor', active: true })
            .sort({ name: 1 });

        const availabilityBlocks = await AvailabilityBlock.find()
            .populate('tutor', 'name email')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        const rawAuditLogs = await AuditLog.find()
            .populate('actor', 'name email role')
            .sort({ createdAt: -1 })
            .limit(25);

        const notificationLogs = await NotificationLog.find()
            .sort({ createdAt: -1 })
            .limit(25);

        const auditLogs = await buildAuditLogEntries(rawAuditLogs);

        const validTabs = ['appointments', 'hours', 'users', 'logs'];
        const activeTab = validTabs.includes(req.query.tab) ? req.query.tab : 'appointments';
        const validNoticeTypes = ['success', 'warning', 'danger'];
        const notice = typeof req.query.notice === 'string' ? req.query.notice : null;
        const noticeType = validNoticeTypes.includes(req.query.noticeType) ? req.query.noticeType : 'success';

        res.render('Admin/dashboard', {
            appointments,
            users,
            tutors,
            availabilityBlocks,
            auditLogs,
            notificationLogs: notificationLogs.map((log) => ({
                ...log.toObject(),
                recipientDisplayName: log.recipientName || log.recipient,
                summary: summarizeNotificationLog(log)
            })),
            activeTab,
            notice,
            noticeType,
            currentUser: req.user || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading dashboard');
    }
 };

exports.editAppointment = async (req, res) => {
    try {
        const { start, end } = req.body;
        if (!start || !end) return res.status(400).send('Start and end are required.');
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate) || isNaN(endDate)) return res.status(400).send('Invalid date/time values.');
        if (endDate <= startDate) return res.status(400).send('End time must be after start time.');

        const updatedAppointment = await Appointment.findByIdAndUpdate(
            req.params.id,
            { start: startDate, end: endDate },
            { new: true }
        )
            .populate('student', 'name email')
            .populate('tutor', 'name email');

        await AuditLog.create({
            actor: req.user.id,
            action: 'edit',
                actorName: req.user.name || req.user.email || 'Admin',
            targetType: 'Appointment',
            targetId: req.params.id,
            metadata: {
                editedBy: 'admin',
                newStart: startDate,
                newEnd: endDate,
                studentName: updatedAppointment && updatedAppointment.student ? updatedAppointment.student.name : null,
                tutorName: updatedAppointment && updatedAppointment.tutor ? updatedAppointment.tutor.name : null,
                course: updatedAppointment ? updatedAppointment.course : null
            }
        });

        const studentName = updatedAppointment && updatedAppointment.student ? updatedAppointment.student.name : 'Student';
        const tutorName = updatedAppointment && updatedAppointment.tutor ? updatedAppointment.tutor.name : 'Tutor';
        const noticeMsg = `Rescheduled ${studentName} with ${tutorName}.`;
        res.redirect(`/adminDashboard?tab=appointments&noticeType=success&notice=${encodeURIComponent(noticeMsg)}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error editing appointment');
    }
};

 exports.cancelAppointment = async (req, res) => {
    try {
        const appointment = await Appointment.findByIdAndUpdate(
            req.params.id,
            { status: 'cancelled' },
            { new: true }
        ).populate('student', 'name email').populate('tutor', 'name email');
        if (!appointment) {
            return res.status(404).send('Appointment not found.');
        }

        if (appointment.student && appointment.student.email) {
            sendCancellationConfirmation({
                studentEmail: appointment.student.email,
                studentName: appointment.student.name || 'Student',
                tutorName: appointment.tutor ? appointment.tutor.name : 'Tutor',
                course: appointment.course,
                start: appointment.start,
                end: appointment.end,
                appointmentId: appointment._id
            }).catch((error) => console.error('Cancellation email error:', error));
        }

        await AuditLog.create({
            actor: req.user.id,
            action: 'cancel',
                actorName: req.user.name || req.user.email || 'Admin',
            targetType: 'Appointment',
            targetId: appointment._id,
            metadata: {
                cancelledBy: 'admin',
                studentEmail: appointment.student ? appointment.student.email : null,
                tutorEmail: appointment.tutor ? appointment.tutor.email : null,
                studentName: appointment.student ? appointment.student.name : null,
                tutorName: appointment.tutor ? appointment.tutor.name : null,
                course: appointment.course
            }
        });
        const studentName = appointment.student ? appointment.student.name : 'Student';
        const tutorName = appointment.tutor ? appointment.tutor.name : 'Tutor';
        const noticeMsg = `Cancelled ${studentName}'s appointment with ${tutorName}.`;
        res.redirect(`/adminDashboard?tab=appointments&noticeType=warning&notice=${encodeURIComponent(noticeMsg)}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error cancelling appointment');
    }
};

exports.addUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const normalizedEmail = String(email || '').toLowerCase().trim();
        const normalizedName = String(name || '').trim();

        if (!normalizedName || !normalizedEmail || !password || !role) {
            return res.redirect('/adminDashboard?tab=users&noticeType=danger&notice=All%20user%20fields%20are%20required.');
        }

        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) {
            return res.redirect('/adminDashboard?tab=users&noticeType=warning&notice=User%20with%20that%20email%20already%20exists.');
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const createdUser = await User.create({ name: normalizedName, email: normalizedEmail, role, passwordHash, active: true });
        await AuditLog.create({
            actor: req.user.id,
            action: 'createUser',
                actorName: req.user.name || req.user.email || 'Admin',
            targetType: 'User',
            targetId: createdUser._id,
            metadata: {
                userName: createdUser.name,
                userEmail: createdUser.email,
                userRole: createdUser.role
            }
        });
        res.redirect(`/adminDashboard?tab=users&noticeType=success&notice=${encodeURIComponent(`Added ${createdUser.name} as ${createdUser.role}.`)}`);
    } catch (err) {
        console.error(err);
        res.redirect('/adminDashboard?tab=users&noticeType=danger&notice=Error%20adding%20user.');
    }
};

exports.toggleUserActive = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        user.active = !user.active;
        await user.save();
        await AuditLog.create({
            actor: req.user.id,
            action: user.active ? 'activate' : 'deactivate',
                actorName: req.user.name || req.user.email || 'Admin',
            targetType: 'User',
            targetId: user._id,
            metadata: { updatedBy: 'admin', userName: user.name, userEmail: user.email, userRole: user.role }
        });
        res.redirect(`/adminDashboard?tab=users&noticeType=success&notice=${encodeURIComponent(`${user.name} is now ${user.active ? 'active' : 'inactive'}.`)}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating user');
    }
};

exports.addAvailability = async (req, res) => {
    try {
        const { tutorId, course, blockType, dayOfWeek, date, startTime, endTime, isBlackoutDate } = req.body;

        if (!tutorId || !startTime || !endTime) {
            return res.status(400).send('Tutor, start time, and end time are required.');
        }

        const startMinutes = parseTimeToMinutes(startTime);
        const endMinutes = parseTimeToMinutes(endTime);
        if (startMinutes === null || endMinutes === null) {
            return res.status(400).send('Invalid time format.');
        }
        if (startMinutes >= endMinutes) {
            return res.status(400).send('End time must be after start time.');
        }

        const normalizedStartTime = formatMinutesTo12Hour(startMinutes);
        const normalizedEndTime = formatMinutesTo12Hour(endMinutes);

        const tutor = await User.findOne({ _id: tutorId, role: 'tutor' });
        if (!tutor) {
            return res.status(404).send('Tutor not found.');
        }

        // Infer block type from submitted fields so admins are not blocked by UI mismatch.
        let normalizedBlockType = blockType === 'date' ? 'date' : 'weekly';
        const hasDate = Boolean(date);
        const hasDayOfWeek = dayOfWeek !== undefined && dayOfWeek !== '';

        if (normalizedBlockType === 'weekly' && !hasDayOfWeek && hasDate) {
            normalizedBlockType = 'date';
        }
        if (normalizedBlockType === 'date' && !hasDate && hasDayOfWeek) {
            normalizedBlockType = 'weekly';
        }

        const blockPayload = {
            tutor: tutor._id,
            tutorName: tutor.name,
            createdBy: req.user.id,
            course: (course || 'IT 330').trim(),
            startTime: normalizedStartTime,
            endTime: normalizedEndTime,
            isException: normalizedBlockType === 'date',
            isBlackoutDate: isBlackoutDate === 'on'
        };

        if (normalizedBlockType === 'date') {
            if (!date) {
                return res.status(400).send('Date is required for date-specific blocks.');
            }
            blockPayload.date = new Date(date);
        } else {
            if (dayOfWeek === undefined || dayOfWeek === '') {
                return res.status(400).send('Day of week is required for weekly blocks.');
            }
            blockPayload.dayOfWeek = Number(dayOfWeek);
        }

        const createdBlock = await AvailabilityBlock.create(blockPayload);

        await AuditLog.create({
            actor: req.user.id,
            action: 'addAvailability',
                actorName: req.user.name || req.user.email || 'Admin',
            targetType: 'AvailabilityBlock',
            targetId: createdBlock._id,
            metadata: {
                tutorName: tutor.name,
                course: createdBlock.course,
                blockType: createdBlock.isException ? 'date-specific' : 'weekly'
            }
        });

        return res.redirect(`/adminDashboard?tab=hours&noticeType=success&notice=${encodeURIComponent(`Added availability for ${tutor.name}.`)}`);
    } catch (err) {
        console.error(err);
        return res.status(500).send('Error adding availability block');
    }
};

exports.deleteAvailability = async (req, res) => {
    try {
        const block = await AvailabilityBlock.findById(req.params.id).populate('tutor', 'name');
        if (!block) {
            return res.redirect('/adminDashboard?tab=hours&noticeType=warning&notice=Availability%20block%20not%20found.');
        }

        await AvailabilityBlock.findByIdAndDelete(req.params.id);

        await AuditLog.create({
            actor: req.user.id,
            action: 'deleteAvailability',
                actorName: req.user.name || req.user.email || 'Admin',
            targetType: 'AvailabilityBlock',
            targetId: block._id,
            metadata: {
                tutorName: block.tutor && block.tutor.name ? block.tutor.name : block.tutorName,
                course: block.course,
                blockType: block.isException ? 'date-specific' : 'weekly'
            }
        });

        const tutorName = block.tutor && block.tutor.name ? block.tutor.name : block.tutorName;
        return res.redirect(`/adminDashboard?tab=hours&noticeType=warning&notice=${encodeURIComponent(`Deleted availability for ${tutorName}.`)}`);
    } catch (err) {
        console.error(err);
        return res.status(500).send('Error deleting availability block');
    }
};