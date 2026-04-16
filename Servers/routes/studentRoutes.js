const express = require('express');
const router = express.Router();
const studentController = require('../Controller/studentController');
const { authenticatePageJWT, authorizeRoles } = require('../middleware/auth');
const { addEventToCalendar } = require('../middleware/googleCalendar');
const Appointment = require('../Model/Appointment');
const User = require('../Model/User');

router.get('/home',studentController.showHome)
router.get('/studentLogin', studentController.showLogin);
router.post('/submitStudentLogin', studentController.submitLogin);
router.get('/studentDashboard', authenticatePageJWT, authorizeRoles('student'), studentController.showDashboard);
router.post('/student/cancelAppointment/:id', authenticatePageJWT, authorizeRoles('student'), studentController.cancelAppointment);
router.post('/student/bookAppointment', authenticatePageJWT, authorizeRoles('student'), studentController.bookAppointment);

// Google Calendar route
router.post('/student/addToGoogleCalendar/:appointmentId', authenticatePageJWT, authorizeRoles('student'), async (req, res) => {
    try {
        const student = await User.findById(req.user.id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        if (!student.googleRefreshToken) {
            return res.status(400).json({ error: 'Google Calendar not connected. Please authorize first.' });
        }

        const appointment = await Appointment.findById(req.params.appointmentId)
            .populate('tutor', 'name')
            .populate('student', 'name');

        if (!appointment || String(appointment.student._id) !== String(student._id)) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        if (appointment.status !== 'booked') {
            return res.status(400).json({ error: 'Only booked appointments can be synced.' });
        }

        if (appointment.googleCalendarEventId) {
            const calendarHomeUrl = student.googleAccountEmail
                ? `https://calendar.google.com/calendar/u/0/r?authuser=${encodeURIComponent(student.googleAccountEmail)}`
                : 'https://calendar.google.com/calendar/u/0/r';

            return res.json({
                success: true,
                alreadySynced: true,
                message: 'This appointment was already synced to Google Calendar.',
                googleAccountEmail: student.googleAccountEmail || null,
                calendarHomeUrl,
                createdEventId: appointment.googleCalendarEventId
            });
        }

        // Create calendar event
        const event = {
            summary: `${appointment.course} with ${appointment.tutor.name}`,
            description: `Tutoring appointment for ${appointment.course}`,
            start: appointment.start,
            end: appointment.end
        };

        const result = await addEventToCalendar(student.googleRefreshToken, event);

        appointment.googleCalendarEventId = result.eventId;
        appointment.googleCalendarSyncedAt = new Date();
        await appointment.save();

        const calendarHomeUrl = student.googleAccountEmail
            ? `https://calendar.google.com/calendar/u/0/r?authuser=${encodeURIComponent(student.googleAccountEmail)}`
            : 'https://calendar.google.com/calendar/u/0/r';

        res.json({ 
            success: true, 
            message: 'Event added to Google Calendar',
            googleAccountEmail: student.googleAccountEmail || null,
            calendarHomeUrl,
            createdEventId: result.eventId || null
        });
    } catch (error) {
        console.error('Error adding to Google Calendar:', error);
        res.status(500).json({ error: 'Failed to add event to Google Calendar' });
    }
});

// Disconnect Google Calendar route
router.post('/student/disconnectGoogleCalendar', authenticatePageJWT, authorizeRoles('student'), async (req, res) => {
    try {
        const student = await User.findById(req.user.id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        student.googleRefreshToken = null;
        student.googleAccessToken = null;
        student.googleAccountEmail = null;
        await student.save();

        res.json({ success: true, message: 'Google Calendar disconnected' });
    } catch (error) {
        console.error('Error disconnecting Google Calendar:', error);
        res.status(500).json({ error: 'Failed to disconnect' });
    }
});

//router.get('/studentHome', studentController.showHome);

module.exports = router;