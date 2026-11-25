// Fetches Google Calendar "secret iCal address" feeds and turns them into a
// flat, sorted list of upcoming timed events.
const ical = require('node-ical');

const LOOKAHEAD_MS = 36 * 60 * 60 * 1000; // expand events for the next 36h

const MEETING_PATTERNS = [
  /https:\/\/meet\.google\.com\/[a-z0-9-]+/i,
  /https:\/\/[\w.-]*zoom\.us\/[^\s"<>)]+/i,
  /https:\/\/teams\.microsoft\.com\/[^\s"<>)]+/i,
  /https:\/\/teams\.live\.com\/[^\s"<>)]+/i,
  /https:\/\/[\w.-]*webex\.com\/[^\s"<>)]+/i,
  /https:\/\/whereby\.com\/[^\s"<>)]+/i,
];

function text(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && 'val' in v) return String(v.val);
  return String(v);
}

function findMeetingLink(ev) {
  const conf = text(ev['GOOGLE-CONFERENCE'] || ev['X-GOOGLE-CONFERENCE']);
  const haystack = [conf, text(ev.location), text(ev.description), text(ev.url)].join('\n');
  for (const re of MEETING_PATTERNS) {
    const m = haystack.match(re);
    if (m) return m[0];
  }
  return null;
}

function cleanDescription(desc) {
  return text(desc)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/-::~:~::~:~[\s\S]*?::~:~::-/g, '') // Google's auto "join with Meet" block
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function attendeeNames(ev) {
  let a = ev.attendee;
  if (!a) return [];
  if (!Array.isArray(a)) a = [a];
  return a
    .map((x) => (x && x.params && x.params.CN) || text(x).replace(/^mailto:/i, ''))
    .filter(Boolean)
    .slice(0, 12);
}

async function fetchFeed(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'sky-reminders/1.0' } });
  if (!res.ok) throw new Error(`Calendar feed returned HTTP ${res.status}`);
  return ical.sync.parseICS(await res.text());
}

async function getUpcomingEvents(urls) {
  const now = Date.now();
  const from = new Date(now - 60 * 60 * 1000);
  const to = new Date(now + LOOKAHEAD_MS);
  const out = [];
  const errors = [];

  for (const url of urls) {
    let data;
    try {
      data = await fetchFeed(url);
    } catch (e) {
      errors.push(e.message);
      continue;
    }
    for (const ev of Object.values(data)) {
      if (!ev || ev.type !== 'VEVENT' || !ev.start) continue;
      if (text(ev.status).toUpperCase() === 'CANCELLED') continue;
      let instances;
      try {
        instances = ical.expandRecurringEvent(ev, { from, to });
      } catch {
        continue;
      }
      for (const inst of instances) {
        if (inst.isFullDay) continue; // all-day events don't get countdown popups
        const e = inst.event || ev;
        if (text(e.status).toUpperCase() === 'CANCELLED') continue;
        const start = new Date(inst.start).getTime();
        out.push({
          id: `${e.uid || ev.uid}|${start}`,
          title: text(inst.summary || e.summary) || '(No title)',
          start,
          end: new Date(inst.end || inst.start).getTime(),
          location: text(e.location),
          description: cleanDescription(e.description),
          link: findMeetingLink(e),
          calendarUrl: text(e.url) || null,
          organizer: (e.organizer && e.organizer.params && e.organizer.params.CN) || '',
          attendees: attendeeNames(e),
        });
      }
    }
  }

  out.sort((a, b) => a.start - b.start);
  return { events: out, errors };
}

module.exports = { getUpcomingEvents, findMeetingLink, cleanDescription, text, LOOKAHEAD_MS };
