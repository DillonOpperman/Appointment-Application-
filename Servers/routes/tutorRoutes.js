const express = require('express');
const router = express.Router();
const tutorController = require('../Controller/tutorController');
const { authenticatePageJWT, authorizeRoles } = require('../middleware/auth');

router.get('/tutorLogin', tutorController.showLogin);
router.post('/submitTutorLogin', tutorController.submitLogin);
router.get('/tutorDashboard', authenticatePageJWT, authorizeRoles('tutor'), tutorController.showDashboard);
router.get('/tutorAppointments', (req, res) => {
    res.redirect('/tutorDashboard');
});
router.post('/tutor/cancelAppointment/:id', authenticatePageJWT, authorizeRoles('tutor'), tutorController.cancelAppointment);
router.get('/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'auth_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
    return res.redirect('/home');
});

module.exports = router;
