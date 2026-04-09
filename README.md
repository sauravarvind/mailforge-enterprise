# 📧 MailForge — Automatic Email Sender & Scraper

An intelligent email outreach platform that scrapes websites for contacts, discovers decision-makers, verifies emails without sending, syncs with Google Sheets, and sends personalized email campaigns via Gmail.

## ✨ Features

- **🔍 Email Scraping** — Extract emails from any website (auto-scans /contact, /about, /team pages)
- **👤 Decision-Maker Discovery** — Find founders, CEOs, CMOs, and marketing leaders via Hunter.io
- **✅ Email Verification** — Validate emails using MX records & SMTP handshake (no email sent)
- **📊 Google Sheets Sync** — Import/export contacts to Google Sheets
- **📧 Gmail Integration** — Send personalized HTML emails with images via OAuth2
- **🎨 Premium UI** — Beautiful light-themed dashboard with real-time progress tracking

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
Edit `.env` with your credentials. See [SETUP.md](./SETUP.md) for detailed instructions.

### 3. Run the App
```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

## 📋 Workflow

1. **Create Campaign** → Name your outreach campaign
2. **Add Website URLs** → Paste company websites to scan
3. **Scrape Emails** → Automatically extract email addresses
4. **Discover Decision-Makers** → Find founders, CEOs, marketing heads
5. **Verify Emails** → Check validity without sending anything
6. **Remove Invalid** → Clean up bounced/fake emails
7. **Compose & Send** → Write personalized emails with images
8. **Sync to Sheets** → Export results to Google Sheets

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML + CSS + JavaScript |
| Backend | Node.js + Express |
| Scraping | Cheerio + Axios |
| Email | Nodemailer + Gmail OAuth2 |
| Sheets | Google Sheets API v4 |
| Storage | JSON files (local) |

## 📁 Project Structure

```
├── public/                 # Frontend UI
│   ├── index.html         
│   ├── css/styles.css     
│   └── js/app.js          
├── src/
│   ├── services/           # Backend services
│   │   ├── scraper.js      # Website email extraction
│   │   ├── verifier.js     # Email MX/SMTP verification
│   │   ├── mailer.js       # Gmail sending via OAuth2
│   │   ├── sheets.js       # Google Sheets integration
│   │   └── storage.js      # Local JSON storage
│   └── templates/
│       └── email.html      # HTML email template
├── data/                   # Local data storage
│   ├── emails.json         # Contact email database
│   ├── campaigns.json      # Campaign records
│   └── settings.json       # App configuration
├── server.js               # Express API server
├── vercel.json             # Vercel deployment config
├── SETUP.md                # Google Cloud setup guide
└── package.json
```

## 🔒 Privacy & Security

- All data stored locally in JSON files
- OAuth2 tokens stored in `token.json` (gitignored)
- API keys stored in `.env` (gitignored)
- No data sent to third parties (except Google APIs and Hunter.io if configured)

## ⚠️ Legal Disclaimer

- Ensure compliance with CAN-SPAM Act, GDPR, and local email marketing laws
- Always include an unsubscribe option in your emails
- Gmail daily sending limit: ~500 emails (regular) / ~2,000 (Workspace)

## 📄 License

Private — All rights reserved.
