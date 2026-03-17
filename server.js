// Developed by Dillon Opperman
// Special thanks to Stefan for his contributions to this project

const express = require('express');
const app = express();
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();


const connectDB = require('./Servers/Database/connect');
const authRoutes = require('./Servers/Routes/authRoutes');
const adminRoutes = require('./Servers/Routes/adminRoutes');
const studentRoutes = require('./Servers/routes/studentRoutes');
const tutorRoutes = require('./Servers/routes/tutorRoutes');
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
app.use('/', studentRoutes);
app.use('/', tutorRoutes);

app.get('/', (req, res) => {
 res.redirect('/home');
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



async function ensureSeedUsers() {
    const seedPassword = 'RyzenDell3D!';
    const passwordHash = await bcrypt.hash(seedPassword, 12);

    const seedUsers = [
        { role: 'admin', name: 'Test Admin', email: 'testuser_admin@example.com' },
        { role: 'tutor', name: 'Test Tutor', email: 'testuser_tutor@example.com' },
        { role: 'student', name: 'Test Student', email: 'testuser_student@example.com' },
        { role: 'tutor', name: 'D Lopper', email: 'dlopper@ilstu.edu' }
    ];

    for (const seedUser of seedUsers) {
        const existingUser = await User.findOne({ email: seedUser.email.toLowerCase() });
        if (existingUser) {
            continue;
        }

        await User.create({
            role: seedUser.role,
            name: seedUser.name,
            email: seedUser.email,
            passwordHash,
            active: true
        });

        console.log('Seeded test user:', seedUser.email);
    }
}

async function startServer() {
    try {
        await connectDB();
        await ensureSeedUsers();
        app.listen(PORT, () => {
            console.log('Server running on port', PORT);
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
}

startServer();

