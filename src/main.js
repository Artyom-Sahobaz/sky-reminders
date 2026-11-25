const { app, BrowserWindow, Tray, Menu, ipcMain, screen, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { getUpcomingEvents, icalKey } = require('./calendar');
const { makeTrayIcon } = require('./icon');
const { VEHICLES, VEHICLE_KEYS } = require('./vehicles');
const STYLES = ['mix', 'classic', ...VEHICLE_KEYS];
const PROVIDERS = { google: require('./google'), microsoft: require('./microsoft') };
const BUNDLED = (() => {
  try {
    return require('./oauth-config.json');
  } catch {
    return {};
  }
})();

// A separate profile for testing (as a new user would see it). Set before the single-instance
// lock so a test copy can run next to the real app.
if (process.env.SKY_DATA_DIR) app.setPath('userData', process.env.SKY_DATA_DIR);

// ---------- single instance ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// ---------- settings + state ----------
const DATA_DIR = app.getPath('userData');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const FIRED_FILE = path.join(DATA_DIR, 'fired.json');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.bin');

const DEFAULTS = {
  icalUrls: [],
  leads: [15, 5], // minutes before start
  style: 'mix', // mix (a different vehicle each time) | classic (plane, then balloon) | one vehicle key
  sound: true,
  side: 'right', // which edge of the screen vehicles come from: right | left | mix
  launchAtLogin: true,
  pollMinutes: 3,
  google: { clientId: '', clientSecret: '' },
  accountPrefs: {}, // per calendar: { name, color, style } keyed by account key
};

// Colours handed out to calendars in order, so each account is easy to tell apart.
const PALETTE = ['#4f7cff', '#ff6b6b', '#06b88a', '#f59f00', '#9b6bff', '#ff7ac6', '#0fb5cc', '#8a6a50'];

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}
function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

let settings = { ...DEFAULTS, ...readJson(SETTINGS_FILE, {}) };
settings.accountPrefs = settings.accountPrefs || {};
if (!STYLES.includes(settings.style)) settings.style = 'mix'; // older 'auto' setting
let fired = readJson(FIRED_FILE, {}); // key -> timestamp
let events = [];
let lastSync = { at: null, error: null };
const snoozed = new Map(); // event id -> time to re-show

// Signed-in accounts (Google / Microsoft): refresh tokens, encrypted with Windows' per-user protection (DPAPI).
let accounts = [];
function loadAccounts() {
  try {
    const raw = fs.readFileSync(ACCOUNTS_FILE);
    accounts = JSON.parse(safeStorage.decryptString(raw)).map((a) => ({ provider: 'google', ...a }));
  } catch {
    accounts = [];
  }
}
function saveAccounts() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ACCOUNTS_FILE, safeStorage.encryptString(JSON.stringify(accounts)));
}
// Sign-in app IDs: the ones shipped with the app, unless overridden in Settings → Advanced.
function credsFor(provider) {
  if (provider === 'google') {
    const own = settings.google || {};
    return own.clientId && own.clientSecret ? own : BUNDLED.google || {};
  }
  return BUNDLED[provider] || {};
}
const providerReady = (p) => !!credsFor(p).clientId;
const sameAccount = (a, b) => a.provider === b.provider && a.email === b.email;
const accountKeyOf = (a) => `${a.provider}:${a.email}`;
let icalSources = []; // [{ key, name, url }] from the last sync

// Every connected calendar (signed-in accounts + iCal feeds) with its display settings.
function sources() {
  const list = [
    ...accounts.map((a) => ({ key: accountKeyOf(a), provider: a.provider, email: a.email, needsSignIn: !!a.needsSignIn })),
    ...settings.icalUrls.map((url, i) => {
      const key = icalKey(url);
      const found = icalSources.find((x) => x.key === key);
      return { key, provider: 'ical', email: found ? found.name : `Calendar ${i + 1}`, needsSignIn: false };
    }),
  ];
  return list.map((src) => {
    const pref = settings.accountPrefs[src.key] || {};
    return { ...src, name: pref.name || '', label: pref.name || src.email, color: pref.color || PALETTE[0], style: pref.style || 'default' };
  });
}

