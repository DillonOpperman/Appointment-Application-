const Appointment = require('../Model/Appointment');
const AvailabilityBlock = require('../Model/AvailabilityBlock');
const AuditLog = require('../Model/AuditLog');
const User = require('../Model/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

        const validTabs = ['appointments', 'hours', 'users'];
        const activeTab = validTabs.includes(req.query.tab) ? req.query.tab : 'appointments';

        res.render('Admin/dashboard', { appointments, users, tutors, availabilityBlocks, activeTab });
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
        ).populate('student', 'email').populate('tutor', 'email');
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

        const tutor = await User.findOne({ _id: tutorId, role: 'tutor' });
        if (!tutor) {
            return res.status(404).send('Tutor not found.');
        }

        if (startTime >= endTime) {
            return res.status(400).send('End time must be after start time.');
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
            createdBy: req.user.id,
            course: (course || 'IT 330').trim(),
            startTime,
            endTime,
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