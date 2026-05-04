const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const TOKEN_PATH = path.join(__dirname, '..', '..', 'token.json');
const SETTINGS_PATH = path.join(__dirname, '..', '..', 'data', 'settings.json');

function getCredentials() {
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
    gmailUser: settings.gmailUser || process.env.GMAIL_USER,
    senderName: settings.senderName || process.env.GMAIL_USER_NAME || 'Email Outreach'
  };
}

function getOAuth2Client() {
  const creds = getCredentials();
  if (!creds.clientId || !creds.clientSecret || creds.clientId === 'your_client_id_here') {
    throw new Error('Google OAuth credentials not configured. Go to Settings and enter your Client ID and Secret.');
  }

  const oauth2Client = new google.auth.OAuth2(
    creds.clientId,
    creds.clientSecret,
    creds.redirectUri
  );

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oauth2Client.setCredentials(token);
  }

  return oauth2Client;
}

/**
 * Build a raw RFC 2822 email message with support for HTML body and inline image.
 */
function buildRawEmail({ from, to, subject, html, imagePath }) {
  const boundary = '____mailforge_boundary_' + Date.now();

  let hasImage = imagePath && fs.existsSync(imagePath);

  let raw = '';
  raw += `From: ${from}\r\n`;
  raw += `To: ${to}\r\n`;
  raw += `Subject: ${subject}\r\n`;
  raw += `MIME-Version: 1.0\r\n`;

  if (hasImage) {
    raw += `Content-Type: multipart/related; boundary="${boundary}"\r\n\r\n`;
    raw += `--${boundary}\r\n`;
    raw += `Content-Type: text/html; charset=utf-8\r\n\r\n`;
    raw += html + '\r\n\r\n';

    // Read image and embed
    const ext = path.extname(imagePath).toLowerCase();
    const mimeTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    const imageData = fs.readFileSync(imagePath).toString('base64');

    raw += `--${boundary}\r\n`;
    raw += `Content-Type: ${mimeType}\r\n`;
    raw += `Content-Transfer-Encoding: base64\r\n`;
    raw += `Content-ID: <embedded-image>\r\n`;
    raw += `Content-Disposition: inline; filename="image${ext}"\r\n\r\n`;
    raw += imageData + '\r\n';
    raw += `--${boundary}--\r\n`;

    // Add image reference if not already present
    if (!html.includes('cid:embedded-image')) {
      // Re-build with image appended into HTML part
      raw = '';
      raw += `From: ${from}\r\n`;
      raw += `To: ${to}\r\n`;
      raw += `Subject: ${subject}\r\n`;
      raw += `MIME-Version: 1.0\r\n`;
      raw += `Content-Type: multipart/related; boundary="${boundary}"\r\n\r\n`;
      raw += `--${boundary}\r\n`;
      raw += `Content-Type: text/html; charset=utf-8\r\n\r\n`;
      raw += html + `<br/><img src="cid:embedded-image" style="max-width:600px;border-radius:8px;" alt="Attached image"/>` + '\r\n\r\n';
      raw += `--${boundary}\r\n`;
      raw += `Content-Type: ${mimeType}\r\n`;
      raw += `Content-Transfer-Encoding: base64\r\n`;
      raw += `Content-ID: <embedded-image>\r\n`;
      raw += `Content-Disposition: inline; filename="image${ext}"\r\n\r\n`;
      raw += imageData + '\r\n';
      raw += `--${boundary}--\r\n`;
    }
  } else {
    raw += `Content-Type: text/html; charset=utf-8\r\n\r\n`;
    raw += html;
  }

  return raw;
}

async function sendEmail({ to, subject, html, imagePath, recipientName, companyName }) {
  const creds = getCredentials();
  const oauth2Client = getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Personalize
  let personalizedHtml = (html || '')
    .replace(/\{\{name\}\}/gi, recipientName || 'there')
    .replace(/\{\{company\}\}/gi, companyName || 'your company')
    .replace(/\{\{email\}\}/gi, to);

  // Wrap in template if available
  const templatePath = path.join(__dirname, '..', 'templates', 'email.html');
  if (fs.existsSync(templatePath)) {
    let template = fs.readFileSync(templatePath, 'utf8');
    template = template.replace('{{CONTENT}}', personalizedHtml);
    template = template.replace('{{SUBJECT}}', subject || '');
    template = template.replace('{{YEAR}}', new Date().getFullYear().toString());
    template = template.replace('{{SENDER_EMAIL}}', creds.gmailUser || '');
    personalizedHtml = template;
  }

  const personalizedSubject = (subject || '')
    .replace(/\{\{name\}\}/gi, recipientName || 'there')
    .replace(/\{\{company\}\}/gi, companyName || 'your company');

  const fromHeader = `${creds.senderName} <${creds.gmailUser}>`;

  const rawMessage = buildRawEmail({
    from: fromHeader,
    to,
    subject: personalizedSubject,
    html: personalizedHtml,
    imagePath
  });

  // Gmail API requires base64url encoding
  const encodedMessage = Buffer.from(rawMessage).toString('base64url');

  try {
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage }
    });
    return { messageId: result.data.id, response: 'Sent via Gmail API' };
  } catch (err) {
    if (err.message && err.message.includes('invalid_grant')) {
      throw new Error('Google token expired. Please go to Settings → Google Sheets & Connect and reconnect your Google account.');
    }
    throw err;
  }
}

module.exports = { sendEmail, getOAuth2Client };
