const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = path.join(__dirname, '..', '..', 'credentials.json');
const TOKEN_PATH = path.join(__dirname, '..', '..', 'token.json');

function getOAuth2Client() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials not configured. Please check SETUP.md');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
  );

  // Load saved token if available
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oauth2Client.setCredentials(token);
  }

  return oauth2Client;
}

async function getAccessToken() {
  const oauth2Client = getOAuth2Client();
  const { token } = await oauth2Client.getAccessToken();
  return { oauth2Client, accessToken: token };
}

async function sendEmail({ to, subject, html, imagePath, recipientName, companyName }) {
  const { oauth2Client, accessToken } = await getAccessToken();

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_USER,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: oauth2Client.credentials.refresh_token,
      accessToken
    }
  });

  // Personalize the email body
  let personalizedHtml = html || '';
  personalizedHtml = personalizedHtml
    .replace(/\{\{name\}\}/gi, recipientName || 'there')
    .replace(/\{\{company\}\}/gi, companyName || 'your company')
    .replace(/\{\{email\}\}/gi, to);

  // Wrap in the email template
  const templatePath = path.join(__dirname, '..', 'templates', 'email.html');
  let emailHtml = personalizedHtml;
  
  if (fs.existsSync(templatePath)) {
    let template = fs.readFileSync(templatePath, 'utf8');
    template = template.replace('{{CONTENT}}', personalizedHtml);
    template = template.replace('{{SUBJECT}}', subject || '');
    template = template.replace('{{YEAR}}', new Date().getFullYear().toString());
    template = template.replace('{{SENDER_EMAIL}}', process.env.GMAIL_USER || '');
    emailHtml = template;
  }

  const mailOptions = {
    from: `${process.env.GMAIL_USER_NAME || 'Email Outreach'} <${process.env.GMAIL_USER}>`,
    to,
    subject: (subject || '')
      .replace(/\{\{name\}\}/gi, recipientName || 'there')
      .replace(/\{\{company\}\}/gi, companyName || 'your company'),
    html: emailHtml,
    attachments: []
  };

  // Attach image if provided
  if (imagePath && fs.existsSync(imagePath)) {
    const ext = path.extname(imagePath).toLowerCase();
    mailOptions.attachments.push({
      filename: `image${ext}`,
      path: imagePath,
      cid: 'embedded-image'
    });
    // Add image reference to HTML if not already present
    if (!emailHtml.includes('cid:embedded-image')) {
      mailOptions.html += `<br/><img src="cid:embedded-image" style="max-width:600px;border-radius:8px;" alt="Attached image"/>`;
    }
  }

  const info = await transporter.sendMail(mailOptions);
  return { messageId: info.messageId, response: info.response };
}

module.exports = { sendEmail, getOAuth2Client };
