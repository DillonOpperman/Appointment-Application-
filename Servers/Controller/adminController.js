const Appointment = require('../Model/Appointment');
const AvailabilityBlock = require('../Model/AvailabilityBlock');
const AuditLog = require('../Model/AuditLog');
const User = require('../Model/User');
const CenterHours = require('../Model/CenterHours');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const NotificationLog = require('../Model/NotificationLog');
const { sendCancellationConfirmation } = require('../middleware/emailService');

const MAX_LOGIN_ATTEMPTS = 5;

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

        const admin = await User.findOne({ email, role: 'admin' });
        if (!admin) {
            return res.status(401).render('Admin/login', { error: 'Invalid admin credentials.' });
        }

        if (admin.lockedOut) {
            return res.status(403).render('Admin/login', { error: 'Account locked due to too many failed login attempts. Please contact another Admin.' });
        }

        if (!admin.active) {
            return res.status(403).render('Admin/login', { error: 'This account is inactive. Please contact another Admin.' });
        }

        const isMatch = await bcrypt.compare(password, admin.passwordHash);
        if (!isMatch) {
            // Admin accounts are NOT hard-locked — they are already protected by
            // the express-rate-limit middleware (5 req/min). Hard lockout on the
            // only admin account would make the system unrecoverable.
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
        const notice = req.query.notice ? decodeURIComponent(req.query.notice) : null;
        const noticeType = req.query.noticeType || 'danger';

        const appointments = await Appointment.find()
            .populate('student', 'name email')
            .populate('tutor', 'name email')
            .populate('comments.author', 'name role')
            .sort({ start: -1 });

        const users = await User.find({ role: { $in: ['student', 'tutor'] } })
            .sort({ role: 1, name: 1 });

        const tutors = await User.find({ role: 'tutor', active: true })
            .sort({ name: 1 });

        const availabilityBlocks = await AvailabilityBlock.find()
            .populate('tutor', 'name email')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        const availableCourses = await AvailabilityBlock.distinct('course');

            const rawAuditLogs = await AuditLog.find()
            .populate('actor', 'name email') 
            .sort({ createdAt: -1 })
            .limit(50);

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

        // Sort audit logs: cancel/cancel_appointment actions go to the bottom
        const isCancel = action => action === 'cancel' || action === 'cancel_appointment';
        auditLogs.sort((a, b) => {
            if (isCancel(a.action) && !isCancel(b.action)) return 1;
            if (!isCancel(a.action) && isCancel(b.action)) return -1;
            return 0;
        });

        const validTabs = ['appointments', 'hours', 'users', 'logs'];
        const activeTab = validTabs.includes(req.query.tab) ? req.query.tab : 'appointments';

        const centerHours = await CenterHours.findOne() || await CenterHours.create({});
        res.render('Admin/dashboard', { appointments, users, tutors, availabilityBlocks, activeTab, auditLogs, notificationLogs, notice, noticeType, availableCourses: availableCourses.filter(Boolean).sort(), centerHours });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading dashboard');
    }
 };

