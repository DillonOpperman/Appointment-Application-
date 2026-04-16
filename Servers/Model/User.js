const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        role: {
            type: String,
            enum: ['student', 'tutor', 'admin'],
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        passwordHash: {
            type: String,
            required: true
        },
        active: {
            type: Boolean,
            default: true
        },
        googleRefreshToken: {
            type: String,
            default: null
        },
        googleAccessToken: {
            type: String,
            default: null
        },
        googleAccountEmail: {
            type: String,
            default: null,
            lowercase: true,
            trim: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
