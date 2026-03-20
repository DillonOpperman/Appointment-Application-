const express = require('express');
const router = express.Router();
const studentController = require('../Controller/studentController');

router.get('/studentLogin', studentController.showLogin);
router.post('/submitStudentLogin', studentController.showHome);
router.get('/studentHome', studentController.showHome);
router.post('/studentCreateAppointment', studentController.createAppointment)
router.post('/studentCancelAppointment', studentController.cancelAppointment)

module.exports = router;