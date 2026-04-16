const mongoose = require('mongoose');

const appointmentCommentSchema = new mongoose.Schema(
    {
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        commentText: {
            type: String,
            required: true,
            trim: true
        }
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        _id: true
    }
);

const appointmentSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        tutor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        studentName: {
            type: String,
            trim: true,
            default: ''
        },
        tutorName: {
            type: String,
            trim: true,
            default: ''
        },
        course: {
            type: String,
            required: true,
            default: 'IT 330',
            trim: true
        },
        start: {
            type: Date,
            required: true
        },
        end: {
            type: Date,
            required: true
        },
        status: {
            type: String,
            enum: ['booked', 'cancelled', 'completed', 'noshow'],
            default: 'booked'
        },
        comments: {
            type: [appointmentCommentSchema],
            default: []
        },
        actualStart: {
            type: Date
        },
        actualEnd: {
            type: Date
        },
        googleCalendarEventId: {
            type: String,
            default: null,
            trim: true
        },
        googleCalendarSyncedAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
