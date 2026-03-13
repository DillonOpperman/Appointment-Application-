const Appointment = require('../Model/Appointment');
const AuditLog = require('../Model/AuditLog');
const User = require('../Model/User');
const bcrypt = require('bcryptjs');

exports.showLogin = (req, res) => {
    res.render('Admin/login', { error: null });
};

exports.submitLogin = (req, res) => {
    const { adminEmail, adminPassword } = req.body;
    console.log('Admin login attempt:', adminEmail);
    res.redirect('/adminDashboard');
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
            actor: appointment.student,
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
            actor: req.params.id,
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