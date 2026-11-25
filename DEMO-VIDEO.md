# Demo video for Google's verification

Google needs a short video showing how Sky Reminders by FlowVA signs in and uses calendar data. Upload it
to YouTube as **Unlisted**, then paste the link in Google Cloud → Google Auth Platform → **Data access** →
*Demo video* → **Save**.

Length: 2–3 minutes. No voice-over needed; on-screen actions are enough. Record the whole screen at
1080p (Windows: **Win + Alt + R** with Xbox Game Bar, or OBS). Make sure everything on screen is in English.

## Before recording

1. Quit Sky Reminders (tray icon → Quit).
2. Use a Google account that is **not** connected yet (or remove it in Settings first), so the full sign-in shows.
3. Put a test meeting in that account's Google Calendar starting about **16 minutes from now**, with a Google
   Meet link and a short description.
4. Close anything private on screen (email, chats).

## Shots, in order

1. **Homepage** (10 s): open https://artyom-sahobaz.github.io/sky-reminders/ in the browser. Scroll slowly to
   show "What Sky Reminders does with your calendar" and the Privacy Policy link.
2. **Start the app** (10 s): start Sky Reminders. The *Welcome to Sky Reminders by FlowVA* window appears.
3. **Sign-in and consent** (40 s), the most important part:
   - Click **Continue with Google**.
   - In the browser, pick the account.
   - Show Google's consent screen clearly: the app name **Sky Reminders by FlowVA** and the permission
     *See and download any calendar that you can access using your Google Calendar*. Pause for 3 seconds.
   - Click **Continue / Allow**. The browser tab says "Connected".
   - Optional: click the browser address bar to show the URL, which includes the app's client ID.
4. **Connected** (10 s): back in the app, the window shows "You're all set" and the next meeting from the
   calendar. Click **Start reminders**.
5. **How the data is used** (60 s):
   - Wait for the 15-minute reminder (or right-click the tray icon → *Sync now*) — a vehicle flies in with the
     meeting title.
   - Click it: the card shows the title, time, guests, description and Meet link, all read from the calendar.
   - Click **Join meeting** to show the Meet link opening.
6. **Read-only and removable** (20 s): open **Settings** (double-click the tray icon). Show the calendar under
   *Calendars* and the **Remove** button, then the "Coming up" list.

## Notes

- The video must show the real app name and the real consent screen; don't cut those parts.
- If Google's "unverified app" warning appears before the consent screen, keep it in the video and click
  *Advanced → Go to Sky Reminders by FlowVA*. That is expected before approval.