// Give each calendar a colour of its own the first time it is seen.
function assignColors() {
  let changed = false;
  for (const src of sources()) {
    const pref = (settings.accountPrefs[src.key] = settings.accountPrefs[src.key] || {});
    if (pref.color) continue;
    const used = new Set(Object.values(settings.accountPrefs).map((p) => p.color).filter(Boolean));
    pref.color = PALETTE.find((c) => !used.has(c)) || PALETTE[Object.keys(settings.accountPrefs).length % PALETTE.length];
    changed = true;
  }
  if (changed) writeJson(SETTINGS_FILE, settings);
}

function saveFired() {
  const cutoff = Date.now() - 3 * 24 * 3600 * 1000;
  for (const [k, t] of Object.entries(fired)) if (t < cutoff) delete fired[k];
  writeJson(FIRED_FILE, fired);
}

// ---------- windows ----------
let tray = null;
let overlay = null;
let settingsWin = null;
let overlayReady = false;
const pendingShows = [];

function createOverlay() {
  const { workArea } = screen.getPrimaryDisplay();
  overlay = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.loadFile(path.join(__dirname, 'overlay.html'));
  overlay.webContents.on('did-finish-load', () => {
    overlayReady = true;
    while (pendingShows.length) sendToOverlay(pendingShows.shift());
  });
  overlay.on('closed', () => {
    overlay = null;
    overlayReady = false;
  });
}

function sendToOverlay(reminder) {
  if (!overlay) createOverlay();
  if (!overlayReady) {
    pendingShows.push(reminder);
    return;
  }
  const { workArea } = screen.getPrimaryDisplay();
  overlay.setBounds(workArea);
  if (!overlay.isVisible()) overlay.showInactive();
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.webContents.send('show-reminder', reminder);
}

function openSettings() {
  if (settingsWin) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 560,
    height: 720,
    title: 'Sky Reminders by FlowVA',
    autoHideMenuBar: true,
    backgroundColor: '#fdf6ec',
    icon: makeTrayIcon(64),
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  settingsWin.loadFile(path.join(__dirname, 'settings.html'));
  settingsWin.on('closed', () => (settingsWin = null));
}

// ---------- reminders ----------
let lastVehicle = null;
// The account's own vehicle choice wins; 'default' follows the main setting.
function styleFor(leadMin, accountKey) {
  const own = accountKey && settings.accountPrefs[accountKey] && settings.accountPrefs[accountKey].style;
  const style = own && own !== 'default' ? own : settings.style;
  if (VEHICLES[style]) return style;
  if (style === 'classic') return leadMin >= 10 ? 'plane' : 'balloon';
  const pool = VEHICLE_KEYS.filter((k) => k !== lastVehicle); // never the same one twice in a row
  lastVehicle = pool[Math.floor(Math.random() * pool.length)];
  return lastVehicle;
}

const SIDES = ['right', 'left', 'mix'];
function sideFor() {
  if (settings.side === 'left' || settings.side === 'right') return settings.side;
  return Math.random() < 0.5 ? 'left' : 'right';
}

function accountInfo(key) {
  const all = sources();
  const src = all.find((x) => x.key === key);
  return src
    ? { accountName: src.label, accountEmail: src.email, accountColor: src.color, showAccount: all.length > 1 }
    : {};
}

function showReminder(ev, leadMin) {
  sendToOverlay({ ...ev, ...accountInfo(ev.accountKey), leadMin, style: styleFor(leadMin, ev.accountKey), side: sideFor(), sound: settings.sound });
}