exports.editAppointment = async (req, res) => {
    try {
        const { start, end } = req.body;
        if (!start || !end) return res.redirect('/adminDashboard?tab=appointments&notice=Start+and+end+are+required&noticeType=danger');
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate) || isNaN(endDate)) return res.redirect('/adminDashboard?tab=appointments&notice=Invalid+date%2Ftime+values&noticeType=danger');
        if (endDate <= startDate) return res.redirect('/adminDashboard?tab=appointments&notice=End+time+must+be+after+start+time&noticeType=danger');

        // Load existing appointment to get tutor and student IDs
        const existing = await Appointment.findById(req.params.id);
        if (!existing) return res.redirect('/adminDashboard?tab=appointments&notice=Appointment+not+found&noticeType=danger');

        // Check tutor overlap (excluding this appointment)
        const tutorOverlap = await Appointment.findOne({
            tutor: existing.tutor,
            status: 'booked',
            start: { $lt: endDate },
            end: { $gt: startDate },
            _id: { $ne: existing._id }
        }).select('_id');

        if (tutorOverlap) {
            return res.redirect('/adminDashboard?tab=appointments&notice=Cannot+reschedule%3A+Tutor+already+has+an+appointment+at+this+time&noticeType=danger');
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
            return res.redirect('/adminDashboard?tab=appointments&notice=Cannot+reschedule%3A+Student+already+has+an+appointment+at+this+time&noticeType=danger');
        }

        await Appointment.findByIdAndUpdate(req.params.id, { start: startDate, end: endDate });

        await AuditLog.create({
            actor: req.user.id,
            action: 'edit',
            targetType: 'Appointment',
            targetId: req.params.id,
            metadata: { editedBy: 'admin', newStart: startDate, newEnd: endDate }
        });

        res.redirect('/adminDashboard?tab=appointments');
    } catch (err) {
        console.error(err);
        res.redirect('/adminDashboard?tab=appointments&notice=Error+editing+appointment&noticeType=danger');
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
                tutorEmail: appointment.tutor ? appointment.tutor.email : null,
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
        res.redirect('/adminDashboard?tab=appointments');
    } catch (err) {
        console.error(err);
        res.redirect('/adminDashboard?tab=appointments&notice=Error+cancelling+appointment&noticeType=danger');
    }
};

exports.addUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const allowedRoles = ['student', 'tutor'];
        if (!allowedRoles.includes(role)) {
            return res.redirect('/adminDashboard?tab=users&notice=Role+must+be+student+or+tutor&noticeType=danger');
        }
        if (!name || !email || !password) {
            return res.redirect('/adminDashboard?tab=users&notice=All+fields+are+required&noticeType=danger');
        }
        if (password.length < 8) {
            return res.redirect('/adminDashboard?tab=users&notice=Password+must+be+at+least+8+characters&noticeType=danger');
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        
        
        if (existing) {
            return res.redirect('/adminDashboard?tab=users&notice=A+user+with+that+email+already+exists&noticeType=danger');
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const enrolledCourses = (role === 'student' && req.body.enrolledCourses)
            ? req.body.enrolledCourses.split(',').map(c => c.trim()).filter(Boolean)
            : [];
        await User.create({ name, email: email.toLowerCase(), role, passwordHash, active: true, enrolledCourses });
        res.redirect('/adminDashboard?tab=users&notice=User+added+successfully&noticeType=success');
    } catch (err) {
        console.error(err);
        res.redirect('/adminDashboard?tab=users&notice=Error+adding+user&noticeType=danger');
    }
};

exports.toggleUserActive = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        user.active = !user.active;
        // If reactivating, clear lockout state
        if (user.active) {
            user.loginAttempts = 0;
            user.lockedOut = false;
        }
        await user.save();
        await AuditLog.create({
            actor: req.user.id,
            actorName: req.user.name || 'Admin',
            action: user.active ? 'activate' : 'deactivate',
            targetType: 'User',
            targetId: user._id,
            metadata: { updatedBy: 'admin', targetName: user.name, targetEmail: user.email }
        });
        res.redirect('/adminDashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating user');
    }
};

exports.updateUserCourses = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role !== 'student') {
            return res.redirect('/adminDashboard?tab=users&notice=Student+not+found&noticeType=danger');
        }
        const courses = req.body.enrolledCourses
            ? req.body.enrolledCourses.split(',').map(c => c.trim()).filter(Boolean)
            : [];
        user.enrolledCourses = courses;
        await user.save();
        res.redirect('/adminDashboard?tab=users&notice=Courses+updated+successfully&noticeType=success');
    } catch (err) {
        console.error(err);
        res.redirect('/adminDashboard?tab=users&notice=Error+updating+courses&noticeType=danger');
    }
};

