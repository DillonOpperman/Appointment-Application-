const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema(
    {
        channel: {
            type: String,
            enum: ['email', 'sms'],
            required: true
        },
        event: {
            type: String,
            enum: ['book', 'cancel', 'reminder', 'other'],
            required: true
        },
        recipient: {
            type: String,
            required: true,
            trim: true
        },
        status: {
            type: String,
            enum: ['queued', 'sent', 'failed'],
            default: 'queued'
        },
        providerResponse: {
            type: Object,
            default: {}
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
