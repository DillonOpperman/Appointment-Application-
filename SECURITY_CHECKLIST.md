# Security Checklist

**Course:** IT-354 | **Group:** 2 | **Date:** 4/29/2026

---

**Password Hashing**
Passwords are hashed using bcrypt with a salt round of 12 before being stored in the database. Plain-text passwords are not saved.
Location: adminController.js (addUser), server.js (seed accounts)

**JWT Authentication**
All protected routes require a valid signed JSON Web Token. Tokens are verified against a secret stored in environment variables.
Location: auth.js

**Role-Based Access Control**
Routes are restricted by user role (admin, tutor, student). A user cannot access pages or perform any actions outside of their assigned role.
Location: auth.js, adminRoutes.js, studentRoutes.js, tutorRoutes.js

**CSRF Protection**
Cross Site Request Forgery protection is enabled using the csurf middleware. A CSRF token is generated and injected into every rendered view.
Location: server.js

**Login Rate Limiting**
Login endpoints are limited to 5 attempts per minute per IP using express-rate-limit. This protects against brute-force attacks.
Location: server.js (applied to all three login routes and the API login endpoint)

**Account Lockout**
All three login controllers track failed attempts in the database. After 5 consecutive failed logins the account is hard-locked and cannot authenticate until an admin resets it. This works independently of the IP-based rate limiter.
Location: adminController.js, studentController.js, tutorController.js

**HttpOnly and SameSite Cookies**
The auth token cookie is set with HttpOnly and SameSite=Lax flags, preventing client-side JavaScript from reading it.
Location: server.js logout route, auth controllers at login

**Secrets in Environment Variables**
All sensitive credentials including the JWT secret, database URI, Google OAuth keys, and Gmail credentials are stored in a .env file and not hardcoded in the source.
Location: server.js (dotenv loaded at startup), process.env used throughout

**Sensitive Field Exclusion**
Password hashes and Google OAuth tokens are excluded when returning user data from the database to the client.
Location: authRoutes.js

**Input Normalization and Schema Validation**
Emails are stored lowercase and trimmed. Mongoose schemas enforce required fields, data types, and enum constraints on all models.
Location: User.js and all models under Model

**Audit Logging**
Administrative actions are recorded with a timestamp and the associated user for accountability.
Location: AuditLog.js, adminController.js

**OAuth 2.0 for Google Calendar Access**
The Calendar integration uses OAuth 2.0 with offline refresh tokens. Users must grant explicit consent through Google's consent screen before the app can access their calendar.
Location: googleCalendar.js, authRoutes.js

