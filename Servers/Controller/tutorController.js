const Appointment = require('../Model/Appointment');
const AvailabilityBlock = require('../Model/AvailabilityBlock');
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

        const tutor = await User.findOne({ email, role: 'tutor', active: true });
        if (!tutor) {
            return res.status(401).render('Tutor/login', { error: 'Invalid tutor credentials.' });
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
            .sort({ start: -1 });

        const availabilityBlocks = await AvailabilityBlock.find({ tutor: tutor._id })
            .sort({ date: 1, dayOfWeek: 1, startTime: 1 });

        const activeTab = req.query.tab === 'hours' ? 'hours' : 'appointments';

        return res.render('Tutor/dashboard', {
            tutor,
            appointments,
            availabilityBlocks,
            activeTab
        });
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

        return res.redirect('/tutorDashboard?tab=appointments');
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error cancelling appointment.');
    }
};

exports.addAvailability = async (req, res) => {
    try {
        const tutor = await resolveTutorFromRequest(req);
        if (!tutor) {
            return res.status(404).send('Tutor not found.');
        }

        const { course, blockType, dayOfWeek, date, startTime, endTime, isBlackoutDate } = req.body;

        if (!startTime || !endTime) {
            return res.status(400).send('Start and end time are required.');
        }

        const blockPayload = {
            tutor: tutor._id,
            createdBy: tutor._id,
            course: course || 'IT 330',
            startTime,
            endTime,
            isException: blockType === 'date',
            isBlackoutDate: isBlackoutDate === 'on'
        };

        if (blockType === 'date') {
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

        return res.redirect('/tutorDashboard?tab=hours');
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error saving availability block.');
    }
};

exports.deleteAvailability = async (req, res) => {
    try {
        const tutor = await resolveTutorFromRequest(req);
        if (!tutor) {
            return res.status(404).send('Tutor not found.');
        }

        await AvailabilityBlock.findOneAndDelete({ _id: req.params.id, tutor: tutor._id });

        return res.redirect('/tutorDashboard?tab=hours');
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error deleting availability block.');
    }
};
