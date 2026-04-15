const Appointment = require('../Model/Appointment');
const AvailabilityBlock = require('../Model/AvailabilityBlock');
const AuditLog = require('../Model/AuditLog');
const User = require('../Model/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const NotificationLog = require('../Model/NotificationLog');
const { sendCancellationConfirmation } = require('../middleware/emailService');

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
            { id: admin._id, email: admin.email, role: admin.role },
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
            .populate('actor', 'name email') 
            .sort({ createdAt: -1 })
            .limit(20);

            const auditLogs = rawAuditLogs.map(log => {
                const l = log.toObject();
                l.actorDisplayName = l.actorName || (log.actor && log.actor.name) || 'Unknown';
                l.targetLabel = l.targetType || '—';
                const m = l.metadata || {};
                if (m.studentName || m.tutorName || m.course) {
                    const parts = [];
                    if (m.studentName) parts.push(m.studentName);
                    if (m.tutorName) parts.push(m.tutorName);
                    if (m.course) parts.push(m.course);
                    l.summary = parts.join(' / ');
                } else if (m.newStart) {
                    l.summary = `Rescheduled to ${new Date(m.newStart).toLocaleString('en-US', { hour12: true })}`;
                } else {
                    l.summary = Object.entries(m).map(([k, v]) => `${k}: ${v}`).join('; ') || '—';
                }
                return l;
            });

const rawNotificationLogs = await NotificationLog.find().sort({ createdAt: -1 }).limit(20);
            const notificationLogs = rawNotificationLogs.map(log => {
                const l = log.toObject();
                l.recipientDisplayName = l.recipientName || '';
                const pr = l.providerResponse || {};
                l.summary = pr.messageId ? `ID: ${pr.messageId}` : (pr.message || pr.error || '—');
                return l;
            });

        const validTabs = ['appointments', 'hours', 'users', 'logs'];
        const activeTab = validTabs.includes(req.query.tab) ? req.query.tab : 'appointments';

        res.render('Admin/dashboard', { appointments, users, tutors, availabilityBlocks, activeTab, auditLogs, notificationLogs });
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

        // Load existing appointment to get tutor and student IDs
        const existing = await Appointment.findById(req.params.id);
        if (!existing) return res.status(404).send('Appointment not found.');

        // Check tutor overlap (excluding this appointment)
        const tutorOverlap = await Appointment.findOne({
            tutor: existing.tutor,
            status: 'booked',
            start: { $lt: endDate },
            end: { $gt: startDate },
            _id: { $ne: existing._id }
        }).select('_id');

        if (tutorOverlap) {
            return res.status(409).send('Cannot reschedule: Tutor already has an appointment at this time.');
        }

        // Check student overlap (excluding this appointment)
        const studentOverlap = await Appointment.findOne({
            student: existing.student,
            status: 'booked',
            start: { $lt: endDate },
            end: { $gt: startDate },
            _id: { $ne: existing._id }
        }).select('_id');

        if (studentOverlap) {
            return res.status(409).send('Cannot reschedule: Student already has an appointment at this time.');
        }

        await Appointment.findByIdAndUpdate(req.params.id, { start: startDate, end: endDate });

        await AuditLog.create({
            actor: req.user.id,
            action: 'edit',
            targetType: 'Appointment',
            targetId: req.params.id,
            metadata: { editedBy: 'admin', newStart: startDate, newEnd: endDate }
        });

        res.redirect('/adminDashboard');
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
                end: appointment.end
            }).catch((error) => console.error('Cancellation email error:', error));
        }

        await AuditLog.create({
            actor: req.user.id,
            action: 'cancel',
            targetType: 'Appointment',
            targetId: appointment._id,
            metadata: {
                cancelledBy: 'admin',
                studentEmail: appointment.student ? appointment.student.email : null,
                tutorEmail: appointment.tutor ? appointment.tutor.email : null
            }
        });
        res.redirect('/adminDashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error cancelling appointment');
    }
};

exports.addUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).send('User with that email already exists.');
        }
        const passwordHash = await bcrypt.hash(password, 12);
        await User.create({ name, email, role, passwordHash, active: true });
        res.redirect('/adminDashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error adding user');
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
            targetType: 'User',
            targetId: user._id,
            metadata: { updatedBy: 'admin' }
        });
        res.redirect('/adminDashboard');
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

       
        let normalizedBlockType = blockType === 'date' ? 'date' : 'weekly';
        const hasDate = Boolean(date);
        const hasDayOfWeek = dayOfWeek !== undefined && dayOfWeek !== '';

        if (normalizedBlockType === 'weekly' && !hasDayOfWeek && hasDate) {
            normalizedBlockType = 'date';
        }
        if (normalizedBlockType === 'date' && !hasDate && hasDayOfWeek) {
            normalizedBlockType = 'weekly';
        }

        // Check for overlapping availability blocks before inserting
        const overlapQuery = { tutor: tutor._id };

        if (normalizedBlockType === 'date') {
            overlapQuery.isException = true;
            overlapQuery.date = new Date(date);
        } else {
            overlapQuery.isException = false;
            overlapQuery.dayOfWeek = Number(dayOfWeek);
        }

        const existingBlocks = await AvailabilityBlock.find(overlapQuery).lean();

        const hasOverlap = existingBlocks.some(block => {
            const existingStart = parseTimeToMinutes(block.startTime);
            const existingEnd = parseTimeToMinutes(block.endTime);
            if (existingStart === null || existingEnd === null) return false;
            return startMinutes < existingEnd && existingStart < endMinutes;
        });

        if (hasOverlap) {
            return res.status(409).send(
                'This tutor already has an availability block that overlaps with the specified time. Please adjust the time range or delete the existing block first.'
            );
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

        await AvailabilityBlock.create(blockPayload);
        return res.redirect('/adminDashboard?tab=hours');
    } catch (err) {
        console.error(err);
        return res.status(500).send('Error adding availability block');
    }
};

exports.deleteAvailability = async (req, res) => {
    try {
        await AvailabilityBlock.findByIdAndDelete(req.params.id);
        return res.redirect('/adminDashboard?tab=hours');
    } catch (err) {
        console.error(err);
        return res.status(500).send('Error deleting availability block');
    }
};