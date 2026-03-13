const express = require('express');
const router = express.Router();
const adminController = require('../Controller/adminController');

router.get('/adminLogin', adminController.showLogin);
router.post('/submitAdminLogin', adminController.submitLogin);
router.get('/adminDashboard', adminController.showDashboard);
router.post('/cancelAppointment/:id', adminController.cancelAppointment);
router.post('/addUser', adminController.addUser);
router.post('/toggleUserActive/:id', adminController.toggleUserActive);

module.exports = router;