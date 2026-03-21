const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
    {
        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        action: {
            type: String,
            required: true,
            trim: true
        },
        actorName: {
            type: String,
            trim: true,
            default: ''
        },
        targetType: {
            type: String,
            required: true,
            trim: true
        },
        targetId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        metadata: {
            type: Object,
            default: {}
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
