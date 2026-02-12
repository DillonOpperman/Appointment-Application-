# IT Learning Center Appointment System

A full-stack MEAN (MongoDB, Express, Angular/React, Node.js) web application for managing tutoring appointments at the IT Learning Center.

##  Table of Contents
- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Security](#security)
- [External APIs](#external-apis)


##  Project Overview

The IT Learning Center Appointment System is designed to streamline the process of booking tutoring sessions for students and managing tutor availability. The system reduces time waste by providing a clear, accessible platform for scheduling and managing appointments.

### Key Objectives
- Enable students to easily book tutoring appointments
- Allow tutors to manage their schedules and track sessions
- Provide administrators with tools to oversee operations and manage users
- Send automated email confirmations and reminders
- Maintain audit trails for administrative actions

##  Features

### For Students (Authenticated)
-  View tutoring hours and available time slots
-  Book appointments for IT 179 (and other supported courses)
-  Cancel appointments (with defined rules)
-  Receive email confirmations for bookings and cancellations

### For Tutors (Authenticated)
-  View appointments during their assigned working hours
-  Add comments and notes to tutoring sessions
-  Mark student no-shows
-  Record actual session start and end times

### For Administrators (Authenticated)
-  Cancel any appointment with audit trail
-  Manage tutoring hours, availability, and blackout dates
-  View and filter all appointments (by date, student, course)
-  Add, activate, and deactivate tutors and students
-  Assign tutor working hours
-  Receive email confirmations and reminders

### For Public Users (Non-Authenticated)
-  View general tutoring hours and center information

##  Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **Nodemailer** - Email service integration

### Frontend
- **[Angular/React/Vue]** - Frontend framework (TBD)
- **HTML5/CSS3** - Markup and styling
- **JavaScript/TypeScript** - Programming language

### Security & Middleware
- **express-validator** - Input validation
- **express-rate-limit** - Rate limiting
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment variable management

### External APIs
- **Email Service** - Nodemailer/SendGrid for confirmations
- **[Additional API]** - [Google Calendar/Twilio SMS/etc.] (TBD)

##  Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v16.x or higher) - [Download here](https://nodejs.org/)
- **MongoDB** (v5.x or higher) - [Download here](https://www.mongodb.com/try/download/community)
- **Git** - [Download here](https://git-scm.com/downloads)
- **npm** (comes with Node.js) or **yarn**

##  Installation

### 1. Clone the Repository
```bash
git clone https://github.com/DillonOpperman/Appointment-Application-.git
cd Appointment-Application-
```

### 2. Switch to Develop Branch
```bash
git checkout develop
```

### 3. Install Server Dependencies
```bash
cd server
npm install
```

### 4. Install Client Dependencies
```bash
cd ../client
npm install
```

### 5. Set Up Environment Variables
```bash
cd ../server
cp .env.example .env
```

Now edit the `.env` file with your actual credentials (see [Environment Variables](#environment-variables) section).

##  Environment Variables

Create a `.env` file in the `server/` directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/it-learning-center
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/it-learning-center

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_here_change_this
JWT_EXPIRE=7d

# Email Service
EMAIL_SERVICE=gmail
EMAIL_USER=your.email@gmail.com
EMAIL_PASSWORD=your_app_specific_password

# External APIs (add as needed)
GOOGLE_CALENDAR_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
```

### Getting Email Credentials (Gmail)
1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Generate an App Password: [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
4. Use this app password in `EMAIL_PASSWORD`

 **IMPORTANT**: Never commit your `.env` file to GitHub! It's already in `.gitignore`.

##  Running the Application

### Development Mode

**Terminal 1 - Start MongoDB** (if running locally):
```bash
mongod
```

**Terminal 2 - Start Backend Server**:
```bash
cd server
npm run dev
# Server runs on http://localhost:3000
```

**Terminal 3 - Start Frontend**:
```bash
cd client
npm start
# Client runs on http://localhost:4200 (Angular) or http://localhost:3000 (React)
```

### Testing the Application
1. Open your browser to the client URL
2. You should see the landing page
3. Register a new account or use test credentials (if seeded)

##  Project Structure

```
Appointment-Application/
├── client/                      # Frontend application
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/     # UI components
│   │   │   ├── services/       # API services
│   │   │   ├── guards/         # Route guards
│   │   │   └── models/         # TypeScript interfaces
│   │   ├── assets/             # Images, styles
│   │   └── environments/       # Environment configs
│   └── package.json
│
├── server/                      # Backend application
│   ├── src/
│   │   ├── controllers/        # Request handlers
│   │   ├── models/             # Database schemas
│   │   ├── routes/             # API routes
│   │   ├── middleware/         # Auth, validation, rate limiting
│   │   ├── services/           # Email, external APIs
│   │   ├── config/             # Database connection
│   │   └── utils/              # Helper functions
│   ├── .env.example            # Environment template
│   └── package.json
│
├── docs/                        # Documentation
│   ├── wireframes/             # UI mockups
│   ├── schema/                 # Database schema
│   ├── api-documentation.md    # API endpoints
│   ├── security-checklist.md   # Security controls
│   └── ai-usage-log.md         # AI assistance log
│
├── .gitignore                   # Git ignore rules
└── README.md                    # This file
```

##  API Documentation

See [docs/api-documentation.md](docs/api-documentation.md) for detailed API endpoint documentation.

### Base URL
```
http://localhost:3000/api
```

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Appointment Endpoints
- `GET /api/appointments` - Get all appointments (filtered by role)
- `POST /api/appointments` - Book new appointment
- `DELETE /api/appointments/:id` - Cancel appointment
- `PATCH /api/appointments/:id` - Update appointment (tutor comments, etc.)

### Availability Endpoints
- `GET /api/availability` - Get tutoring hours
- `POST /api/availability` - Create availability block (admin)
- `PATCH /api/availability/:id` - Update availability (admin)

### User Management Endpoints (Admin)
- `GET /api/users` - Get all users
- `POST /api/users` - Create user
- `PATCH /api/users/:id` - Activate/deactivate user

##  Security

This application implements the following security controls:

### Authentication & Authorization
-  JWT-based authentication
-  Role-based access control (admin, tutor, student)
-  Protected routes requiring valid tokens

### Data Security
-  Password hashing with bcrypt (salt rounds: 10)
-  No plain-text password storage
-  Environment variables for sensitive data
-  Secrets management (never committed to GitHub)

### Input Validation & Sanitization
-  Server-side validation on all inputs
-  express-validator for request validation
-  MongoDB injection prevention

### Rate Limiting
-  Rate limiting on authentication endpoints (5 attempts per 15 minutes)
-  Rate limiting on booking endpoints (10 bookings per hour)
-  Rate limiting on cancellation endpoints

### Audit & Logging
-  Audit trail for all admin actions
-  Notification logs for emails sent
-  Timestamp tracking on all database records

See [docs/security-checklist.md](docs/security-checklist.md) for detailed security verification.

##  External APIs

### Email Service (Nodemailer)
- **Purpose**: Send booking confirmations and cancellation notifications
- **Provider**: Gmail SMTP / SendGrid
- **Integration**: Triggered on appointment create/cancel actions

### [Additional API - TBD]
Options being considered:
- **Google Calendar API** - Sync appointments to admin calendar
- **Twilio SMS** - Send SMS reminders to students
- **Holiday API** - Auto-block appointments on holidays
- **reCAPTCHA** - Prevent booking abuse

### Branching Strategy
- `main` - Production-ready code (protected)
- `develop` - Integration branch
- `feature/feature-name` - New features
- `bugfix/bug-name` - Bug fixes

### Workflow
1. Always pull latest changes from `develop`
2. Create a new feature branch: `git checkout -b feature/your-feature`
3. Make your changes and commit with meaningful messages
4. Push to GitHub: `git push origin feature/your-feature`
5. Create a Pull Request to `develop`
6. Wait for at least one teammate review and approval
7. Merge after approval

### Commit Message Guidelines
- Use present tense: "Add feature" not "Added feature"
- Be descriptive: "Add email validation to booking form"
- Reference issues when applicable: "Fix #123: Resolve booking overlap"

---

---

**Last Updated**: 2/12/2026
**Checkpoint Status**:  In Progress 
