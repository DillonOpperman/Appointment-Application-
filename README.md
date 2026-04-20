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

## AI Use

GitHub Copilot Chat was used for selected implementation and maintenance tasks.

AI-assisted parts:
- App setup and run steps (Feb 19): identified Node.js/Express stack, provided install/start commands, bypassed PowerShell execution-policy issue.
- Tutor folder and login page (Feb 19): created `htmlFiles/tutuor/TutorPage.html` matching the style of the student and admin login pages.
- Tutor server routes (Feb 19): added `GET /tutorLogin` and `POST /submitTutorLogin` to `server.js`; fixed stray space in the admin file path.
- Project structure migration to Stefan-style folders (`Assets`, `Servers`, `Views`) and path updates.
- Auth/database integration tasks (Atlas connection wiring, bcrypt/JWT route support, middleware and model path updates).
- Tutor/admin UI and navigation fixes (theme links, dashboard text visibility, route/nav corrections).
- Git workflow assistance for branch sync, test-run checks, and push operations.
- Tutor feature implementation (appointments tab, availability/blackout block create-delete flow, tutor-scoped route/controller wiring).
- Security hardening for page auth (JWT `HttpOnly` cookie flow, role-based middleware guards, logout cookie clearing, protected route checks).
- Seed-user automation for demo/test accounts (`testuser_admin`, `testuser_tutor`, `testuser_student`) and startup verification.
- Presentation documentation assistance (Mar 17): file-by-file code explanations, CRUD/RBAC/data-layer mapping, and professor Q&A preparation notes. No code was changed during these sessions.
- Audit log enhancement (Mar 17): updated `cancelAppointment` to populate and store student and tutor emails in AuditLog `metadata` for traceability.
- Admin appointment editing (Mar 17): added `editAppointment` controller, route (`POST /admin/appointment/edit/:id`), Edit button alongside Cancel in the appointments table, and a modal with datetime-local inputs and client-side pre-fill JS.
- Tutor view hardening (Mar 17): removed Cancel button and Action column from tutor dashboard; tutor appointments view is now fully read-only.
- Admin appointment filter bar (Mar 17): added client-side filter dropdowns (Date newest/oldest, Student A→Z/Z→A, Course) with a Clear button above the admin appointments table; no server round-trip required.
- Git sync and app run verification (Mar 18): fetched and fast-forward pulled `origin/main` (commit `486a185`); diagnosed PowerShell execution-policy issue and switched to `npm.cmd`; reinstalled 65 packages after pull-triggered `node_modules` loss; confirmed server boot (`MongoDB connected`, port 3001) and clean shutdown.
- Teammate onboarding and login debugging (Mar 18): generated teammate-specific `MONGODB_URI` and full `.env` template using existing cluster/DB; diagnosed "login failed" error by tracing `adminController.submitLogin`, JWT middleware, and `User` model; identified missing `JWT_SECRET` as root cause; provided exact `.env` fix. Server seed changes were explored but reverted — resolved purely via `.env` correction.
- Automated email planning (Mar 18): recommended Nodemailer + Gmail App Password for booking confirmation emails; outlined install step, required `.env` vars, `mailer.js` utility design, and `studentController.js` integration point. Implementation deferred to a future session.
- App run, main pull, and email wiring (Mar 19): launched app via `node server.js` bypassing PowerShell execution-policy block; fetched and fast-forward pulled `origin/main` (2 commits — new `emailService.js` and merged stefan/admin-mvc PR); installed `nodemailer` after confirming it was added to `package.json` by the pull; added `GMAIL_ADMIN` and `GMAIL_APP_PASSWORD` to root `.env`; updated `.env.example` with placeholder entries for both vars; restarted server and verified booking confirmation email sent successfully.
- 12-hour time format migration (Mar 19): updated all `toLocaleString()` calls across four EJS views to use `{ hour12: true }`; created and ran a one-time migration script (`scripts/migrateAvailabilityTimesTo12h.js`) to reformat 5 existing MongoDB AvailabilityBlock documents from HH:mm to h:mm AM/PM.
- Requirements compliance audit (Mar 19): reviewed all four role sections of the project rubric against the codebase; identified missing student cancel endpoint, unwired cancellation emails, and absent reminder emails as the only gaps. No code changes — findings used to drive next tasks.
- Cancellation email wiring (Mar 19): imported and called `sendCancellationConfirmation` in both `adminController.js` and `tutorController.js` cancel handlers; both now populate student and tutor names/emails and fire the email after a successful DB update.
- Appointment reminder worker (Mar 19): added `sendAppointmentReminder()` to `emailService.js`; added `sendUpcomingAppointmentReminders()` and `startReminderWorker()` (15-minute interval, deduplication via `NotificationLog`) to `server.js`; worker fires immediately on startup.
- Branch management and Stefan student dashboard merge (Mar 19): pulled `origin/main` (Rudra's PR #11), reverted it locally, then fetched and merged Stefan's new commit `0251b6f` which added the full student dashboard view (`Views/Student/dashboard.ejs`), booking, and cancellation routes/controller logic; pushed result to `origin/Dillon`.
- Appointment audit logging (Mar 19): added `AuditLog` import to `studentController.js`; wired audit log entries for both `book_appointment` and `cancel_appointment` actions, capturing actor (student), target appointment ID, tutor ID, course, and time window — ensures every booking and cancellation is traceable in the database.
- Git push to Dillon branch (Mar 19): committed audit-logging changes, pulled remote Dillon to resolve ahead/behind state, and pushed final result to `origin/Dillon`.
- Logout flow (Mar 20): centralized `/logout` route in `server.js` (clears `auth_token` cookie, redirects to `/home`); removed duplicate logout from `tutorRoutes.js`; added global JWT-decoding middleware in `server.js` so `res.locals.currentUser` is always populated from the cookie.
- Role-aware shared header (Mar 20): rewrote `Views/Includes/_header.ejs` to show Dashboard + Logout when authenticated and the Sign-in link when guest; reads user identity from multiple fallback sources (`res.locals.currentUser`, template `user` variable, `activeTab` context detection); added explicit `currentUser` pass-through in `adminController.showDashboard`.
- Add-user UX fix (Mar 20): traced the "new user not appearing" issue to a silent redirect to the Appointments tab after save; all `/addUser` outcomes now redirect to `?tab=users` with human-readable `notice` and `noticeType` query params (success, duplicate warning, validation error).
- Comprehensive logs audit and readable-names overhaul (Mar 20): audited all four collections end-to-end; added helper functions (`buildAuditLogEntries`, `summarizeAuditLog`, `summarizeNotificationLog`, `formatDateTime`, `formatAppointmentLabel`, `formatAvailabilityLabel`) to `adminController.js`; enriched every `AuditLog.create()` call with `studentName`, `tutorName`, `course`; added previously missing audit events (`createUser`, `addAvailability`, `deleteAvailability`); added `recipientName` field to `NotificationLog` schema; rewrote all three email-send functions in `emailService.js` to use a `sendMailWithLog()` wrapper that logs start, success, and failure with readable summaries.
- Admin Activity Logs tab (Mar 20): added a `logs` sidebar button and full tab section in `Views/Admin/dashboard.ejs`; tab contains two tables — Audit Log (Time, Actor, Action, Target, Summary) and Notification Log (Time, Event, Recipient, Status badge, Summary) — populated from the last 25 entries of each collection per page load.
- Named appointment action banners (Mar 20): `cancelAppointment` and `editAppointment` redirects now include the student and tutor names in the `notice` query param; appointments tab in `dashboard.ejs` now renders the banner (matching the existing hours/users tab pattern).
- Denormalized names in MongoDB documents (Mar 20): added `studentName` and `tutorName` string fields to the `Appointment` schema and `actorName` to the `AuditLog` schema so Atlas shows readable names alongside ObjectId refs; added `name` to the JWT payload in all four sign locations so `req.user.name` is available in every controller; populated all new fields at create time across all three controllers.
- Git push — tracked file changes (Mar 21): staged and committed 12 modified files (controllers, routes, models, middleware, views, `server.js`) as "Update controllers, routes, models, and dashboard changes" (commit `74ed481`); pushed to `origin/Dillon`.
- `.gitignore` cookie exclusion (Mar 21): appended `admincookies.txt`, `cookies.txt`, and `studentcookies.txt` to `.gitignore` so local session files are never tracked; committed (commit `3d1f895`) and pushed to `origin/Dillon`.
- README rewrite (Mar 27): rewrote README from scratch to reflect the actual Express+EJS architecture, real routes, correct env vars (`GMAIL_ADMIN`, `GMAIL_APP_PASSWORD`), seeded test users, and folder structure. Verified by Dillon.
- Git merge workflow and conflict resolution (Mar 27): merged Dillon into main (resolved two-file conflict: kept rewritten README, kept Dillon's studentController); diagnosed and fixed two post-merge startup bugs (duplicate `AuditLog` import in `studentController.js`, broken route handlers in `studentRoutes.js`). Verified by Dillon.
- Branch sync and cleanup (Mar 27): moved fixes onto Dillon branch via stash/apply; resolved leftover stash conflict markers in `studentRoutes.js`; merged main back into Dillon (commit `fe51ffd`) resolving studentRoutes conflict by retaining Dillon's modern handlers. Verified by Dillon.
- HTTP route testing (Mar 27): ran full `Invoke-WebRequest` test suite against `localhost:3001` covering 12 routes (public pages, auth API login for all three roles, protected dashboard redirects, wrong-password rejection). All tests passed both before and after the main-into-Dillon merge. Verified by Dillon.
- App run (Apr 9): read `package.json` to confirm available scripts; attempted `npm run dev` — blocked by PowerShell execution-policy restriction on `npm.ps1`; switched to `node server.js` directly; confirmed MongoDB connected and server on port 3001. Verified by Dillon.
- Audit/notification log display fix (Apr 16): mapped raw Mongoose docs in `adminController.js` to `actorDisplayName`, `targetLabel`, and `summary` fields for the admin Audit Log table; mapped `recipientDisplayName` and `summary` (derived from `providerResponse.messageId`) for the Notification Log table so readable names appear instead of ObjectId strings. Verified by Dillon.
- Google Calendar OAuth integration (Apr 16): added full OAuth 2.0 flow using the `googleapis` npm package (scopes: `calendar.events`, `userinfo.email`); created `Servers/middleware/googleCalendar.js` with helper functions for auth URL generation, token exchange, email lookup, event creation, and event deletion; extended the `User` model with `googleRefreshToken`, `googleAccessToken`, and `googleAccountEmail`; extended the `Appointment` model with `googleCalendarEventId` and `googleCalendarSyncedAt`; added `/auth/google` and `/auth/google/callback` routes to `authRoutes.js`; added `/student/addToGoogleCalendar/:appointmentId` and `/student/disconnectGoogleCalendar` POST routes to `studentRoutes.js`; mounted `authRoutes` at `/auth` in `server.js`; updated `studentController.showDashboard` to pass `googleConnected` and `googleAccountEmail` to the view; updated `Views/Student/dashboard.ejs` with a Connect banner (when not connected), a Disconnect button with connected-account email display (when connected), an Add to Calendar button for unsynced booked appointments, a synced badge for already-synced appointments, and client-side JS for both actions. Fixed "Cannot GET /auth/google" by also mounting `authRoutes` at `/auth` in `server.js`. Verified by Dillon.
- Google Calendar deep-link fix and email capture (Apr 16): switched from Google Calendar event deep-links to the calendar home URL (`calendar.google.com/calendar/u/0/r?authuser=...`) to avoid multi-account browser "could not find event" errors; added `userinfo.email` to OAuth scopes so the connected account email is captured reliably at callback time and stored on the user record. Verified by Dillon.
- Google Calendar duplicate prevention and cancellation sync (Apr 16): added `alreadySynced` check to the `addToGoogleCalendar` route — returns early without creating a new event if `googleCalendarEventId` is already set on the appointment; dashboard now shows a synced badge instead of the Add to Calendar button for already-synced appointments; page reloads after a successful add; wired `cancelAppointment` in `studentController.js` to call `deleteEventFromCalendar` (using the stored `eventId`) or a `deleteMatchingEventsFromCalendar` fallback (matches by event title and time window for older records that predate the stored-ID feature). Removed temporary debug scripts and `server.log`. Verified by Dillon.
- Git push — Google Calendar feature (Apr 16): staged and committed 10 files as "Add Google Calendar OAuth sync and cancellation integration" (commit `fe02379`); pushed to `origin/Dillon`; 10 files changed, 745 insertions. Verified by Dillon.
- AI documentation update (Apr 20): read both `AI_LOG.md` and `README.md` in full to understand existing entries and established theme; appended Apr 9 and Apr 20 log rows to `AI_LOG.md`; appended matching AI Use bullet points to `README.md`; updated session-dates summary line. No code changed. Verified by Dillon.

Verification:
- Teammate verifier: Dillon Opperman.
- Verification method: manual route smoke tests, login/cookie checks, and dashboard action checks during team demo prep.

Session dates covered in this project log (excluding today): Feb 19, Mar 9, Mar 10, Mar 12, Mar 16, Mar 17, Mar 18, Mar 19, Mar 20, Mar 21, Mar 27, Apr 9, Apr 16, and Apr 20, 2026.

For date-by-date details (tool, prompt summary, output, and follow-up changes), see [AI_LOG.md](AI_LOG.md).

## License

This project is licensed under the terms in [LICENSE](LICENSE).
