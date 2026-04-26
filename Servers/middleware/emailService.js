const nodemailer = require('nodemailer');
const NotificationLog = require('../Model/NotificationLog');

let transporter = null;

async function createNotificationEntry({
    channel,
    event,
    recipient,
    recipientName,
    status,
    providerResponse
}) {
    try {
        await NotificationLog.create({
            channel,
            event,
            recipient,
            recipientName: recipientName || '',
            status,
            providerResponse: providerResponse || {}
        });
    } catch (error) {
        console.error('Notification log write failed:', error.message);
    }
}

async function sendMailWithLog({ transport, mailOptions, event, recipientName, context }) {
    try {
        const info = await transport.sendMail(mailOptions);
        await createNotificationEntry({
            channel: 'email',
            event,
            recipient: mailOptions.to,
            recipientName,
            status: 'sent',
            providerResponse: {
                ...context,
                messageId: info && info.messageId ? info.messageId : null,
                accepted: info && Array.isArray(info.accepted) ? info.accepted : []
            }
        });
        return info;
    } catch (error) {
        await createNotificationEntry({
            channel: 'email',
            event,
            recipient: mailOptions.to,
            recipientName,
            status: 'failed',
            providerResponse: {
                ...context,
                error: error.message
            }
        });
        throw error;
    }
}

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

async function sendBookingConfirmation({ studentEmail, studentName, tutorEmail, tutorName, course, start, end, appointmentId }) {
    const startStr = new Date(start).toLocaleString('en-US', { hour12: true });
    const endStr = new Date(end).toLocaleString('en-US', { hour12: true });
    const transport = await getTransporter();
    const context = {
        appointmentId: appointmentId ? String(appointmentId) : null,
        studentName,
        studentEmail,
        tutorName,
        course,
        start,
        end,
        summary: `${studentName} booked ${course} with ${tutorName}`
    };

    await sendMailWithLog({
        transport,
        event: 'book',
        recipientName: studentName,
        context,
        mailOptions: {
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
        }
    });

    await sendMailWithLog({
        transport,
        event: 'book',
        recipientName: 'Admin Mailbox',
        context,
        mailOptions: {
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
        }
    });

    if (tutorEmail) {
        await sendMailWithLog({
            transport,
            event: 'book',
            recipientName: tutorName,
            context,
            mailOptions: {
            from: `"IT Learning Center" <${process.env.GMAIL_ADMIN}>`,
            to: tutorEmail,
            subject: 'New Appointment Booked - IT Learning Center',
            html: `
                <h2>New Appointment Booked</h2>
                <p>Hi ${tutorName},</p>
                <p>A student has booked an appointment with you. Here are the details:</p>
                <ul>
                    <li><strong>Student:</strong> ${studentName}</li>
                    <li><strong>Course:</strong> ${course}</li>
                    <li><strong>Start:</strong> ${startStr}</li>
                    <li><strong>End:</strong> ${endStr}</li>
                </ul>
                <p>- IT Learning Center</p>
            `
            }
        });
    }

    console.log('Booking confirmation emails sent.');
}

async function sendCancellationConfirmation({ studentEmail, studentName, tutorEmail, tutorName, course, start, end, appointmentId }) {
    const startStr = new Date(start).toLocaleString('en-US', { hour12: true });
    const endStr = new Date(end).toLocaleString('en-US', { hour12: true });
    const transport = await getTransporter();
    const context = {
        appointmentId: appointmentId ? String(appointmentId) : null,
        studentName,
        studentEmail,
        tutorName,
        course,
        start,
        end,
        summary: `${studentName} cancelled ${course} with ${tutorName}`
    };

    await sendMailWithLog({
        transport,
        event: 'cancel',
        recipientName: studentName,
        context,
        mailOptions: {
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
        }
    });

    await sendMailWithLog({
        transport,
        event: 'cancel',
        recipientName: 'Admin Mailbox',
        context,
        mailOptions: {
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
        }
    });

    if (tutorEmail) {
        await sendMailWithLog({
            transport,
            event: 'cancel',
            recipientName: tutorName,
            context,
            mailOptions: {
            from: `"IT Learning Center" <${process.env.GMAIL_ADMIN}>`,
            to: tutorEmail,
            subject: 'Appointment Cancelled - IT Learning Center',
            html: `
                <h2>Appointment Cancelled</h2>
                <p>Hi ${tutorName},</p>
                <p>An appointment has been cancelled. Here are the details:</p>
                <ul>
                    <li><strong>Student:</strong> ${studentName}</li>
                    <li><strong>Course:</strong> ${course}</li>
                    <li><strong>Start:</strong> ${startStr}</li>
                    <li><strong>End:</strong> ${endStr}</li>
                </ul>
                <p>- IT Learning Center</p>
            `
            }
        });
    }

    console.log('Cancellation confirmation emails sent.');
}

async function sendAppointmentReminder({ studentEmail, studentName, tutorName, course, start, end, appointmentId }) {
    const startStr = new Date(start).toLocaleString('en-US', { hour12: true });
    const endStr = new Date(end).toLocaleString('en-US', { hour12: true });
    const transport = await getTransporter();
    const context = {
        appointmentId: appointmentId ? String(appointmentId) : null,
        studentName,
        studentEmail,
        tutorName,
        course,
        start,
        end,
        summary: `Reminder sent to ${studentName} for ${course} with ${tutorName}`
    };

    await sendMailWithLog({
        transport,
        event: 'reminder',
        recipientName: studentName,
        context,
        mailOptions: {
        from: `"IT Learning Center" <${process.env.GMAIL_ADMIN}>`,
        to: studentEmail,
        subject: 'Appointment Reminder - IT Learning Center',
        html: `
            <h2>Upcoming Appointment Reminder</h2>
            <p>Hi ${studentName},</p>
            <p>This is a reminder for your upcoming tutoring appointment:</p>
            <ul>
                <li><strong>Tutor:</strong> ${tutorName}</li>
                <li><strong>Course:</strong> ${course}</li>
                <li><strong>Start:</strong> ${startStr}</li>
                <li><strong>End:</strong> ${endStr}</li>
            </ul>
            <p>- IT Learning Center</p>
        `
        }
    });

    await sendMailWithLog({
        transport,
        event: 'reminder',
        recipientName: 'Admin Mailbox',
        context,
        mailOptions: {
        from: `"IT Learning Center" <${process.env.GMAIL_ADMIN}>`,
        to: process.env.GMAIL_ADMIN,
        subject: 'Appointment Reminder Sent - IT Learning Center',
        html: `
            <h2>Appointment Reminder Sent</h2>
            <ul>
                <li><strong>Student:</strong> ${studentName} (${studentEmail})</li>
                <li><strong>Tutor:</strong> ${tutorName}</li>
                <li><strong>Course:</strong> ${course}</li>
                <li><strong>Start:</strong> ${startStr}</li>
                <li><strong>End:</strong> ${endStr}</li>
            </ul>
        `
        }
    });

    console.log('Appointment reminder emails sent.');
}

module.exports = { sendBookingConfirmation, sendCancellationConfirmation, sendAppointmentReminder };