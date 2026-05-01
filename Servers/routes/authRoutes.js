const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../Model/User');
const { authenticateJWT, authenticatePageJWT, authorizeRoles } = require('../middleware/auth');
const { getAuthUrl, getTokensFromCode, getGoogleAccountEmail } = require('../middleware/googleCalendar');

const router = express.Router();

router.post(
    '/login',
    [
        body('email').isEmail().withMessage('Valid email is required.'),
        body('password').notEmpty().withMessage('Password is required.')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        try {
            const user = await User.findOne({ email: email.toLowerCase() });
            if (!user || !user.active) {
                return res.status(401).json({ message: 'Invalid credentials.' });
            }

            const isMatch = await bcrypt.compare(password, user.passwordHash);
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid credentials.' });
            }

            const token = jwt.sign(
                { id: user._id, name: user.name, email: user.email, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            return res.status(200).json({
                message: 'Login successful.',
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });
        } catch (error) {
            return res.status(500).json({ message: 'Login failed.', error: error.message });
        }
    }
);

router.get('/me', authenticateJWT, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-passwordHash -googleAccessToken -googleRefreshToken');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        return res.status(200).json({ user });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch user.', error: error.message });
    }
});

// Google OAuth routes
router.get('/google', authenticatePageJWT, authorizeRoles('student'), (req, res) => {
    const authUrl = getAuthUrl(req.user.id);
    res.redirect(authUrl);
});

router.get('/google/callback', authenticatePageJWT, authorizeRoles('student'), async (req, res) => {
    try {
        const { code, error, state } = req.query;

        if (error) {
            return res.redirect(`/studentDashboard?error=${error}`);
        }

        if (!code) {
            return res.redirect('/studentDashboard?error=no_auth_code');
        }

        // Get tokens from Google
        const tokens = await getTokensFromCode(code);

        // Find or create user based on current session
        const studentId = req.user?.id;
        if (!studentId) {
            return res.redirect('/studentLogin?error=not_authenticated');
        }

        if (state || String(state) !== String(studentId)) {
            return res.redirect('/studentDashboard?error=oauth_state_mismatch');
        }

        const student = await User.findById(studentId);
        if (!student) {
            return res.redirect('/studentLogin?error=user_not_found');
        }

        // Google only returns a refresh token on first consent unless prompt=consent is used.
        student.googleRefreshToken = tokens.refresh_token || student.googleRefreshToken;
        student.googleAccessToken = tokens.access_token;

        if (tokens.access_token) {
            const capturedEmail = await getGoogleAccountEmail(tokens.access_token);
            student.googleAccountEmail = capturedEmail || student.googleAccountEmail;
        }

        await student.save();

        res.redirect('/studentDashboard?google_connected=1');
    } catch (error) {
        console.error('Google OAuth callback error:', error);
        res.redirect('/studentDashboard?error=oauth_failed');
    }
});

module.exports = router;
