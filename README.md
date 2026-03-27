# IT Learning Center Appointment System

Web application for managing tutoring appointments at the IT Learning Center. This project is currently built as a Node.js + Express server-rendered app using EJS templates and MongoDB.

## Overview

The system supports three authenticated roles:

- Student: browse available tutor slots, book appointments, cancel appointments, and view booking history.
- Tutor: view assigned appointments, cancel booked appointments, and record session outcomes/notes.
- Admin: manage users, manage tutor availability blocks, reschedule/cancel appointments, and review audit/notification logs.

It also includes a public home page that shows upcoming available tutoring slots.

## Current Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- EJS templates (server-rendered UI)
- JSON Web Tokens (JWT) for auth
- bcryptjs for password hashing
- Nodemailer (Gmail SMTP) for email notifications

## Features

- Role-based dashboards: student, tutor, admin
- Appointment lifecycle: book, cancel, complete, no-show
- Tutor session notes and actual start/end capture
- Availability blocks with recurring and exception/blackout support
- Email notifications:
  - Booking confirmations
  - Cancellation notifications
  - Automated reminders for upcoming appointments (scheduled worker)
- Audit logging for administrative and session actions
- Notification logging for outbound email events

## Prerequisites

- Node.js 18+ recommended
- npm
- MongoDB (local or Atlas)
- Git

## Quick Start

1. Clone the repository:

```bash
git clone https://github.com/DillonOpperman/Appointment-Application-.git
cd Appointment-Application-
```

2. Install dependencies from the project root:

```bash
npm install
```

3. Create environment file from template:

```bash
cp .env.example .env
```

4. Update `.env` values (see Environment Variables section).

5. Start the app:

```bash
npm start
```

For development with automatic restart:

```bash
npm run dev
```

Default app URL: http://localhost:3001

## Environment Variables

Required values are defined in `.env.example`:

```env
PORT=3001
MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=<long-random-secret>
```

Additional variables used for email notifications:

```env
GMAIL_ADMIN=<gmail-address>
GMAIL_APP_PASSWORD=<gmail-app-password>
```

Notes:

- `MONGODB_URI` is required at startup.
- If Gmail vars are missing/invalid, booking/cancellation/reminder emails will fail.
- Never commit `.env` to source control.

## Running Locally

1. Ensure MongoDB is available (local instance or Atlas).
2. Ensure `.env` is configured.
3. Run:

```bash
npm start
```

On startup the server:

- Connects to MongoDB
- Seeds test users if missing
- Starts a reminder worker that checks upcoming appointments every 15 minutes

## Seeded Test Users

On first successful startup, the app seeds these users (if they do not already exist):

- `testuser_admin@example.com` (admin)
- `testuser_tutor@example.com` (tutor)
- `testuser_student@example.com` (student)
- `dlopper@ilstu.edu` (tutor)

## Routes Summary

### API-style auth routes

Mounted under `/api/auth`:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Page routes

Public/student:

- `GET /home`
- `GET /studentLogin`
- `POST /submitStudentLogin`
- `GET /studentDashboard`
- `POST /student/bookAppointment`
- `POST /student/cancelAppointment/:id`

Tutor:

- `GET /tutorLogin`
- `POST /submitTutorLogin`
- `GET /tutorDashboard`
- `POST /tutor/cancelAppointment/:id`
- `POST /tutor/appointment/:id/session`

Admin:

- `GET /adminLogin`
- `POST /submitAdminLogin`
- `GET /adminDashboard`
- `POST /cancelAppointment/:id`
- `POST /admin/appointment/edit/:id`
- `POST /admin/availability`
- `POST /admin/availability/delete/:id`
- `POST /addUser`
- `POST /toggleUserActive/:id`

Auth/session utility:

- `GET /logout`

## Project Structure

```text
Appointment-Application-/
|-- server.js
|-- package.json
|-- .env.example
|-- Assets/
|   |-- CSS/
|   |-- JS/
|   `-- images/
|-- Views/
|   |-- Admin/
|   |-- Student/
|   |-- Tutor/
|   |-- Home/
|   |-- Includes/
|   `-- html/
|-- Servers/
|   |-- Controller/
|   |-- Database/
|   |-- middleware/
|   |-- Model/
|   `-- routes/
`-- scripts/
```

## Security Notes

- Passwords are stored as bcrypt hashes.
- JWT tokens are issued at login and stored in an `HttpOnly` cookie (`auth_token`).
- Role checks are enforced in route middleware.

## Troubleshooting

- Startup fails with Mongo error:
  - Verify `MONGODB_URI` is set and reachable.
- Login token errors:
  - Verify `JWT_SECRET` is present and consistent.
- Email not sending:
  - Verify `GMAIL_ADMIN` and `GMAIL_APP_PASSWORD`.
  - For Gmail, use an app password (2FA enabled).

## Development Notes

- Main entry point: `server.js`
- Static assets are served from `/assets`
- EJS views are loaded from `Views/`
- Reminder worker runs automatically in-process after startup

## License

This project is licensed under the terms in [LICENSE](LICENSE).
