const Appointment = require('../Model/Appointment');
const AvailabilityBlock = require('../Model/AvailabilityBlock');
const User = require('../Model/User');
const bcrypt = require('bcryptjs');
const path = require('path')
const { sendBookingConfirmation, sendCancellationConfirmation } = require('../middleware/emailService');

function combineDateAndTime(dateObj, timeString) {
    const [hours, minutes] = (timeString || '00:00').split(':').map(Number);
    const combined = new Date(dateObj);
    combined.setHours(hours || 0, minutes || 0, 0, 0);
    return combined;
}

function getDateKey(dateObj) {
    const clone = new Date(dateObj);
    clone.setHours(0, 0, 0, 0);
    return clone.toISOString().slice(0, 10);
}

async function authenticateOrCreateStudent(studentEmail, studentPassword) {
    const normalizedEmail = (studentEmail || '').toLowerCase().trim();
    const trimmedPassword = (studentPassword || '').trim();

    if (!normalizedEmail || !trimmedPassword) {
        return { error: 'Please provide both email and password.' };
    }

    if (trimmedPassword.length < 6) {
        return { error: 'Password must be at least 6 characters.' };
    }

    let student = await User.findOne({ email: normalizedEmail });
    if (student && student.role !== 'student') {
        return { error: 'That email belongs to a non-student account.' };
    }

    if (student && !student.active) {
        return { error: 'This student account is inactive. Please contact an admin.' };
    }

    if (student) {
        const isMatch = await bcrypt.compare(trimmedPassword, student.passwordHash);
        if (!isMatch) {
            return { error: 'Invalid email/password for this student account.' };
        }
        return { student };
    }

    const passwordHash = await bcrypt.hash(trimmedPassword, 12);
    const fallbackName = normalizedEmail.split('@')[0] || 'Student';
    student = await User.create({
        role: 'student',
        name: fallbackName,
        email: normalizedEmail,
        passwordHash,
        active: true
    });

    return { student };
}

async function createAppointmentForSlot({ tutorId, course, start, end, student }) {
    const tutor = await User.findOne({ _id: tutorId, role: 'tutor', active: true }).select('_id');
    if (!tutor) {
        return { errorCode: 'invalid_tutor' };
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
        return { errorCode: 'booking_failed' };
    }

    const overlap = await Appointment.findOne({
        tutor: tutor._id,
        status: 'booked',
        start: { $lt: endDate },
        end: { $gt: startDate }
    }).select('_id');

    if (overlap) {
        return { errorCode: 'slot_taken' };
    }

    const appointment = await Appointment.create({
        student: student._id,
        tutor: tutor._id,
        course: (course || 'IT 330').trim() || 'IT 330',
        start: startDate,
        end: endDate,
        status: 'booked'
    });
    
    const tutorUser = await User.findById(tutor._id).select('name');
    sendBookingConfirmation({
        studentEmail: student.email,
        studentName: student.name,
        tutorName: tutorUser ? tutorUser.name : 'Your Tutor',
        course: appointment.course,
        start: appointment.start,
        end: appointment.end
    }).catch(err => console.error('Booking email error:', err));
    
    return { ok: true };
}
async function getTutors(){
    const tutors = await User.find({ role: "tutor" });
    return tutors
}
exports.showLogin = (req, res) => {
    //res.sendStatus(200);
    //res.sendFile(path.join(__dirname,'../../Views/html/student/studentLoginPage.html'));
    res.render('Student/studentLoginPage')
};
exports.submitLogin = (req, res) => {
    res.redirect("/studentHome", {
        //studentEmail: req.body.studentEmail,
        //studentPassword: req.body.studentPassword
    });
}
exports.showHome = async (req, res) => {
    //res.send("Submitted student email: " + req.body.studentEmail + " Submitted student pass: " + req.body.studentPassword);

    try {
        tutors = await getTutors();
        students = await User.find({ role: "student" });
        res.render("Student/studentHome", {
            tutors: tutors,
            students: students
        });

    } catch (err) {
        console.error(err);
        res.send("Error loading tutors");
    }
};
exports.createAppointment = async (req, res) => {
    try {
        const start = new Date(req.body.scheduledStart);

        const end = new Date(start);
        end.setHours(end.getHours() + 1);

        await Appointment.create({
            student: req.body.studentId,
            tutor: req.body.tutorId,
            course: req.body.course,
            start,
            end
        });

        res.redirect("/studentHome");

    } catch (err) {
        console.error(err);
        res.send("Error creating appointment");
    }
};
