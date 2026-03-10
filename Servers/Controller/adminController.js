const Appointment = require('../Model/Appointment');
const AuditLog = require('../Model/AuditLog');

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
        res.render('Admin/dashboard', { appointments });
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