function tick() {
  const now = Date.now();
  const leads = [...settings.leads].sort((a, b) => b - a); // e.g. [15, 5]
  let changed = false;

  for (const ev of events) {
    if (ev.start <= now || ev.start - now > leads[0] * 60000 + 60000) continue;
    // The smallest lead whose moment has passed is the one that's due.
    const due = leads.filter((l) => now >= ev.start - l * 60000);
    if (!due.length) continue;
    const lead = due[due.length - 1];
    const key = `${ev.id}|${lead}`;
    if (fired[key]) continue;
    for (const l of due) fired[`${ev.id}|${l}`] = now; // skip any larger ones we missed
    changed = true;
    showReminder(ev, lead);
  }

  for (const [id, at] of snoozed) {
    if (now < at) continue;
    snoozed.delete(id);
    const ev = events.find((e) => e.id === id);
    if (ev && now < ev.end) showReminder(ev, Math.max(0, Math.round((ev.start - now) / 60000)));
  }

  if (changed) saveFired();
}

async function sync() {
  if (!settings.icalUrls.length && !accounts.length) {
    lastSync = { at: Date.now(), error: 'No calendar connected yet' };
    updateTray();
    return;
  }
  const list = [];
  const errors = [];
  if (settings.icalUrls.length) {
    try {
      const r = await getUpcomingEvents(settings.icalUrls);
      list.push(...r.events);
      errors.push(...r.errors);
      icalSources = r.sources;
    } catch (e) {
      errors.push(e.message);
    }
  }
  const before = JSON.stringify(accounts);
  for (const acc of accounts) {
    try {
      const key = accountKeyOf(acc);
      const got = await PROVIDERS[acc.provider].getAccountEvents(acc, credsFor(acc.provider));
      list.push(...got.map((e) => ({ ...e, accountKey: key, account: acc.email })));
      acc.needsSignIn = false;
    } catch (e) {
      // invalid_grant = the person revoked access or the sign-in expired
      if (e.code === 'invalid_grant' || e.code === 'interaction_required') acc.needsSignIn = true;
      errors.push(`${acc.email}: ${acc.needsSignIn ? 'please sign in again' : e.message}`);
    }
  }
  if (JSON.stringify(accounts) !== before) saveAccounts(); // Microsoft rotates refresh tokens
  assignColors();
  // The same meeting on two connected calendars reminds once (from the first calendar listed).
  const seen = new Set();
  events = list
    .filter((e) => (seen.has(e.id) ? false : seen.add(e.id)))
    .sort((a, b) => a.start - b.start);
  lastSync = { at: Date.now(), error: errors.length ? errors.join('; ') : null };
  writeJson(path.join(DATA_DIR, 'status.json'), {
    lastSync: new Date(lastSync.at).toISOString(),
    error: lastSync.error,
    accounts: accounts.length,
    calendars: sources().length,
    upcomingEvents: events.length,
    withMeetingLink: events.filter((e) => e.link).length,
  });
  updateTray();
  tick();
  for (const w of [settingsWin, welcomeWin]) if (w) w.webContents.send('status', statusPayload());
}

function statusPayload() {
  const now = Date.now();
  return {
    lastSync,
    upcoming: events
      .filter((e) => e.end > now)
      .slice(0, 8)
      .map((e) => ({ ...e, ...accountInfo(e.accountKey) })),
    accounts: sources(),
    providers: { google: providerReady('google'), microsoft: providerReady('microsoft') },
  };
}

function updateTray() {
  if (!tray) return;
  const next = events.find((e) => e.start > Date.now());
  const nextLabel = next
    ? `Next: ${next.title} at ${new Date(next.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : settings.icalUrls.length || accounts.length
      ? 'Nothing coming up soon'
      : 'Sign in to connect your calendar';
  tray.setToolTip(`Sky Reminders by FlowVA\n${nextLabel}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: nextLabel, enabled: false },
      { type: 'separator' },
      { label: 'Sync now', click: () => sync() },
      {
        label: 'Test a reminder',
        submenu: [
          { label: 'Surprise me', click: () => testReminder(null) },
          { type: 'separator' },
          ...VEHICLE_KEYS.map((k) => ({ label: VEHICLES[k].label, click: () => testReminder(k) })),
        ],
      },
      { label: 'Settings…', click: openSettings },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ])
  );
}

