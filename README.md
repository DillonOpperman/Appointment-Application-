# IT Learning Center Appointment System

Web application for managing tutoring appointments at the IT Learning Center. Node.js + Express + MongoDB, server-rendered with EJS.

## Overview

The system supports three authenticated roles:

- **Student**: browse available tutor slots, book appointments, cancel appointments, view booking history, and optionally sync appointments to Google Calendar.
- **Tutor**: view assigned appointments, cancel booked appointments, record session outcomes/notes and actual start/end times.
- **Admin**: manage users, manage tutor availability blocks, reschedule/cancel any appointment, and review audit/notification logs.

It also includes a public home page that shows upcoming available tutoring slots.

## Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- EJS templates (server-rendered UI)
- JSON Web Tokens (JWT) for auth, stored in HttpOnly cookies
- bcryptjs for password hashing
- express-rate-limit for login throttling
- csurf + cookie-parser for CSRF protection
- Nodemailer (Gmail SMTP) for email notifications
- googleapis for Google Calendar OAuth 2.0 sync

## Features

- Role-based dashboards: student, tutor, admin
- Appointment lifecycle: book, cancel, complete, no-show
- Tutor session notes and actual start/end capture
- Availability blocks with recurring (weekly) and date-specific/blackout exceptions
- Overlap prevention for both tutors and students on booking and rescheduling
- Email notifications: booking confirmations, cancellation notifications, and automated 24-hour reminders (scheduled worker)
- Google Calendar sync: students can optionally connect their Google account to auto-sync booked appointments; cancellations remove the synced event
- Audit logging for administrative, booking, cancellation, and tutor session actions
- Notification logging for outbound email events (sent/failed)
- Rate limiting on all login endpoints
- CSRF protection on every POST form

## Prerequisites

- Node.js 18+
- npm
- MongoDB (local or Atlas)
- Git
- A Google Cloud OAuth client (only required for Google Calendar sync — see below)

## Quick Start

1. Clone the repository:

```bash
git clone https://github.com/DillonOpperman/Appointment-Application-.git
cd Appointment-Application-
```

2. Install dependencies:

```bash
npm install
```

3. Create the environment file from the template:

```bash
cp .env.example .env
```

4. Update `.env` with your values (see Environment Variables section).

5. Start the app:

```bash
npm start
```

Default URL: http://localhost:3001

## Environment Variables

Required values:

```env
PORT=3001
MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=<long-random-secret>
```

Email notifications:

```env
GMAIL_ADMIN=<gmail-address>
GMAIL_APP_PASSWORD=<gmail-app-password>
```

Google Calendar (optional — required only for the student calendar-sync feature):

```env
GOOGLE_CLIENT_ID=<oauth-client-id>
GOOGLE_CLIENT_SECRET=<oauth-client-secret>
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
```

Notes:

- `MONGODB_URI` and `JWT_SECRET` are required at startup.
- If Gmail vars are missing or invalid, email notifications will fail silently (logged to the Notification Log).
- Never commit `.env` to source control.

## Google Calendar Setup

To enable the student Google Calendar sync feature:

1. Add the Google OAuth credentials to your `.env` (values are shared inside the team):

   ```env
   GOOGLE_CLIENT_ID=<shared-client-id>
   GOOGLE_CLIENT_SECRET=<shared-client-secret>
   GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
   ```

2. Start the server and log in as a student account.

3. On the student dashboard, click **Connect Google Calendar**.

   - You may see an "unverified app" warning — click **Advanced → Go to Appointment App (unsafe)** to proceed.
   - You only need to do this once per student account.

4. After connecting, booked appointments will show an **Add to Calendar** button. Cancelling a synced appointment automatically removes it from Google Calendar.

**Tip:** To actually see the sync in Google Calendar, the test student account's email should match a Gmail address you can log into. Have an admin create a student account using your personal Gmail, then sign in as that student.

## Running Locally

On startup the server:

- Connects to MongoDB
- Seeds test users if they don't already exist (skipped when `NODE_ENV=production`)
- Starts a reminder worker that checks upcoming appointments every 15 minutes

## Seeded Test Users

In non-production environments, the app seeds these users on first startup:

- `testuser_admin@example.com` (admin)
- `testuser_tutor@example.com` (tutor)
- `testuser_student@example.com` (student)
- `dlopper@ilstu.edu` (tutor)

## Routes Summary

### API-style auth routes

Mounted under `/api/auth`:

- `POST /api/auth/login`
- `GET /api/auth/me`

### Google OAuth routes

Mounted under `/auth`:

- `GET /auth/google` — starts the OAuth flow for the signed-in student
- `GET /auth/google/callback` — receives the auth code and stores the refresh token

### Page routes

Public / student:

- `GET /home`
- `GET /studentLogin`
- `POST /submitStudentLogin`
- `GET /studentDashboard`
- `POST /student/bookAppointment`
- `POST /student/cancelAppointment/:id`
- `POST /student/addToGoogleCalendar/:appointmentId`
- `POST /student/disconnectGoogleCalendar`

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

Auth / session utility:

- `GET /logout`

## Project Structure

```text
Appointment-Application-/
|-- server.js
|-- package.json
|-- .env.example
|-- Assets/
|   |-- css/
|   |-- JS/
|   `-- images/
|-- Views/
|   |-- Admin/
|   |-- Student/
|   |-- Tutor/
|   |-- Home/
|   `-- Includes/
|-- Servers/
|   |-- Controller/
|   |-- Database/
|   |-- middleware/
|   |-- Model/
|   `-- routes/
`-- scripts/
```

