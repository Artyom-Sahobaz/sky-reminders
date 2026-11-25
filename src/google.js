// Google sign-in + Google Calendar API (read-only). Works for Gmail and Workspace accounts.
const { findMeetingLink, cleanDescription, LOOKAHEAD_MS } = require('./calendar');
const { loopbackSignIn, postForm, jwtClaims } = require('./oauth');

const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly'];
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/calendar/v3';
const SKIP_TYPES = new Set(['workingLocation', 'outOfOffice']);

// Opens the browser; resolves to { provider, email, refreshToken }.
function signIn({ clientId, clientSecret }) {
  return loopbackSignIn({
    authUrl: AUTH_URL,
    host: '127.0.0.1',
    params: {
      client_id: clientId,
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent select_account',
    },
    finish: async ({ code, redirectUri, verifier }) => {
      const t = await postForm(TOKEN_URL, {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      });
      if (!t.refresh_token) throw new Error('Google did not return a refresh token. Remove the account and sign in again.');
      return { provider: 'google', email: jwtClaims(t.id_token).email, refreshToken: t.refresh_token };
    },
  });
}

const accessCache = new Map(); // email -> { token, exp }

async function accessToken(account, creds) {
  const hit = accessCache.get(account.email);
  if (hit && hit.exp > Date.now() + 60000) return hit.token;
  const t = await postForm(TOKEN_URL, {
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: account.refreshToken,
    grant_type: 'refresh_token',
  });
  accessCache.set(account.email, { token: t.access_token, exp: Date.now() + t.expires_in * 1000 });
  return t.access_token;
}

async function api(token, pathAndQuery) {
  const res = await fetch(API + pathAndQuery, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json.error && json.error.message) || `HTTP ${res.status}`);
  return json;
}

function toReminderEvent(ev) {
  const start = new Date(ev.start.dateTime).getTime();
  const video = ((ev.conferenceData && ev.conferenceData.entryPoints) || []).find((p) => p.entryPointType === 'video');
  const link =
    ev.hangoutLink || (video && video.uri) || findMeetingLink({ location: ev.location, description: ev.description });
  const attendees = (ev.attendees || [])
    .filter((a) => !a.resource)
    .map((a) => a.displayName || a.email)
    .slice(0, 12);
  return {
    id: `${ev.iCalUID || ev.id}|${start}`,
    title: ev.summary || '(No title)',
    start,
    end: new Date(ev.end.dateTime).getTime(),
    location: ev.location || '',
    description: cleanDescription(ev.description || ''),
    link: link || null,
    calendarUrl: ev.htmlLink || null,
    organizer: (ev.organizer && (ev.organizer.displayName || ev.organizer.email)) || '',
    attendees,
  };
}

// Events from the account's own calendars (primary + ones it owns), not colleagues' calendars it can see.
async function getAccountEvents(account, creds) {
  const token = await accessToken(account, creds);
  const list = await api(token, '/users/me/calendarList?minAccessRole=owner&maxResults=250');
  const cals = (list.items || []).filter((c) => c.primary || (c.selected && !c.hidden && !c.deleted));
  const now = Date.now();
  const q = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    timeMin: new Date(now - 3600000).toISOString(),
    timeMax: new Date(now + LOOKAHEAD_MS).toISOString(),
    maxResults: '250',
  });
  const out = [];
  for (const cal of cals) {
    const data = await api(token, `/calendars/${encodeURIComponent(cal.id)}/events?${q}`);
    for (const ev of data.items || []) {
      if (ev.status === 'cancelled' || !ev.start || !ev.start.dateTime) continue; // skip all-day
      if (SKIP_TYPES.has(ev.eventType)) continue;
      const me = (ev.attendees || []).find((a) => a.self);
      if (me && me.responseStatus === 'declined') continue;
      out.push(toReminderEvent(ev));
    }
  }
  return out;
}

module.exports = { signIn, getAccountEvents, toReminderEvent };
