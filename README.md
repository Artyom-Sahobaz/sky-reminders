# Sky Reminders

A small Windows tray app by Flow Virtual Assistant. Before each Google Calendar meeting, a little vehicle brings
the reminder onto your screen: a plane, jet, biplane, helicopter or hot-air balloon in the sky, or a car,
bicycle, scooter or sailboat along the bottom. Click it to see the details and **Join meeting**.

- Reminders 15 and 5 minutes before each meeting (configurable).
- **Click** a vehicle: details card with countdown, guests, notes, and **Join meeting**, **Snooze 2 min**, **Cancel**.
- **Double-click**: snooze for 2 minutes. **Cancel**: no more reminders for that meeting.
- Finds Google Meet, Zoom, Teams, Webex and Whereby links.
- Skips all-day events, declined meetings and "working location" entries.
- Read-only. Sign-ins are stored on the computer, encrypted with the Windows user account.

## Run it

Needs Node.js 20 or newer.

```
npm install
copy src\oauth-config.example.json src\oauth-config.json   # then fill it in, see below
npm start
```

On first run a welcome window asks the person to **Continue with Google**. After that the app lives in the
tray (balloon icon by the clock). Right-click it for *Sync now*, *Test a reminder*, *Settings* and *Quit*.
It starts with Windows unless that is turned off in Settings.

## Sign-in setup (`src/oauth-config.json`)

This file holds the sign-in app IDs every install uses. It is **not committed** because it holds the Google
client secret. Start from `src/oauth-config.example.json`.

| Provider | What to create | Fields |
|---|---|---|
| Google | Google Cloud project with the Calendar API on; Google Auth Platform; client of type **Desktop app** | `google.clientId`, `google.clientSecret` |
| Microsoft (not set up yet) | Microsoft Entra app registration, any organisation + personal accounts, redirect `http://localhost` under *Mobile and desktop*, delegated `Calendars.Read` | `microsoft.clientId` |

A provider with an empty `clientId` has its button hidden. Step-by-step Google instructions:
[GOOGLE-SETUP.md](GOOGLE-SETUP.md).

While the Google app's audience is **Internal**, only accounts in that Google Workspace can sign in. To let
anyone sign in, switch it to **External** and submit it for Google's verification; that needs a homepage and
privacy policy on your own domain (drafts in [website/](website/)).

People can also connect a calendar without signing in, by pasting its *secret iCal address* in Settings.

## Project layout

| Path | What it is |
|---|---|
| `src/main.js` | Tray, windows, sync loop, reminder timing, settings |
| `src/overlay.html` | Full-screen transparent layer where vehicles fly in, plus the details card |
| `src/vehicles.js` | Drawings and behaviour for each vehicle |
| `src/welcome.html`, `src/settings.html` | First-run login screen and Settings |
| `src/oauth.js` | Browser sign-in helper (loopback redirect + PKCE) |
| `src/google.js`, `src/microsoft.js` | Sign-in and calendar reading for each provider |
| `src/calendar.js` | Secret iCal feeds, meeting-link detection |
| `src/fonts/` | Inter typeface (SIL Open Font License) |
| `website/` | Draft homepage and privacy policy for flowvirtualassistant.com |

## Development checks

```
npx electron . --selftest=<folder>    # plane + balloon, card, double-click snooze; saves PNGs
npx electron . --gallery=<folder>     # every vehicle; saves PNGs
npx electron . --welcome-shot=<file>  # welcome window
```

Set `SKY_DATA_DIR=<folder>` to run with a fresh profile (as a brand-new user would see it).

App data lives in `%APPDATA%\sky-reminders`: `settings.json`, `accounts.bin` (encrypted sign-ins),
`fired.json` (reminders already shown) and `status.json` (last sync result, no meeting details).
