# 🔧 Google Cloud Setup Guide

Follow these steps to set up Google Cloud credentials for Gmail sending and Google Sheets integration.

---

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top → **New Project**
3. Name it: `MailForge Email System`
4. Click **Create**

## Step 2: Enable APIs

1. Go to **APIs & Services → Library**
2. Search for and enable:
   - **Gmail API** — Click Enable
   - **Google Sheets API** — Click Enable

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Select **External** → Click Create
3. Fill in:
   - **App name**: `MailForge`
   - **User support email**: Your Gmail address
   - **Developer contact email**: Your Gmail address
4. Click **Save and Continue**
5. **Scopes**: Click "Add or Remove Scopes" and add:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/spreadsheets`
6. Click **Save and Continue**
7. **Test users**: Click "Add Users" → Add your Gmail address
8. Click **Save and Continue**

> ⚠️ **Important**: While in testing mode, only test users can authenticate. Add your Gmail address as a test user!

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth Client ID**
3. Application type: **Web application**
4. Name: `MailForge Web Client`
5. **Authorized redirect URIs**: Add:
   ```
   http://localhost:3000/api/auth/google/callback
   ```
6. Click **Create**
7. **Copy** the **Client ID** and **Client Secret**

## Step 5: Configure the App

### Option A: Via the Settings UI
1. Start the app: `npm run dev`
2. Go to **Settings** page
3. Paste your **Client ID**, **Client Secret**, and **Gmail address**
4. Click **Save Settings**

### Option B: Via .env file
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in the values:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
   GMAIL_USER=your-email@gmail.com
   ```

## Step 6: Connect Your Google Account

1. Open the app → Go to **Google Sheets** page
2. Click **Connect Google Account**
3. Sign in with your Google account
4. Grant the requested permissions
5. You should see "Connected" status in the sidebar

---

## Troubleshooting

### "Access blocked: This app's request is invalid"
- Make sure the redirect URI exactly matches: `http://localhost:3000/api/auth/google/callback`

### "Error 403: access_denied"
- Add your Gmail address as a **test user** in the OAuth consent screen

### "Token has been expired or revoked"
- Delete `token.json` from the project root and reconnect

### Gmail sending fails
- Make sure you enabled the **Gmail API** (not just Sheets)
- Make sure the Gmail address in settings matches the authenticated account

---

## Optional: Hunter.io API Key

For enhanced email discovery (finding employee emails by domain):

1. Go to [hunter.io](https://hunter.io/)
2. Create a free account
3. Go to **API** section
4. Copy your API key
5. Paste it in **Settings → Hunter.io API Key**

Free tier: 25 domain searches + 50 verifications per month.
