const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const TOKEN_PATH = path.join(__dirname, '..', '..', 'token.json');
const SETTINGS_PATH = path.join(__dirname, '..', '..', 'data', 'settings.json');

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.send'
];

function getCredentials() {
  // Read from saved settings.json first, then fall back to .env
  let settings = {};
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    }
  } catch (e) { /* ignore */ }

  return {
    clientId: settings.clientId || process.env.GOOGLE_CLIENT_ID,
    clientSecret: settings.clientSecret || process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback',
    gmailUser: settings.gmailUser || process.env.GMAIL_USER
  };
}

function getOAuth2Client() {
  const creds = getCredentials();
  return new google.auth.OAuth2(
    creds.clientId,
    creds.clientSecret,
    creds.redirectUri
  );
}

function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES
  });
}

async function handleCallback(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  
  // Save tokens for later use
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), 'utf8');
  return tokens;
}

function getAuthedClient() {
  const oauth2Client = getOAuth2Client();
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error('Not authenticated. Please connect your Google account first.');
  }
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  oauth2Client.setCredentials(token);
  return oauth2Client;
}

async function exportContacts(sheetId, contacts) {
  const auth = getAuthedClient();
  const sheets = google.sheets({ version: 'v4', auth });

  // Prepare data rows
  const headers = ['Name', 'Email', 'Role', 'Company', 'Status', 'Source', 'Added Date'];
  const rows = contacts.map(c => [
    c.name || '', c.email, c.role || '', c.company || '',
    c.status || '', c.source || '', c.createdAt || ''
  ]);

  const values = [headers, ...rows];

  const result = await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'Sheet1!A1',
    valueInputOption: 'RAW',
    resource: { values }
  });

  return { updatedRows: result.data.updatedRows };
}

async function importContacts(sheetId, range = 'Sheet1!A2:G') {
  const auth = getAuthedClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range
  });

  const rows = result.data.values || [];
  return rows.map(row => ({
    name: row[0] || '',
    email: row[1] || '',
    role: row[2] || '',
    company: row[3] || '',
    status: row[4] || 'imported',
    source: row[5] || 'google-sheets'
  })).filter(c => c.email); // Only include rows that have an email
}

module.exports = { getAuthUrl, handleCallback, exportContacts, importContacts };
