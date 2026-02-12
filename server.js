const express = require('express');
const app = express();
const path = require('path');
app.use(express.urlencoded({extended: true}));
const PORT = process.env.PORT || 3000
app.listen(PORT, () =>{
    console.log('Server running on port', PORT);
});
app.get('/studentLogin',(req, res) => {res.sendFile(path.join(__dirname,'htmlFiles/student/loginPage.html'));});
app.post('/submitStudentLogin',(req,res) => {res.send("Submitted student email: " + req.body.studentEmail + " Submitted student pass: " + req.body.studentPassword); console.log(req.body);});