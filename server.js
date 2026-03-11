const express = require('express');
const app = express();
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();


const connectDB = require('./Servers/Database/connect');
const authRoutes = require('./Servers/Routes/authRoutes');
const adminRoutes = require('./Servers/Routes/adminRoutes');
const studentRoutes = require('./Servers/routes/studentRoutes');
const User = require('./Servers/Model/User');


app.use(express.urlencoded({extended: true}));
app.use(express.json());

const PORT = process.env.PORT || 3001

// View engine for EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'Views'));

// Static files
app.use('/assets', express.static(path.join(__dirname, 'Assets')));

// Routes 
app.use('/api/auth', authRoutes);
app.use('/', adminRoutes);
app.use('/',studentRoutes)

app.get('/', (req, res) => {
 res.redirect('/home');
});

// Home
app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'Views/html/home/home.html'));
});

// Student Routes 
//app.get('/studentLogin',(req, res) => {
    //res.sendFile(path.join(__dirname,'Views/html/student/loginPage.html'));});
//app.post('/submitStudentLogin',(req,res) => {
    //res.send("Submitted student email: " + req.body.studentEmail + " Submitted student pass: " + req.body.studentPassword); console.log(req.body);});

//app.get('/adminDashboard', (req, res) => {
//    res.sendFile(path.join(__dirname, 'Views/html/admin/adminDashboard.html'));
//});

//app.get('/adminLogin',(req, res) => {res.sendFile(path.join(__dirname,'Views/html/admin/adminLoginPage.html'));});
//app.post('/submitAdminLogin',(req,res) => {console.log(req.body); res.redirect('/adminDashboard');});



// Tutor routes
app.get('/tutorLogin', (req, res) => {
    res.sendFile(path.join(__dirname, 'Views/html/tutor/TutorPage.html'));
});
app.get('/tutorDashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'Views/html/tutor/tutorDashboard.html'));
});
app.get('/tutorAppointments', (req, res) => {
    res.sendFile(path.join(__dirname, 'Views/html/tutor/tutorAppointments.html'));
});
app.get('/tutorHours', (req, res) => {
    res.sendFile(path.join(__dirname, 'Views/html/tutor/tutorHours.html'));
});
app.post('/submitTutorLogin', async (req, res) => {
    try {
        const email = (req.body.tutorEmail || '').toLowerCase().trim();
        const password = req.body.tutorPassword || '';

        const user = await User.findOne({ email, role: 'tutor', active: true });
        if (!user) {
            return res.status(401).send('Invalid tutor credentials.');
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).send('Invalid tutor credentials.');
        }

        return res.redirect('/tutorDashboard');
    } catch (error) {
        return res.status(500).send('Tutor login failed.');
    }
});

async function ensureTutorSeedUser() {
    const tutorEmail = 'dlopper@ilstu.edu';
    const tutorPassword = 'RyzenDell3D!';

    const existingTutor = await User.findOne({ email: tutorEmail.toLowerCase() });
    if (existingTutor) {
        return;
    }

    const passwordHash = await bcrypt.hash(tutorPassword, 12);
    await User.create({
        role: 'tutor',
        name: 'D Lopper',
        email: tutorEmail,
        passwordHash,
        active: true
    });

    console.log('Seeded tutor test user:', tutorEmail);
}

async function startServer() {
    try {
        await connectDB();
        await ensureTutorSeedUser();
        app.listen(PORT, () => {
            console.log('Server running on port', PORT);
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
}

startServer();

