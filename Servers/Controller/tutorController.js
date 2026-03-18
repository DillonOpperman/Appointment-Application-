const Appointment = require('../Model/Appointment');
const AuditLog = require('../Model/AuditLog');
const User = require('../Model/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function resolveTutorFromRequest(req) {
    if (!req.user || !req.user.id) {
        return null;
    }
    return User.findOne({ _id: req.user.id, role: 'tutor', active: true });
}

exports.showLogin = (req, res) => {
    res.render('Tutor/login', { error: null });
};

exports.submitLogin = async (req, res) => {
    try {
        const email = (req.body.tutorEmail || '').toLowerCase().trim();
        const password = req.body.tutorPassword || '';

        const tutor = await User.findOne({ email, role: 'tutor' });
        if (!tutor) {
            return res.status(401).render('Tutor/login', { error: 'Invalid tutor credentials.' });
        }

        if (!tutor.active) {
            return res.status(403).render('Tutor/login', { error: 'Reach out to Admin. Tutor permissions denied.' });
        }

        const isMatch = await bcrypt.compare(password, tutor.passwordHash);
        if (!isMatch) {
            return res.status(401).render('Tutor/login', { error: 'Invalid tutor credentials.' });
        }

        const token = jwt.sign(
            { id: tutor._id, email: tutor.email, role: tutor.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.setHeader('Set-Cookie', `auth_token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`);
        return res.redirect('/tutorDashboard');
    } catch (error) {
        return res.status(500).render('Tutor/login', { error: 'Tutor login failed.' });
    }
};

exports.showDashboard = async (req, res) => {
    try {
        const tutor = await resolveTutorFromRequest(req);
        if (!tutor) {
            return res.status(404).render('Tutor/login', { error: 'Tutor account not found.' });
        }

        const appointments = await Appointment.find({ tutor: tutor._id })
            .populate('student', 'name email')
            .populate('comments.author', 'name')
            .sort({ start: -1 });

            const notice = req.query.success
            ? 'Session updated successfully.'
            : req.query.error === 'not_found'
                ? 'Appointment not found.'
                : null;
        
        return res.render('Tutor/dashboard', { tutor, appointments, notice });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error loading tutor dashboard.');
    }
};

exports.cancelAppointment = async (req, res) => {
    try {
        const tutor = await resolveTutorFromRequest(req);
        if (!tutor) {
            return res.status(404).send('Tutor not found.');
        }

        const appointment = await Appointment.findOneAndUpdate(
            {
                _id: req.params.id,
                tutor: tutor._id,
                status: 'booked'
            },
            { status: 'cancelled' },
            { new: true }
        );

        if (!appointment) {
            return res.status(404).send('Appointment not found or cannot be cancelled.');
        }

        await AuditLog.create({
            actor: tutor._id,
            action: 'cancel',
            targetType: 'Appointment',
            targetId: appointment._id,
            metadata: { cancelledBy: 'tutor' }
        });

        return res.redirect('/tutorDashboard');
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error cancelling appointment.');
    }
};

exports.updateSession = async (req, res) => {
    try {
        const tutor = await resolveTutorFromRequest(req);
        if (!tutor) return res.status(404).send('Tutor not found.');

        const { commentText, attendance, actualStart, actualEnd } = req.body;

        const appointment = await Appointment.findOne({
            _id: req.params.id,
            tutor: tutor._id
        });

        if (!appointment) {
            return res.redirect('/tutorDashboard?error=not_found');
        }

        if (commentText && commentText.trim()) {
            appointment.comments.push({
                author: tutor._id,
                commentText: commentText.trim()
            });
        }

        if (attendance === 'noshow') {
            appointment.status = 'noshow';
        } else if (attendance === 'show') {
            appointment.status = 'completed';
        }

        if (actualStart) appointment.actualStart = new Date(actualStart);
        if (actualEnd) appointment.actualEnd = new Date(actualEnd);

        await appointment.save();

        await AuditLog.create({
            actor: tutor._id,
            action: 'updateSession',
            targetType: 'Appointment',
            targetId: appointment._id,
            metadata: { attendance, hasComment: !!(commentText && commentText.trim()) }
        });

        return res.redirect('/tutorDashboard?success=1');
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error updating session.');
    }
};