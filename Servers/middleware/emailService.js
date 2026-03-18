const nodemailer = require('nodemailer');

let transporter = null;

async function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_ADMIN,
                pass: process.env.GMAIL_APP_PASSWORD
            }
        });
    }
    return transporter;
}

async function sendBookingConfirmation({ studentEmail, studentName, tutorName, course, start, end }) {
    const startStr = new Date(start).toLocaleString();
    const endStr = new Date(end).toLocaleString();
    const transport = await getTransporter();

    await transport.sendMail({
        from: `"IT Learning Center" <${process.env.GMAIL_ADMIN}>`,
        to: studentEmail,
        subject: 'Appointment Confirmation - IT Learning Center',
        html: `
            <h2>Appointment Confirmed!</h2>
            <p>Hi ${studentName},</p>
            <p>Your appointment has been successfully booked. Here are the details:</p>
            <ul>
                <li><strong>Tutor:</strong> ${tutorName}</li>
                <li><strong>Course:</strong> ${course}</li>
                <li><strong>Start:</strong> ${startStr}</li>
                <li><strong>End:</strong> ${endStr}</li>
            </ul>
            <p>If you need to cancel, please do so in advance.</p>
            <p>- IT Learning Center</p>
        `
    });

    await transport.sendMail({
        from: `"IT Learning Center" <${process.env.GMAIL_ADMIN}>`,
        to: process.env.GMAIL_ADMIN,
        subject: 'New Appointment Booked - IT Learning Center',
        html: `
            <h2>New Appointment Booked</h2>
            <ul>
                <li><strong>Student:</strong> ${studentName} (${studentEmail})</li>
                <li><strong>Tutor:</strong> ${tutorName}</li>
                <li><strong>Course:</strong> ${course}</li>
                <li><strong>Start:</strong> ${startStr}</li>
                <li><strong>End:</strong> ${endStr}</li>
            </ul>
        `
    });

    console.log('Booking confirmation emails sent.');
}

async function sendCancellationConfirmation({ studentEmail, studentName, tutorName, course, start, end }) {
    const startStr = new Date(start).toLocaleString();
    const endStr = new Date(end).toLocaleString();
    const transport = await getTransporter();

    await transport.sendMail({
        from: `"IT Learning Center" <${process.env.GMAIL_ADMIN}>`,
        to: studentEmail,
        subject: 'Appointment Cancelled - IT Learning Center',
        html: `
            <h2>Appointment Cancelled</h2>
            <p>Hi ${studentName},</p>
            <p>Your appointment has been cancelled. Here are the details:</p>
            <ul>
                <li><strong>Tutor:</strong> ${tutorName}</li>
                <li><strong>Course:</strong> ${course}</li>
                <li><strong>Start:</strong> ${startStr}</li>
                <li><strong>End:</strong> ${endStr}</li>
            </ul>
            <p>- IT Learning Center</p>
        `
    });

    await transport.sendMail({
        from: `"IT Learning Center" <${process.env.GMAIL_ADMIN}>`,
        to: process.env.GMAIL_ADMIN,
        subject: 'Appointment Cancelled - IT Learning Center',
        html: `
            <h2>Appointment Cancelled</h2>
            <ul>
                <li><strong>Student:</strong> ${studentName} (${studentEmail})</li>
                <li><strong>Tutor:</strong> ${tutorName}</li>
                <li><strong>Course:</strong> ${course}</li>
                <li><strong>Start:</strong> ${startStr}</li>
                <li><strong>End:</strong> ${endStr}</li>
            </ul>
        `
    });

    console.log('Cancellation confirmation emails sent.');
}

module.exports = { sendBookingConfirmation, sendCancellationConfirmation };