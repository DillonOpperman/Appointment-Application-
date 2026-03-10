const express = require('express');
const router = express.Router();
const adminController = require('../Controller/adminController');

router.get('/adminLogin', adminController.showLogin);
router.post('/submitAdminLogin', adminController.submitLogin);
router.get('/adminDashboard', adminController.showDashboard);
router.post('/cancelAppointment/:id', adminController.cancelAppointment);

module.exports = router;