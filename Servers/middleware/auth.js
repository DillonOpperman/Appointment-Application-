const jwt = require('jsonwebtoken');
const User = require('../Model/User');

function parseCookieHeader(cookieHeader = '') {
    const cookies = {};
    cookieHeader.split(';').forEach((entry) => {
        const [rawName, ...rawValue] = entry.trim().split('=');
        if (!rawName) {
            return;
        }
        cookies[rawName] = decodeURIComponent(rawValue.join('='));
    });
    return cookies;
}

function getTokenFromRequest(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.split(' ')[1];
    }

    const cookies = parseCookieHeader(req.headers.cookie || '');
    return cookies.auth_token;
}

function authenticateJWT(req, res, next) {
    const token = getTokenFromRequest(req);
    if (!token) {
        return res.status(401).json({ message: 'Missing authentication token.' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        return next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
}

function authenticatePageJWT(req, res, next) {
    const token = getTokenFromRequest(req);
    if (!token) {
        return res.redirect('/home');
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        return next();
    } catch (error) {
        return res.redirect('/home');
    }
}

function authorizeRoles(...allowedRoles) {
    const normalizedAllowedRoles = allowedRoles.map((role) => String(role).toLowerCase());

    return async (req, res, next) => {
        if (!req.user || !req.user.id) {
            return res.status(403).send('Forbidden');
        }

        const tokenRole = String(req.user.role || '').toLowerCase();
        if (normalizedAllowedRoles.includes(tokenRole)) {
            return next();
        }

        try {
            const currentUser = await User.findById(req.user.id).select('role active');
            if (!currentUser || !currentUser.active) {
                return res.status(403).send('Forbidden');
            }

            const dbRole = String(currentUser.role || '').toLowerCase();
            if (!normalizedAllowedRoles.includes(dbRole)) {
                return res.status(403).send('Forbidden');
            }

            req.user.role = dbRole;
            return next();
        } catch (error) {
            return res.status(403).send('Forbidden');
        }
    };
}

module.exports = {
    authenticateJWT,
    authenticatePageJWT,
    authorizeRoles
};
