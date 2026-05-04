# MailForge Enterprise Feature Suite — Implementation Plan

Add 17 enterprise-grade marketing platform features to the existing MailForge system, transforming it from an email outreach tool into a full omnichannel marketing intelligence platform.

## User Review Required

> [!IMPORTANT]
> This is a **massive** scope expansion — approximately **4,000+ lines of new code** across backend services, API routes, storage models, and a complete frontend overhaul. The plan is structured into **4 implementation phases** to keep things manageable.

> [!WARNING]
> Some features (WhatsApp API, real Push Notifications, actual SSO/SAML, Dedicated IP) require **external services and API keys** that cannot function without real integrations. These will be built as **fully functional UI + simulated backend** — all wiring is in place so you just plug in real credentials later.

## Proposed Changes

### Phase 1: Core Platform Upgrades (Contact Scoring, Multi-User, Multi-Account)

---

#### [NEW] `src/services/scoring-engine.js`
Full contact scoring engine with:
- **RFM Analysis** (Recency, Frequency, Monetary) — scores contacts on how recently they engaged, how often, and deal value
- **CLV (Customer Lifetime Value)** prediction — estimates future revenue from each contact
- **Engagement scoring** — weights opens, clicks, replies, page visits
- **Behavioral scoring** — tracks patterns and triggers automation
- **Composite score** with configurable weights

#### [NEW] `src/services/user-manager.js`
Multi-user access system with 10 seats:
- User CRUD (create, read, update, delete)
- Role-based access: `owner`, `admin`, `editor`, `viewer`
- Session management via token-based auth
- Activity logging per user
- Seat limit enforcement (10 seats)

#### [NEW] `src/services/multi-account.js`
Multi-account (brand) management:
- Create/manage multiple business units under one master account
- Per-account data isolation (campaigns, contacts, templates)
- Account switching in the UI
- Shared vs. account-specific settings

#### [MODIFY] `src/services/storage.js`
- Add new JSON files for: `users.json`, `accounts.json`, `scoring_profiles.json`, `segments.json`, `custom_objects.json`, `loyalty.json`, `integrations.json`, `wallet.json`
- Add CRUD functions for all new entities
- Add user/account-scoped data access helpers

#### [MODIFY] `server.js`
- Add API routes for scoring engine (`/api/scoring/*`)
- Add API routes for user management (`/api/users/*`)
- Add API routes for multi-account (`/api/accounts/*`)
- Add simple auth middleware for multi-user

---

### Phase 2: Marketing Channels (WhatsApp, Push, Popups, E-commerce)

---

#### [NEW] `src/services/channels.js`
Omnichannel messaging hub:
- **WhatsApp**: Message composer, template management, delivery tracking (simulated API, ready for Twilio/Meta API)
- **Web Push**: Subscription management, notification composer, scheduling
- **Mobile Push**: FCM-ready notification system
- **Popups**: Visual popup builder with targeting rules, triggers (exit-intent, scroll, time-delay), and A/B testing

#### [NEW] `src/services/ecommerce.js`
Advanced e-commerce features:
- **AI Product Recommendations** — content-based filtering using contact behavior + purchase history
- **Back-in-Stock Alerts** — product watchlist with automated notifications
- **Coupon Engine** — create, distribute, and track discount codes with rules (min purchase, expiry, one-time use)
- Product catalog management (add/edit products)

---

### Phase 3: AI Intelligence (Segmentation, Data Analyst, Loyalty, Wallet)

---

#### [NEW] `src/services/ai-segmentation.js`
Aura AI Segmentation:
- Behavior-based audience clustering (K-means style grouping)
- Attribute-based segment suggestions
- Auto-generated segment names and descriptions
- Real-time segment membership tracking
- Suggested actions per segment

#### [NEW] `src/services/ai-analyst.js`
Aura AI Data Analyst:
- Natural language query parser (no external API needed — rule-based NLP)
- Supports questions like: "How many contacts opened emails last week?", "What's our conversion rate?", "Show top performing campaigns"
- Returns formatted answers with charts/tables
- Query history and bookmarks

#### [NEW] `src/services/loyalty-engine.js`
Custom Loyalty Engine:
- Points system (earn on purchases, referrals, engagement)
- Tier management (Bronze, Silver, Gold, Platinum)
- Rewards catalog
- Points history and redemption tracking
- Auto-tier upgrades based on points

#### [NEW] `src/services/mobile-wallet.js`
Brevo Mobile Wallet:
- Digital card management (loyalty cards, vouchers, tickets, coupons)
- Card template designer
- Pass distribution tracking
- Wallet notification scheduling

---

### Phase 4: Enterprise Features (SSO, Dedicated IP, Integrations, Onboarding)

---

#### [NEW] `src/services/sso-manager.js`
SSO & SAML:
- SAML 2.0 configuration UI
- Identity provider (IdP) settings
- SSO login flow simulation
- User provisioning rules

#### [NEW] `src/services/integrations.js`
Custom Data Integrations:
- Connector management (CRM, POS, ERP, Data Warehouse)
- SFTP configuration
- Sync scheduling and monitoring
- Data mapping interface
- Sync history and error logs

#### [NEW] `src/services/custom-objects.js`
Custom Objects:
- Define custom data schemas (subscription dates, store locations, etc.)
- Import/export custom data
- Use in segmentation and personalization
- Relationship mapping to contacts

#### [MODIFY] `public/index.html`
Major navigation and page additions:
- New sidebar sections: **Channels**, **E-Commerce**, **Loyalty**, **Enterprise**
- 12+ new page sections with full UI
- Enhanced settings page with enterprise options
- Onboarding wizard
- Support contact pages

#### [MODIFY] `public/css/styles.css`
- New component styles for all feature UIs
- Channel icons and status indicators
- Loyalty tier badges and progress bars
- Popup builder canvas styles
- Wallet card preview styles
- AI chat interface styles
- Enterprise settings panels

#### [NEW] `public/js/app3.js`
New frontend module containing:
- All new page rendering functions
- Channel composer (WhatsApp, Push, Popup)
- AI Analyst chat interface
- Loyalty dashboard
- Wallet manager
- Integration configurator
- SSO settings
- Onboarding flow
- Custom objects UI

---

## New Sidebar Navigation Structure

```
OVERVIEW
├── Dashboard
├── Analytics

CHANNELS
├── Email Composer
├── WhatsApp
├── Push Notifications
├── Popups

OUTREACH
├── Scraper
├── Contacts
├── Segments (AI)
├── Templates

INTELLIGENCE
├── CRM Pipeline
├── Contact Scoring
├── A/B Testing
├── AI Intelligence
├── Aura AI Analyst
├── Automations

E-COMMERCE
├── Products
├── Recommendations
├── Coupons

LOYALTY
├── Loyalty Program
├── Mobile Wallet

DATA
├── Custom Objects
├── Integrations
├── History
├── Google Sheets

ENTERPRISE
├── Multi-Account
├── Users & Seats
├── SSO & SAML
├── Dedicated IP
├── Onboarding
├── Support
├── Settings
```

## Verification Plan

### Automated Tests
- Start the server with `npm run dev`
- Navigate each new page section to verify rendering
- Test API endpoints via browser developer console
- Verify scoring engine produces valid RFM/CLV scores
- Test AI Analyst with sample natural-language queries
- Verify loyalty points accumulation and tier progression

### Manual Verification
- Visual inspection of all new UI pages in the browser
- Test drag-and-drop in popup builder
- Test channel switching (Email → WhatsApp → Push)
- Verify multi-user login flow
- Check responsive layout on mobile viewport