const TEST_TITLES = {
  plane: 'Design review with the team', jet: 'Investor update', biplane: 'Weekly planning',
  helicopter: 'Client check-in', balloon: 'Quick sync call', car: 'Coffee chat with Sam',
  bike: '1:1 with Priya', scooter: 'Standup', boat: 'Product demo',
};
// style: a vehicle key, or null to pick the way a real reminder would (for accountKey if given).
function testReminder(style, accountKey) {
  const key = accountKey || (sources()[0] || {}).key;
  style = style || styleFor(15, key);
  const sky = VEHICLES[style] && VEHICLES[style].lane === 'sky' && style !== 'balloon';
  const lead = sky ? 15 : 5;
  const start = Date.now() + lead * 60000;
  sendToOverlay({
    id: `test|${style}|${Date.now()}`,
    title: TEST_TITLES[style] || 'Test reminder',
    start,
    end: start + 30 * 60000,
    location: 'Google Meet',
    description: 'This is a test reminder.\nClick Join to open the meeting link.',
    link: 'https://meet.google.com/',
    organizer: 'Sky Reminders',
    attendees: ['You', 'Your team'],
    leadMin: lead,
    style,
    side: sideFor(),
    sound: settings.sound,
    ...accountInfo(key),
  });
}

function applyLoginItem() {
  const opts = { openAtLogin: !!settings.launchAtLogin };
  if (!app.isPackaged) {
    opts.path = process.execPath;
    opts.args = [path.resolve(__dirname, '..')];
  }
  app.setLoginItemSettings(opts);
}

