const express = require('express');
const app = express();
const path = require('path');
app.use(express.urlencoded({extended: true}));
const PORT = process.env.PORT || 3001

app.use('/cssFiles', express.static(path.join(__dirname, 'cssFiles')));

app.get('/studentLogin',(req, res) => {res.sendFile(path.join(__dirname,'htmlFiles/student/loginPage.html'));});
app.post('/submitStudentLogin',(req,res) => {res.send("Submitted student email: " + req.body.studentEmail + " Submitted student pass: " + req.body.studentPassword); console.log(req.body);});

app.get('/adminDashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'htmlFiles/ admin/adminDashboard.html'));
});

app.get('/adminLogin',(req, res) => {res.sendFile(path.join(__dirname,'htmlFiles/ admin/adminLoginPage.html'));});
app.post('/submitAdminLogin',(req,res) => {res.send("Submitted email: " + req.body.adminEmail + " submitted password: " + req.body.adminPassword); console.log(req.body);});



// Tutor routes
app.get('/tutorLogin', (req, res) => {
    res.sendFile(path.join(__dirname, 'htmlFiles/tutor/TutorPage.html'));
});
app.get('/tutorDashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'htmlFiles/tutor/tutorDashboard.html'));
});
app.post('/submitTutorLogin', (req, res) => {
    res.send("Submitted tutor email: " + req.body.tutorEmail + " Submitted tutor pass: " + req.body.tutorPassword);
    console.log(req.body);
});

app.listen(PORT, () =>{
    console.log('Server running on port', PORT);
});