exports.addAvailability = async (req, res) => {
    try {
        const { tutorId, course, blockType, dayOfWeek, date, startTime, endTime, isBlackoutDate } = req.body;

        if (!tutorId || !startTime || !endTime) {
            return res.redirect('/adminDashboard?tab=hours&notice=Tutor%2C+start+time%2C+and+end+time+are+required&noticeType=danger');
        }

        const startMinutes = parseTimeToMinutes(startTime);
        const endMinutes = parseTimeToMinutes(endTime);
        if (startMinutes === null || endMinutes === null) {
            return res.redirect('/adminDashboard?tab=hours&notice=Invalid+time+format&noticeType=danger');
        }
        if (startMinutes >= endMinutes) {
            return res.redirect('/adminDashboard?tab=hours&notice=End+time+must+be+after+start+time&noticeType=danger');
        }

        const normalizedStartTime = formatMinutesTo12Hour(startMinutes);
        const normalizedEndTime = formatMinutesTo12Hour(endMinutes);

        const tutor = await User.findOne({ _id: tutorId, role: 'tutor' });
        if (!tutor) {
            return res.redirect('/adminDashboard?tab=hours&notice=Tutor+not+found&noticeType=danger');
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

        // Center hours validation against DB (skip for blackout dates)
        if (isBlackoutDate !== 'on') {
            const chDoc = await CenterHours.findOne() || await CenterHours.create({});
            const DAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
            let dayNum;
            if (normalizedBlockType === 'weekly') {
                dayNum = Number(dayOfWeek);
            } else {
                dayNum = new Date(date).getDay();
            }
            const dayKey = DAY_KEYS[dayNum];
            const dayHours = chDoc[dayKey];
            if (!dayHours || !dayHours.open || !dayHours.close) {
                return res.redirect('/adminDashboard?tab=hours&notice=The+center+is+closed+on+' + DAY_KEYS[dayNum] + 's.+No+availability+can+be+scheduled&noticeType=danger');
            }
            const centerOpen = parseTimeToMinutes(dayHours.open);
            const centerClose = parseTimeToMinutes(dayHours.close);
            if (startMinutes < centerOpen || endMinutes > centerClose) {
                return res.redirect('/adminDashboard?tab=hours&notice=Availability+must+fall+within+center+hours+for+that+day&noticeType=danger');
            }
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
            return res.redirect('/adminDashboard?tab=hours&notice=This+tutor+already+has+an+overlapping+availability+block.+Please+adjust+the+time+or+delete+the+existing+block+first&noticeType=danger');
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
                return res.redirect('/adminDashboard?tab=hours&notice=Date+is+required+for+date-specific+blocks&noticeType=danger');
            }
            blockPayload.date = new Date(date);
        } else {
            if (dayOfWeek === undefined || dayOfWeek === '') {
                return res.redirect('/adminDashboard?tab=hours&notice=Day+of+week+is+required+for+weekly+blocks&noticeType=danger');
            }
            blockPayload.dayOfWeek = Number(dayOfWeek);
        }

        await AvailabilityBlock.create(blockPayload);
        return res.redirect('/adminDashboard?tab=hours');
    } catch (err) {
        console.error(err);
        return res.redirect('/adminDashboard?tab=hours&notice=Error+adding+availability+block&noticeType=danger');
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

exports.updateCenterHours = async (req, res) => {
    try {
        const DAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
        const update = {};
        for (const day of DAY_KEYS) {
            const open = (req.body[`${day}_open`] || '').trim();
            const close = (req.body[`${day}_close`] || '').trim();
            update[day] = { open: open || null, close: open ? (close || null) : null };
        }
        await CenterHours.findOneAndUpdate({}, update, { upsert: true, new: true });
        res.redirect('/adminDashboard?tab=hours&notice=Center+hours+updated+successfully&noticeType=success');
    } catch (err) {
        console.error(err);
        res.redirect('/adminDashboard?tab=hours&notice=Error+updating+center+hours&noticeType=danger');
    }
};