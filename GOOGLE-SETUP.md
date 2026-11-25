# Connect a Google Workspace (work) calendar

You do this once. It takes about 5 minutes. It creates a private "app" inside your company's Google Cloud,
so only people in your company can use it and Google does not need to review it.

Sign in with your **work** account for every step.

## 1. Create a project

1. Open https://console.cloud.google.com
2. Click the project picker at the top → **New project**.
3. Name: `Sky Reminders`. Leave Organization as your company → **Create**, then make sure it is selected.

## 2. Turn on the Calendar API

1. Menu → **APIs & Services** → **Library**.
2. Search **Google Calendar API** → open it → **Enable**.

## 3. Set up the sign-in screen

1. Menu → **APIs & Services** → **OAuth consent screen** (it may be called **Google Auth Platform**) → **Get started**.
2. App name: `Sky Reminders`. Support email: your work email → **Next**.
3. Audience: **Internal** → **Next**.
4. Contact email: your work email → **Next** → agree → **Create**.

## 4. Create the Client ID

1. In the same area open **Clients** → **Create client**.
2. Application type: **Desktop app**. Name: `Sky Reminders desktop` → **Create**.
3. Copy the **Client ID** and **Client secret** (or download the JSON, which has both).

## 5. Connect the app

1. Put the Client ID and Client secret into `src/oauth-config.json` (copy it from `src/oauth-config.example.json`)
   so every install uses them. For a one-off test you can instead paste them in **Settings → Advanced**.
2. Start Sky Reminders and click **Continue with Google**.
3. Your browser opens. Pick your work account → **Allow** (read-only calendar access).
4. The browser says "Connected". Back in Settings, your meetings appear under **Coming up**.

Repeat step 5 to add another account with the same Client ID.

## If something blocks you

| You see | What it means |
|---|---|
| No permission to create a project | Your company limits Google Cloud. Ask IT to create the project or the Client ID for you. |
| **Internal** is greyed out | The project is not under your company's organization. Recreate it with Organization set to your company. |
| "Access blocked: your admin has restricted…" | IT must allow the app: Admin console → Security → API controls → App access control → trust the Client ID. |
| "Google did not return a refresh token" | Remove the account in Settings and sign in again. |

To disconnect: remove the account in Settings, and optionally revoke it at https://myaccount.google.com/permissions
