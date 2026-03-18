const mongoose = require('mongoose');

const availabilityBlockSchema = new mongoose.Schema(
    {
        tutor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        course: {
            type: String,
            default: 'IT 330',
            trim: true
        },
        dayOfWeek: {
            type: Number,
            min: 0,
            max: 6
        },
        date: {
            type: Date
        },
        startTime: {
            type: String,
            required: true
        },
        endTime: {
            type: String,
            required: true
        },
        isException: {
            type: Boolean,
            default: false
        },
        isBlackoutDate: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('AvailabilityBlock', availabilityBlockSchema);
