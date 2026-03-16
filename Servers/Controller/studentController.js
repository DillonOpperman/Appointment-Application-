const Appointment = require('../Model/Appointment');
const path = require('path');
exports.showLogin = (req, res) => {
    //res.sendStatus(200);
    //res.sendFile(path.join(__dirname,'../../Views/html/student/studentLoginPage.html'));
    res.render('Student/studentLoginPage')
};
exports.showHome = (req, res) => {
     res.send("Submitted student email: " + req.body.studentEmail + " Submitted student pass: " + req.body.studentPassword);
};
exports.createAppointment = (req, res) => {

};
