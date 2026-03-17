const express = require('express');
const router = express.Router();
const studentController = require('../Controller/studentController');

router.get('/home', studentController.showHome);
router.get('/studentLogin', studentController.showLogin);
router.post('/submitStudentLogin', studentController.submitLogin);
//router.get('/studentHome', studentController.showHome);

module.exports = router;