## Security

The application implements the following controls:

- **Authentication**: JWT issued on login, stored in an HttpOnly cookie (`auth_token`).
- **Password handling**: bcrypt hashing (cost factor 12); no plaintext passwords anywhere in the codebase or database.
- **Authorization**: every protected route re-queries the database for the current user's role and `active` status rather than trusting the JWT payload — a deactivated user's existing token stops working immediately.
- **Public registration removed**: only authenticated admins can create accounts. The `/addUser` endpoint rejects any attempt to create `admin` roles via request body tampering.
- **Rate limiting**: all login endpoints (`/submitAdminLogin`, `/submitStudentLogin`, `/submitTutorLogin`, `/api/auth/login`) are throttled to 5 attempts per minute per IP via `express-rate-limit`.
- **CSRF protection**: all POST forms include a CSRF token validated by `csurf` middleware.
- **OAuth state check**: the Google Calendar callback rejects any request whose `state` does not match the signed-in student's user ID, preventing CSRF during OAuth.
- **Conflict prevention**: booking and admin rescheduling both validate tutor overlap and student overlap against the database before committing.
- **Availability block overlap check**: admins cannot create overlapping weekly or date-specific availability blocks for the same tutor.
- **Audit trail**: every admin action (cancel, edit, add user, deactivate user, add/delete availability) and every student/tutor session event is recorded in the `AuditLog` collection.
- **Notification trail**: every outbound email (sent or failed) is recorded in the `NotificationLog` collection.
- **Secrets**: all credentials live in `.env` (gitignored); no secrets are hard-coded.

## Troubleshooting

- **Startup fails with Mongo error**: verify `MONGODB_URI` is set and reachable.
- **Login token errors**: verify `JWT_SECRET` is present and consistent across restarts.
- **Email not sending**: verify `GMAIL_ADMIN` and `GMAIL_APP_PASSWORD`. For Gmail, use an App Password (requires 2FA enabled).
- **Google Calendar "Cannot GET /auth/google"**: verify `authRoutes` is mounted at `/auth` in `server.js`.
- **Google Calendar "Missing required parameter: client_id"**: the three `GOOGLE_*` vars are missing from your `.env`.

AI Tool Usage:
Auth and login

Built JWT login using Http Only cookies with role-based checks that always recheck the database to make sure the user is still active.
Added a global middleware that reads the JWT cookie on every request so we always know who's logged in, plus a shared header that works for all roles.
Helped fix a "login failed" error turned out they were missing JWT_SECRET in .env file.

Database models

Changed appointment comments to use a proper sub-document array with timestamps.
Added student/tutor names directly on Appointment and actor name on AuditLog so the data is readable without extra lookups; also added name to the JWT so controllers can use it.
Added Google-related fields to User and Appointment (calendar event ID, sync timestamp) for Google Calendar support.

Booking logic and professor feedback fixes

Removed the code created student accounts during login now only admins can create users.
Added checks for both tutor and student time conflicts when booking so students can't double book with different tutors.
Added overlap checking when creating availability blocks so admins can't accidentally add conflicting time slots.
Added the same overlap checks to the admin edit appointment flow so rescheduling follows the same rules as booking.

Email system

Built a sendMailWithLog() helper that saves a log entry every time an email is sent (or fails); rewrote all three email functions (booking, cancel, reminder) to use it.
Built an automatic reminder system that sends emails 24 hours before appointments, checks the log so it doesn't send duplicates, and runs every 15 minutes.

Google Calendar integration

Full OAuth 2.0 setup with the googleapis package handles the auth URL, token exchange, grabbing the user's Google email, refreshing tokens, and creating/deleting calendar events. Includes a fallback that finds and deletes events by name and time if the event ID wasn't saved.
Prevents duplicate calendar entries if an appointment is already synced, it skips instead of creating another event.
When a student cancels, the matching Google Calendar event gets deleted too. For older appointments without a saved event ID, it searches by name and time to find the right one.

Admin dashboard features

Edit appointment modal with date/time pickers that enforces the same overlap rules as booking.
Filter and sort bar on the appointments table (by date, student name, course) all done in the browser with no page reload.
Activity Logs tab showing the last 25 audit log and notification log entries with helper functions to turn raw database records into readable text.
Success/error banners after actions like canceling, editing, or adding users.
Made sure every important action (create user, add/delete availability, book, cancel, edit) writes an audit log entry with names and course info.

Data migration

One-time script to convert all availability block times from 24-hour formatto 12-hour format.

Security fixes and cleanup 

Fixed the Google OAuth callback so it rejects requests that are missing the state parameter, not just ones with the wrong value.
Added a check on the add-user route so only student or tutor accounts can be created no one can sneak in an admin role through a manual request. Also added checks for required fields and minimum password length.
Made it so the test/demo accounts only get created in development mode, not in production.
Fixed a bug where canceling an appointment wrote two audit log entries instead of one.
General cleanup: removed duplicate function definitions, old commented-out code, unused route files, and the old HTML files that were replaced by EJS templates.

Verification: team verifier Dillon Opperman.

For the full session-by-session log with dates, prompt summaries, and follow-up changes, see [AI_LOG.md](AI_LOG.md).

## License

This project is licensed under the terms in [LICENSE](LICENSE).
