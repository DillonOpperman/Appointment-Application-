const express = require('express');
const router = express.Router();
const adminController = require('../Controller/adminController');
const { authenticatePageJWT, authorizeRoles } = require('../middleware/auth');

router.get('/adminLogin', adminController.showLogin);
router.post('/submitAdminLogin', adminController.submitLogin);
router.get('/adminDashboard', authenticatePageJWT, authorizeRoles('admin'), adminController.showDashboard);
router.post('/cancelAppointment/:id', authenticatePageJWT, authorizeRoles('admin'), adminController.cancelAppointment);
router.post('/admin/appointment/edit/:id', authenticatePageJWT, authorizeRoles('admin'), adminController.editAppointment);
router.post('/admin/availability', authenticatePageJWT, authorizeRoles('admin'), adminController.addAvailability);
router.post('/admin/availability/delete/:id', authenticatePageJWT, authorizeRoles('admin'), adminController.deleteAvailability);
router.post('/addUser', authenticatePageJWT, authorizeRoles('admin'), adminController.addUser);
router.post('/toggleUserActive/:id', authenticatePageJWT, authorizeRoles('admin'), adminController.toggleUserActive);

module.exports = router;