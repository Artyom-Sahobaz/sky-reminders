// Microsoft sign-in + Outlook calendar through Microsoft Graph (read-only).
// Works for personal accounts (Outlook.com, Hotmail, Live) and work/school Microsoft 365 accounts.
// Uses a public client (no secret), as Microsoft recommends for desktop apps.
const { findMeetingLink, cleanDescription, LOOKAHEAD_MS } = require('./calendar');
const { loopbackSignIn, postForm, jwtClaims } = require('./oauth');

const AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const SCOPES = ['openid', 'profile', 'email', 'offline_access', 'User.Read', 'Calendars.Read'];
const GRAPH = 'https://graph.microsoft.com/v1.0';

function signIn({ clientId }) {
  return loopbackSignIn({
    authUrl: `${AUTHORITY}/authorize`,
    host: 'localhost',
    params: {
      client_id: clientId,
      scope: SCOPES.join(' '),
      response_mode: 'query',
      prompt: 'select_account',
    },
    finish: async ({ code, redirectUri, verifier }) => {
      const t = await postForm(`${AUTHORITY}/token`, {
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
        scope: SCOPES.join(' '),
      });
      if (!t.refresh_token) throw new Error('Microsoft did not return a refresh token');
      const c = jwtClaims(t.id_token);
      return { provider: 'microsoft', email: c.preferred_username || c.email, refreshToken: t.refresh_token };
    },
  });
}

const accessCache = new Map();

// Microsoft rotates refresh tokens: the new one is written back onto `account`
// and the caller saves accounts when it changes.
async function accessToken(account, creds) {
  const hit = accessCache.get(account.email);
  if (hit && hit.exp > Date.now() + 60000) return hit.token;
  const t = await postForm(`${AUTHORITY}/token`, {
    client_id: creds.clientId,
    grant_type: 'refresh_token',
    refresh_token: account.refreshToken,
    scope: SCOPES.join(' '),
  });
  if (t.refresh_token) account.refreshToken = t.refresh_token;
  accessCache.set(account.email, { token: t.access_token, exp: Date.now() + t.expires_in * 1000 });
  return t.access_token;
}

// Graph returns UTC times without a zone marker when asked for UTC.
const utc = (s) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : s + 'Z').getTime();

function toReminderEvent(ev) {
  const start = utc(ev.start.dateTime);
  const loc = (ev.location && ev.location.displayName) || '';
  const body = (ev.body && ev.body.content) || ev.bodyPreview || '';
  const link =
    (ev.onlineMeeting && ev.onlineMeeting.joinUrl) ||
    ev.onlineMeetingUrl ||
    findMeetingLink({ location: loc, description: body });
  const name = (p) => p && p.emailAddress && (p.emailAddress.name || p.emailAddress.address);
  return {
    id: `${ev.iCalUId || ev.id}|${start}`,
    title: ev.subject || '(No title)',
    start,
    end: utc(ev.end.dateTime),
    location: loc,
    description: cleanDescription(body),
    link: link || null,
    calendarUrl: ev.webLink || null,
    organizer: name(ev.organizer) || '',
    attendees: (ev.attendees || [])
      .filter((a) => a.type !== 'resource')
      .map(name)
      .filter(Boolean)
      .slice(0, 12),
  };
}

async function getAccountEvents(account, creds) {
  const token = await accessToken(account, creds);
  const now = Date.now();
  const q = new URLSearchParams({
    startDateTime: new Date(now - 3600000).toISOString(),
    endDateTime: new Date(now + LOOKAHEAD_MS).toISOString(),
    $top: '100',
    $orderby: 'start/dateTime',
    $select:
      'subject,start,end,location,body,bodyPreview,onlineMeeting,onlineMeetingUrl,webLink,organizer,attendees,isAllDay,isCancelled,responseStatus,iCalUId',
  });
  let url = `${GRAPH}/me/calendarView?${q}`;
  const out = [];
  for (let page = 0; url && page < 10; page++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'outlook.timezone="UTC", outlook.body-content-type="text"',
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json.error && json.error.message) || `HTTP ${res.status}`);
    for (const ev of json.value || []) {
      if (ev.isAllDay || ev.isCancelled) continue;
      if (ev.responseStatus && ev.responseStatus.response === 'declined') continue;
      out.push(toReminderEvent(ev));
    }
    url = json['@odata.nextLink'];
  }
  return out;
}

module.exports = { signIn, getAccountEvents, toReminderEvent };