// ---------- IPC ----------
ipcMain.on('set-interactive', (_e, on) => {
  if (overlay) overlay.setIgnoreMouseEvents(!on, { forward: true });
});
ipcMain.on('overlay-empty', () => {
  if (overlay) {
    overlay.setIgnoreMouseEvents(true, { forward: true });
    overlay.hide();
  }
});
ipcMain.on('open-link', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
});
ipcMain.on('snooze', (_e, id, minutes) => {
  if (!String(id).startsWith('test|')) snoozed.set(id, Date.now() + (minutes || 2) * 60000);
});
// Cancel: no more reminders for this meeting (later lead times and pending snoozes).
ipcMain.on('cancel-reminders', (_e, id) => {
  snoozed.delete(id);
  if (String(id).startsWith('test|')) return;
  for (const l of settings.leads) fired[`${id}|${l}`] = Date.now();
  saveFired();
});
ipcMain.handle('get-settings', () => ({
  settings,
  status: statusPayload(),
  vehicles: VEHICLE_KEYS.map((k) => ({ key: k, label: VEHICLES[k].label })),
}));
ipcMain.handle('get-status', () => statusPayload());
ipcMain.handle('save-settings', async (_e, next) => {
  const leads = (Array.isArray(next.leads) ? next.leads : [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 240);
  settings = {
    ...settings,
    icalUrls: (next.icalUrls || []).map((s) => String(s).trim()).filter((s) => /^https?:\/\//i.test(s)),
    leads: leads.length ? [...new Set(leads)] : DEFAULTS.leads,
    style: STYLES.includes(next.style) ? next.style : 'mix',
    sound: !!next.sound,
    side: SIDES.includes(next.side) ? next.side : 'right',
    launchAtLogin: !!next.launchAtLogin,
    google: {
      clientId: String((next.google && next.google.clientId) || '').trim(),
      clientSecret: String((next.google && next.google.clientSecret) || '').trim(),
    },
    accountPrefs: cleanPrefs(next.accountPrefs),
  };
  writeJson(SETTINGS_FILE, settings);
  applyLoginItem();
  await sync();
  return { settings, status: statusPayload() };
});
function cleanPrefs(input) {
  const out = { ...settings.accountPrefs };
  for (const [key, p] of Object.entries(input || {})) {
    if (typeof key !== 'string' || !p || typeof p !== 'object') continue;
    const cur = out[key] || {};
    out[key] = {
      name: String(p.name ?? cur.name ?? '').trim().slice(0, 40),
      color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : cur.color,
      style: p.style === 'default' || STYLES.includes(p.style) ? p.style : cur.style || 'default',
    };
  }
  return out;
}
ipcMain.on('test', (_e, style, accountKey) => testReminder(VEHICLES[style] ? style : null, accountKey));
ipcMain.on('account-cancel', () => require('./oauth').cancelSignIn());
ipcMain.handle('account-add', async (_e, provider) => {
  if (!PROVIDERS[provider]) return { error: 'Unknown provider' };
  if (!providerReady(provider)) return { error: `${provider === 'google' ? 'Google' : 'Microsoft'} sign-in is not set up in this copy of the app yet.` };
  try {
    const acc = await PROVIDERS[provider].signIn(credsFor(provider));
    accounts = accounts.filter((a) => !sameAccount(a, acc)).concat(acc);
    saveAccounts();
    await sync();
    for (const w of [welcomeWin, settingsWin]) if (w) w.focus();
    return { ok: true, email: acc.email, status: statusPayload() };
  } catch (e) {
    return { error: friendlyError(e) };
  }
});
ipcMain.handle('account-remove', async (_e, key) => {
  if (String(key).startsWith('ical:')) {
    settings.icalUrls = settings.icalUrls.filter((u) => icalKey(u) !== key);
  } else {
    accounts = accounts.filter((a) => accountKeyOf(a) !== key);
    saveAccounts();
  }
  delete settings.accountPrefs[key];
  writeJson(SETTINGS_FILE, settings);
  await sync();
  return { status: statusPayload() };
});
ipcMain.on('welcome-done', () => {
  if (welcomeWin) welcomeWin.close();
});
ipcMain.on('open-settings', openSettings);

function friendlyError(e) {
  const m = String(e.message || e);
  if (/access_denied|^cancelled$/i.test(m)) return 'Sign-in was cancelled. Nothing was connected.';
  if (/admin_policy_enforced|admin/i.test(m)) return 'Your organisation blocks this app. Ask your IT admin to allow it.';
  if (/timed out/i.test(m)) return 'Sign-in took too long. Please try again.';
  return m;
}

// ---------- welcome (first run) ----------
let welcomeWin = null;
function openWelcome() {
  if (welcomeWin) return welcomeWin.focus();
  welcomeWin = new BrowserWindow({
    width: 480,
    height: 640,
    resizable: false,
    title: 'Welcome to Sky Reminders by FlowVA',
    autoHideMenuBar: true,
    backgroundColor: '#fdf6ec',
    icon: makeTrayIcon(64),
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  welcomeWin.loadFile(path.join(__dirname, 'welcome.html'));
  welcomeWin.on('closed', () => (welcomeWin = null));
}

// ---------- boot ----------
app.whenReady().then(() => {
  app.setAppUserModelId('com.skyreminders.app');
  loadAccounts();
  tray = new Tray(makeTrayIcon(32));
  tray.on('click', () => tray.popUpContextMenu());
  tray.on('double-click', openSettings);
  updateTray();
  applyLoginItem();
  createOverlay();

  sync();
  setInterval(sync, settings.pollMinutes * 60000);
  setInterval(tick, 15000);

  if (!settings.icalUrls.length && !accounts.length && !process.argv.some((a) => a.startsWith('--selftest'))) openWelcome();
  if (process.argv.includes('--welcome')) openWelcome();
  const wShot = process.argv.find((x) => x.startsWith('--welcome-shot='));
  if (wShot) {
    openWelcome();
    welcomeWin.webContents.once('did-finish-load', () =>
      setTimeout(async () => {
        const img = await welcomeWin.webContents.capturePage();
        fs.writeFileSync(wShot.slice('--welcome-shot='.length), img.toPNG());
        app.exit(0);
      }, 5000)
    );
  }
  if (process.argv.includes('--test')) setTimeout(() => testReminder('plane'), 1200);
  const accArg = process.argv.find((a) => a.startsWith('--accounts-shot='));
  if (accArg) accountsShot(accArg.slice('--accounts-shot='.length));
  const galArg = process.argv.find((a) => a.startsWith('--gallery='));
  if (galArg) gallery(galArg.slice('--gallery='.length));
  const shotArg = process.argv.find((a) => a.startsWith('--selftest='));
  if (shotArg) selfTest(shotArg.slice('--selftest='.length));
});

// Shows both reminders, saves captures of the overlay, then quits. For development checks.
async function selfTest(dir) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (name) => {
    const img = await overlay.webContents.capturePage();
    fs.writeFileSync(path.join(dir, name), img.toPNG());
  };
  if (settingsWin) settingsWin.close();
  await wait(1500);
  testReminder('plane');
  await wait(900);
  await shot('1-plane-flying.png');
  testReminder('balloon');
  await wait(3800);
  await shot('2-both-resting.png');
  const cls = await overlay.webContents.executeJavaScript(
    "document.querySelector('.v-plane .craft').click(); [...document.querySelectorAll('.flight')].map(f => f.className).join(' / ')"
  );
  console.log('after click:', cls);
  await wait(1500);
  await shot('3-cards-open.png');

  // real double click on the balloon -> should snooze it, card should not open
  const pt = await overlay.webContents.executeJavaScript(
    "(() => { document.querySelectorAll('.flight.open').forEach(f => f.classList.remove('open')); const r = document.querySelector('.v-balloon .craft svg').getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()"
  );
  const wc = overlay.webContents;
  for (const clickCount of [1, 2]) {
    wc.sendInputEvent({ type: 'mouseDown', x: pt.x, y: pt.y, button: 'left', clickCount });
    wc.sendInputEvent({ type: 'mouseUp', x: pt.x, y: pt.y, button: 'left', clickCount });
  }
  await wait(350);
  await shot('4-balloon-snoozed.png');
  await wait(3500);
  const left = await wc.executeJavaScript(
    "[...document.querySelectorAll('.flight')].map(f => f.className).join(' / ')"
  );
  console.log('after double click:', left);
  app.exit(0);
}

// Shows every vehicle (sky batch, then ground batch) and saves captures. For development checks.
async function gallery(dir) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  if (settingsWin) settingsWin.close();
  if (welcomeWin) welcomeWin.close();
  await wait(1500);
  const batches = [
    ['plane', 'jet', 'biplane', 'helicopter'],
    ['balloon', 'car', 'bike', 'scooter'],
    ['boat', 'car'],
  ];
  for (let i = 0; i < batches.length; i++) {
    for (const k of batches[i]) {
      testReminder(k);
      await wait(150);
    }
    await wait(4200);
    fs.writeFileSync(path.join(dir, `gallery-${i + 1}.png`), (await overlay.webContents.capturePage()).toPNG());
    if (i === batches.length - 1) {
      await overlay.webContents.executeJavaScript("document.querySelector('.v-car .craft').click(); 1");
      await wait(1200);
      fs.writeFileSync(path.join(dir, 'gallery-card-ground.png'), (await overlay.webContents.capturePage()).toPNG());
    }
    await overlay.webContents.executeJavaScript('[...active.keys()].forEach((id) => remove(id, true)); 1');
    await wait(300);
  }
  app.exit(0);
}

// Multi-calendar check: waits for a sync, shows reminders, opens a card and Settings, saves captures.
async function accountsShot(dir) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const save = async (win, name) => fs.writeFileSync(path.join(dir, name), (await win.webContents.capturePage()).toPNG());
  await wait(9000); // first sync + the due reminder from the test feed
  const work = sources().find((x) => x.provider === 'google');
  if (work) testReminder(null, work.key);
  await wait(4500);
  await save(overlay, 'accounts-1-reminders.png');
  await overlay.webContents.executeJavaScript("document.querySelector('.flight .craft').click(); 1");
  await wait(1200);
  await save(overlay, 'accounts-2-card.png');
  openSettings();
  await wait(2500);
  await save(settingsWin, 'accounts-3-settings.png');
  console.log('sources:', JSON.stringify(sources().map((x) => [x.provider, x.label, x.color, x.style])));
  app.exit(0);
}

app.on('second-instance', openSettings);
app.on('window-all-closed', (e) => e.preventDefault()); // keep running in the tray
