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

## 📋 Workflow: Unified Marketing Intelligence Platform

Here's the entire workflow showing how all these modules work together as a cohesive application:

### 🎯 Application Architecture Overview

This is an AI-powered, omnichannel marketing automation & customer intelligence platform (similar to HubSpot/Klaviyo/Braze combined). Here's how every module connects:

#### 📊 LAYER 1: FOUNDATION (Data & Setup)
Entry Point → Onboarding
```text
rocket_launch Onboarding
   ↓
business Multi-Account Setup → group Users & Seats (assign roles/permissions)
   ↓
support_agent Support (always available)

Data Ingestion Layer
grid_on Google Sheets ──┐
dataset Custom Objects ─┼──→ Central Data Warehouse
inventory_2 Products ───┘
   ↓
people Contacts (24) ← unified customer profiles
```

#### 🧠 LAYER 2: INTELLIGENCE (AI Brain)
Once data flows in, the AI layer activates:
```text
people Contacts
   ↓
   ├──→ hub AI Segments (auto-cluster customers by behavior)
   ├──→ speed Contact Scoring (lead/engagement scoring 0-100)
   ├──→ psychology AI Intelligence (predictive analytics)
   └──→ auto_awesome Aura AI Analyst (conversational insights)
   ↓
layers CRM Pipeline (deals move through stages)
```

#### ✉️ LAYER 3: EXECUTION (Channels & Campaigns)
The AI insights drive multi-channel outreach:
```text
view_quilt Templates (design once)
   ↓
   ├──→ edit_note Email Composer ──┐
   ├──→ travel_explore Scraper ────┼──→ Outreach Engine
   └──→ Channels (SMS/Push/Web) ───┘
   ↓
science A/B Testing (optimize variants)
   ↓
account_tree Automations (trigger-based workflows)
```

#### 🛒 LAYER 4: E-COMMERCE ENGAGEMENT
Product data fuels personalized commerce:
```text
inventory_2 Products
   ↓
   ├──→ recommend Recommendations (AI product suggestions)
   ├──→ confirmation_number Coupons (dynamic discounts)
   ↓
stars Loyalty Program → account_balance_wallet Mobile Wallet
   (points, tiers)        (Apple/Google Wallet passes)
```

#### 📈 LAYER 5: MEASUREMENT & OPTIMIZATION
Everything feeds back into analytics:
```text
All modules ──→ dashboard Dashboard (real-time KPIs)
            ──→ bar_chart Analytics (deep reporting)
            ──→ schedule History (audit trail)
            ──→ auto_awesome Aura AI (recommendations)
```

---

### 🚀 Unified Marketing Automation Platform — End‑to‑End Workflow

Think of your sidebar as 5 stacked layers that feed into each other. Data flows upward (raw data → intelligence → action → revenue → insight), and insights flow back down to refine the system.

#### LAYER 1 — FOUNDATION (Data In)
"Get clean data and people into the system."

| Module | Role in workflow |
|--------|------------------|
| 🚀 Onboarding | New tenant/user setup, connect integrations |
| 🏢 Multi-Account | Manage multiple brands/workspaces |
| 👥 Users & Seats | Team roles & permissions |
| 📊 Google Sheets | Sync external data in/out |
| 🗃️ Custom Objects | Define your own data schemas (e.g., Subscriptions, Properties) |
| 📦 Products | Product catalog (feeds e‑commerce + recommendations) |
| 👤 Contacts | The people database — central hub |
| 🕒 History | Audit trail of every event/change |
**➡️ Output:** A clean, unified contact + product + custom data warehouse.

#### LAYER 2 — INTELLIGENCE (Make Sense of Data)
"Turn raw contacts into actionable audiences and predictions."

| Module | Role |
|--------|------|
| 🧠 AI Segments | Auto-cluster contacts by behavior/intent |
| ⚡ Contact Scoring | Lead/engagement/RFM scores |
| 🔀 CRM Pipeline | Move scored contacts through stages (Lead → MQL → SQL → Customer) |
| 🤖 AI Intelligence | Predictive churn, LTV, next-best-action |
| ✨ Aura AI Analyst | Conversational analyst — ask questions in natural language |
**➡️ Output:** Smart segments + scored pipelines ready to be activated.

#### LAYER 3 — EXECUTION (Reach the Customer)
"Compose, test, and send across channels — automatically."

| Module | Role |
|--------|------|
| 🧩 Templates | Reusable creative blocks |
| ✍️ Email Composer | Build campaigns (AI-assisted) |
| 🌐 Scraper | Enrich contacts / find new leads |
| 📡 Channels | Email, SMS, Push, WhatsApp, Web |
| 🧪 A/B Testing | Optimize subject lines, content, send times |
| 🔁 Automations | Triggered journeys (welcome, cart abandon, win‑back) |
**➡️ Output:** Personalized messages delivered at the right moment.

#### LAYER 4 — E‑COMMERCE & LOYALTY (Drive Revenue)
"Convert engagement into purchases and repeat business."

