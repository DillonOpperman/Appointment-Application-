const Appointment = require('../Model/Appointment');
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
        
            res.render('Admin/dashboard', { appointments, users });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading dashboard');
    }
 };

 exports.cancelAppointment = async (req, res) => {
    try {
        const appointment = await Appointment.findByIdAndUpdate(
            req.params.id,
            { status: 'cancelled' },
            { new: true }
        );
        await AuditLog.create({
            actor: req.user.id,
            action: 'cancel',
            targetType: 'Appointment',
            targetId: appointment._id,
            metadata: { cancelledBy: 'admin' }
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