const express = require('express');
const router = express.Router();
const studentController = require('../Controller/studentController');
const { authenticatePageJWT, authorizeRoles } = require('../middleware/auth');

router.get('/home', studentController.showHome);
router.get('/studentLogin', studentController.showLogin);
router.post('/submitStudentLogin', studentController.submitLogin);
router.get('/studentDashboard', authenticatePageJWT, authorizeRoles('student'), studentController.showDashboard);
router.post('/student/cancelAppointment/:id', authenticatePageJWT, authorizeRoles('student'), studentController.cancelAppointment);
router.post('/student/bookAppointment', authenticatePageJWT, authorizeRoles('student'), studentController.bookAppointment);

module.exports = router;