# API Documentation

**Course:** IT-354 | **Group:** 2 | **Date:** 4/29/2026

---

In this course we used two Google APIs, the Google Maps JavaScript API and the Google Calendar API.

The Maps API was added to the homepage for non-authenticated users. It serves two purposes. It displays the tutoring center's location along with available tutor hours, so a student can see when appointments are available. Next if the student decides they are interested in scheduling an appointment, they can enter their location using the integrated Places API search, which provides autocomplete for location lookup. From there, the map calculates directions and travel time to the tutoring center and supports bicycling and public transit route layers for students who do not drive.

The Calendar API was added to the student's dashboard. Because the Calendar API requires access to a user's personal Google account, students are prompted through Google's OAuth 2.0 consent screen to grant the application permission. Once authorized, the student can have any confirmed appointment be synced directly to their Google Calendar. If the student decides to cancel the appointment through the application, the corresponding calendar event is automatically removed as well. This removes the need for the student to manually track their schedule, if their only interaction with the site is booking or cancelling appointments, the application handles the rest.

The Calendar and Maps integrations were intentionally scoped to the student role. We felt since the admins and tutors are employed by the institution, they are the ones most expected to manage their schedules actively through the application itself. Obviously if time permitted we would have looked into connecting them in as well, but the student role made the most sense.
