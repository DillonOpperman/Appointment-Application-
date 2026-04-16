const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
);

// Generate the OAuth URL for user to authorize
function getAuthUrl(state) {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: true,
        scope: [
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/userinfo.email'
        ],
        state
    });
}

// Exchange auth code for tokens
async function getTokensFromCode(code) {
    try {
        const { tokens } = await oauth2Client.getToken(code);
        return tokens;
    } catch (err) {
        console.error('Error getting tokens from code:', err);
        throw err;
    }
}

async function getGoogleAccountEmail(accessToken) {
    try {
        oauth2Client.setCredentials({ access_token: accessToken });
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });

        const profile = await oauth2.userinfo.get();
        return profile?.data?.email || null;
    } catch (err) {
        console.error('Error getting Google account email:', err.message);
        return null;
    }
}

// Set credentials and refresh access token if needed
async function setCredentialsAndRefresh(refreshToken) {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    try {
        const accessTokenResponse = await oauth2Client.getAccessToken();
        return accessTokenResponse.token;
    } catch (err) {
        console.error('Error refreshing access token:', err);
        throw err;
    }
}

// Add event to Google Calendar
async function addEventToCalendar(refreshToken, event) {
    try {
        // Refresh the access token
        const accessToken = await setCredentialsAndRefresh(refreshToken);
        oauth2Client.setCredentials({
            refresh_token: refreshToken,
            access_token: accessToken
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const eventBody = {
            summary: event.summary,
            description: event.description,
            start: {
                dateTime: event.start.toISOString(),
                timeZone: 'America/Chicago'
            },
            end: {
                dateTime: event.end.toISOString(),
                timeZone: 'America/Chicago'
            }
        };

        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: eventBody
        });

        return {
            success: true,
            eventId: response.data.id,
            eventLink: response.data.htmlLink
        };
    } catch (err) {
        console.error('Error adding event to Google Calendar:', err.message);
        throw err;
    }
}

// Remove event from Google Calendar
async function deleteEventFromCalendar(refreshToken, eventId) {
    try {
        if (!eventId) {
            return { success: false, skipped: true };
        }

        const accessToken = await setCredentialsAndRefresh(refreshToken);
        oauth2Client.setCredentials({
            refresh_token: refreshToken,
            access_token: accessToken
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        await calendar.events.delete({
            calendarId: 'primary',
            eventId
        });

        return { success: true };
    } catch (err) {
        console.error('Error deleting event from Google Calendar:', err.message);
        return { success: false, error: err.message };
    }
}

// Fallback deletion when eventId is missing: find matching events by summary and time window.
async function deleteMatchingEventsFromCalendar(refreshToken, event) {
    try {
        const accessToken = await setCredentialsAndRefresh(refreshToken);
        oauth2Client.setCredentials({
            refresh_token: refreshToken,
            access_token: accessToken
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const start = new Date(event.start);
        const end = new Date(event.end);

        // Small buffer to account for any timezone serialization drift.
        const timeMin = new Date(start.getTime() - 10 * 60 * 1000).toISOString();
        const timeMax = new Date(end.getTime() + 10 * 60 * 1000).toISOString();

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin,
            timeMax,
            singleEvents: true,
            maxResults: 50
        });

        const items = response?.data?.items || [];
        const targetStartIso = start.toISOString();
        const targetSummary = String(event.summary || '').trim();

        const matches = items.filter((item) => {
            const itemSummary = String(item.summary || '').trim();
            const itemStart = item?.start?.dateTime ? new Date(item.start.dateTime).toISOString() : null;
            return itemSummary === targetSummary && itemStart === targetStartIso;
        });

        for (const match of matches) {
            await calendar.events.delete({
                calendarId: 'primary',
                eventId: match.id
            });
        }

        return { success: true, deletedCount: matches.length, deletedIds: matches.map((m) => m.id) };
    } catch (err) {
        console.error('Error deleting matching events from Google Calendar:', err.message);
        return { success: false, deletedCount: 0, error: err.message };
    }
}

module.exports = {
    getAuthUrl,
    getTokensFromCode,
    addEventToCalendar,
    getGoogleAccountEmail,
    deleteEventFromCalendar,
    deleteMatchingEventsFromCalendar
};
