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
router.post('/tutor/appointment/:id/session', authenticatePageJWT, authorizeRoles('tutor'), tutorController.updateSession);

module.exports = router;