| Module | Role |
|--------|------|
| 🎯 Recommendations | AI product suggestions in emails/site |
| 🎟️ Coupons | Dynamic, personalized discount codes |
| ⭐ Loyalty Program | Points, tiers, rewards |
| 📱 Mobile Wallet | Apple/Google Wallet passes for coupons & loyalty cards |
**➡️ Output:** Higher AOV, repeat purchase rate, and retention.

#### LAYER 5 — MEASUREMENT (Close the Loop)
"See what worked, learn, and feed it back."

| Module | Role |
|--------|------|
| 📊 Dashboard | Executive KPIs at a glance |
| 📈 Analytics | Deep campaign + cohort performance |
| 🆘 Support | In-app help & ticketing |
**➡️ Output:** Insights → flow back into AI Intelligence & Segments (continuous learning loop).

---

### 🔄 The Complete End-to-End Workflow (Story Mode)

```text
1. ONBOARD  →  User signs up, picks workspace (Multi-Account), invites team (Users & Seats)
        ↓
2. CONNECT  →  Imports Contacts, Products, Custom Objects, syncs Google Sheets
        ↓
3. ENRICH   →  Scraper adds missing data; History logs everything
        ↓
4. UNDERSTAND → AI Segments group contacts; Contact Scoring ranks them;
                CRM Pipeline organizes deals; Aura AI Analyst answers "why?"
        ↓
5. CREATE   →  Templates + Email Composer build campaigns; A/B Testing variants ready
        ↓
6. AUTOMATE →  Automations trigger across Channels (email/SMS/push/wallet)
        ↓
7. CONVERT  →  Recommendations + Coupons + Loyalty Program + Mobile Wallet drive sales
        ↓
8. MEASURE  →  Dashboard + Analytics show results
        ↓
9. LEARN    →  AI Intelligence retrains → updates Segments & Scores → loop restarts
```

---

### 🧭 A Real User Journey Through the App
**Persona:** Sarah, marketing manager at a DTC skincare brand.

- **Day 1 — Onboarding:** Sarah connects Shopify, imports 24 contacts and her product catalog.
- **Day 2 — Intelligence:** AI Segments auto-creates "VIP Buyers," "At‑Risk," "Browsers." Contact Scoring flags 5 hot leads. She asks Aura: "Who's likely to churn this month?"
- **Day 3 — Build:** Uses a Template + Email Composer to draft a win-back email, sets up an A/B test on subject lines.
- **Day 4 — Automate:** Builds an Automation: if score drops > 20 points → send win‑back email + 15% Coupon → add to Mobile Wallet → enroll in Loyalty tier upgrade offer.
- **Day 5 — Launch:** Campaign fires across Channels (email + SMS + push).
- **Day 7 — Measure:** Dashboard shows 32% open, 8% conversion. Analytics reveals SMS outperformed email. AI Intelligence updates the model.
- **Continuous:** Recommendations engine now personalizes every future send. Loop closes. 🔁

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

---

# MailForge — 4-Feature Implementation Plan

## 1. Move API Integrations (WhatsApp, etc.) Under Settings Tab
- **What:** Remove sidebar nav items for WhatsApp, Push, Popups, Integrations, SSO, Dedicated IP
- **How:** Add tabbed sub-sections inside the Settings page with tabs for General, Channels (WhatsApp/Push/Popups), Integrations, SSO, Dedicated IP
- **Files:** `index.html` (sidebar + settings page), `app.js` (router), `app3.js` (settings tab logic)

## 2. Email Composer — Full Image Support
- **What:** Drag & drop, copy/paste, upload image directly into the email body builder
- **How:** Enhance the `image` block in the composer to support:
  - File upload (click to browse)
  - Drag & drop image files onto the image block placeholder
  - Clipboard paste (Ctrl+V) of images
  - All images get uploaded to `/api/upload` and the returned URL is used
- **Files:** `app2.js` (composer block logic), `index.html` (image block area)

## 3. AI Segments — View Segmented Contacts
- **What:** Click on a segment to see the list of contacts that match its criteria
- **How:** Add "View Contacts" button on each segment card, which calls a new API endpoint that evaluates contacts against segment rules and shows them in a modal/drawer
- **Files:** `app3.js` (segment UI), `server.js` (new endpoint), `ai-segmentation.js` (filter logic)

## 4. Automation Workflow Builder — Visual Node Builder (like reference image)
- **What:** Complete redesign of the workflow builder to match the reference screenshot
- **Key features:** 
  - Trigger node (starting point) with colored header
  - Action nodes ("Do This") 
  - Condition nodes (If/Else with true/false branches)
  - "+" button between nodes to add steps (New Step, If/Else, End)
  - Right-side panel for editing selected node properties
  - Publish/Draft status banner
  - Zoom controls, Refresh/Delete block buttons
  - Connector lines between nodes
- **Files:** `app2.js` (builder logic), `index.html` (automations page), `styles.css` (workflow CSS)
