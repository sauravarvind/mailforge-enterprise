require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { initStorage } = require('./src/services/storage');
const scraperService = require('./src/services/scraper');
const verifierService = require('./src/services/verifier');
const mailerService = require('./src/services/mailer');
const sheetsService = require('./src/services/sheets');
const classifierService = require('./src/services/classifier');
const analyticsService = require('./src/services/analytics');
const crmService = require('./src/services/crm');
const abTestingService = require('./src/services/ab-testing');
const intentEngine = require('./src/services/intent-engine');
const schedulerService = require('./src/services/scheduler');
const scoringEngine = require('./src/services/scoring-engine');
const userManager = require('./src/services/user-manager');
const multiAccount = require('./src/services/multi-account');
const channelsService = require('./src/services/channels');
const ecommerceService = require('./src/services/ecommerce');
const aiSegmentation = require('./src/services/ai-segmentation');
const aiAnalyst = require('./src/services/ai-analyst');
const loyaltyEngine = require('./src/services/loyalty-engine');
const mobileWallet = require('./src/services/mobile-wallet');
const enterprise = require('./src/services/enterprise');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.headers['x-session-token'];
  req.user = token ? userManager.validateSession(token) : null;
  next();
}

app.use(optionalAuth);

// File upload config
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage: uploadStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// Initialize data storage
initStorage();
userManager.initUserSystem();
multiAccount.initAccounts();
channelsService.initChannels();
ecommerceService.initEcommerce();
aiSegmentation.initSegments();
loyaltyEngine.initLoyalty();
mobileWallet.initWallet();
enterprise.initEnterprise();
const storageService = require('./src/services/storage');

// Global scraper status tracker
const scraperStatus = { running: false, campaignId: null, progress: '', startedAt: null };

// 1x1 transparent GIF for tracking
const TRACKING_PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

// ─── CAMPAIGN ROUTES ────────────────────────────────────────

app.get('/api/campaigns', (req, res) => {
  try { res.json({ success: true, data: storageService.getCampaigns() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/campaigns', (req, res) => {
  try {
    const { name, industry, productService } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Campaign name is required' });
    const campaign = storageService.createCampaign({ name, industry, productService });
    res.json({ success: true, data: campaign });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/campaigns/:id', (req, res) => {
  try { storageService.deleteCampaign(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── SCRAPER STATUS ─────────────────────────────────────────

app.get('/api/scraper/status', (req, res) => {
  res.json({ success: true, data: scraperStatus });
});

// ─── COMBINED SCRAPE + DISCOVER ─────────────────────────────

app.post('/api/scrape-and-discover', async (req, res) => {
  try {
    const { campaignId, urls } = req.body;
    if (!urls || !urls.length) return res.status(400).json({ success: false, error: 'URLs are required' });

    const campaign = storageService.getCampaign(campaignId);
    scraperStatus.running = true;
    scraperStatus.campaignId = campaignId;
    scraperStatus.progress = `Scraping ${urls.length} URL(s)...`;
    scraperStatus.startedAt = new Date().toISOString();

    res.json({ success: true, message: 'Scrape & Discover started', campaignId });

    const results = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      scraperStatus.progress = `Scraping ${i + 1}/${urls.length}: ${url}`;
      try {
        const emails = await scraperService.scrapeWebsite(url);
        for (const email of emails) {
          storageService.addContact({
            email: email.email, name: email.name || '', role: email.role || '',
            company: email.company || new URL(url).hostname.replace('www.', ''),
            industry: campaign?.industry || '', productService: campaign?.productService || '',
            source: url, campaignId, status: 'scraped'
          });
          results.push(email);
        }

        const settings = storageService.getSettings();
        const hunterKey = settings.hunterKey || process.env.HUNTER_API_KEY;
        if (hunterKey) {
          scraperStatus.progress = `Discovering decision-makers on ${new URL(url).hostname}...`;
          try {
            const domain = new URL(url).hostname.replace('www.', '');
            process.env.HUNTER_API_KEY = hunterKey;
            const targetRoles = ['founder', 'co-founder', 'ceo', 'cmo', 'marketing head', 'marketing specialist', 'marketing manager', 'coo', 'cto'];
            const discovered = await scraperService.discoverWithHunter(domain, targetRoles);
            for (const contact of discovered) {
              storageService.addContact({ ...contact, industry: campaign?.industry || '', productService: campaign?.productService || '', campaignId, source: `hunter:${domain}`, status: 'discovered' });
              results.push(contact);
            }
          } catch (err) { console.error('Hunter error:', err.message); }
        }
      } catch (err) { console.error(`Error processing ${url}:`, err.message); }
    }

    storageService.updateCampaign(campaignId, { status: 'scraped', scrapedCount: results.length, lastActivity: new Date().toISOString() });
    scraperStatus.running = false;
    scraperStatus.progress = `Done! Found ${results.length} contacts.`;
    scraperStatus.campaignId = null;
  } catch (err) {
    scraperStatus.running = false;
    scraperStatus.progress = 'Error: ' + err.message;
    console.error('Scrape & Discover error:', err);
  }
});

// ─── AUTONOMOUS DISCOVERY ───────────────────────────────────

app.post('/api/scrape/autonomous', async (req, res) => {
  try {
    const { campaignId, industry, role, product } = req.body;
    if (!campaignId || !industry || !role) return res.status(400).json({ success: false, error: 'CampaignId, industry, and role are required' });

    const campaign = storageService.getCampaign(campaignId);
    scraperStatus.running = true;
    scraperStatus.campaignId = campaignId;
    scraperStatus.progress = `Autonomous DuckDuckGo Discovery: ${industry} - ${role}...`;
    scraperStatus.startedAt = new Date().toISOString();

    res.json({ success: true, message: 'Autonomous discovery started', campaignId });

    // Step 1: Discover domains from DDG
    const domains = await scraperService.autonomousDiscovery(industry, role, product || '');
    
    // Step 2: Extract emails
    const results = [];
    for (let i = 0; i < domains.length; i++) {
      const url = domains[i];
      scraperStatus.progress = `Scraping Autonomous Target ${i + 1}/${domains.length}: ${url}`;
      try {
        const emails = await scraperService.scrapeWebsite(url);
        for (const email of emails) {
          storageService.addContact({
            email: email.email, name: email.name || '', role: email.role || '',
            company: email.company || new URL(url).hostname.replace('www.', ''),
            industry, productService: product || '',
            source: 'autonomous', campaignId, status: 'scraped'
          });
          results.push(email);
        }

        const settings = storageService.getSettings();
        const hunterKey = settings.hunterKey || process.env.HUNTER_API_KEY;
        if (hunterKey) {
          scraperStatus.progress = `Hunter Verification on ${new URL(url).hostname}...`;
          try {
            const domain = new URL(url).hostname.replace('www.', '');
            process.env.HUNTER_API_KEY = hunterKey;
            const targetRoles = [role.toLowerCase(), 'ceo', 'founder'];
            const discovered = await scraperService.discoverWithHunter(domain, targetRoles);
            for (const contact of discovered) {
              storageService.addContact({ ...contact, industry, productService: product || '', campaignId, source: `hunter:${domain}`, status: 'discovered' });
              results.push(contact);
            }
          } catch (err) { console.error('Hunter error:', err.message); }
        }
      } catch (err) { console.error(`Error processing autonomous target ${url}:`, err.message); }
    }

    storageService.updateCampaign(campaignId, { status: 'scraped', scrapedCount: results.length, lastActivity: new Date().toISOString() });
    scraperStatus.running = false;
    scraperStatus.progress = `Done! Found ${results.length} contacts automatically.`;
    scraperStatus.campaignId = null;
  } catch (err) {
    scraperStatus.running = false;
    scraperStatus.progress = 'Error: ' + err.message;
    console.error('Autonomous Scrape error:', err);
  }
});

app.get('/api/scrape/status/:campaignId', (req, res) => {
  try {
    const contacts = storageService.getContactsByCampaign(req.params.campaignId);
    const campaign = storageService.getCampaign(req.params.campaignId);
    res.json({ success: true, data: { campaign, contacts: contacts.filter(c => ['scraped', 'discovered'].includes(c.status)), scraperStatus } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── VERIFICATION ROUTES ────────────────────────────────────

app.post('/api/verify', async (req, res) => {
  try {
    const { campaignId, contactIds } = req.body;
    let contacts;
    if (contactIds && contactIds.length) {
      contacts = contactIds.map(id => storageService.getContact(id)).filter(Boolean);
    } else if (campaignId) {
      contacts = storageService.getContactsByCampaign(campaignId).filter(c => !['verified', 'invalid'].includes(c.status));
    } else {
      return res.status(400).json({ success: false, error: 'Provide campaignId or contactIds' });
    }
    res.json({ success: true, message: `Verifying ${contacts.length} emails`, total: contacts.length });

    let verified = 0, invalid = 0;
    for (const contact of contacts) {
      try {
        const result = await verifierService.verifyEmail(contact.email);
        storageService.updateContact(contact.id, { status: result.valid ? 'verified' : 'invalid', verificationDetails: result });
        if (result.valid) verified++; else invalid++;
      } catch (err) { storageService.updateContact(contact.id, { status: 'unknown' }); }
    }
    if (campaignId) storageService.updateCampaign(campaignId, { status: 'verified', verifiedCount: verified, invalidCount: invalid, lastActivity: new Date().toISOString() });
  } catch (err) { console.error('Verification error:', err); }
});

app.post('/api/contacts/:id/verify-manual', (req, res) => {
  try {
    const updated = storageService.updateContact(req.params.id, { status: 'verified', verificationDetails: { method: 'manual_override' } });
    if (!updated) return res.status(404).json({ success: false, error: 'Contact not found' });
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/verify/status/:campaignId', (req, res) => {
  try {
    const contacts = storageService.getContactsByCampaign(req.params.campaignId);
    const stats = { total: contacts.length, verified: contacts.filter(c => c.status === 'verified').length, invalid: contacts.filter(c => c.status === 'invalid').length, pending: contacts.filter(c => !['verified', 'invalid'].includes(c.status)).length };
    res.json({ success: true, data: { stats, contacts } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── CONTACTS ROUTES ────────────────────────────────────────

app.get('/api/contacts', (req, res) => {
  try {
    const { campaignId, status, domain, classification, stage } = req.query;
    let contacts = campaignId ? storageService.getContactsByCampaign(campaignId) : storageService.getAllContacts();
    if (status) contacts = contacts.filter(c => c.status === status);
    if (domain) contacts = contacts.filter(c => c.email && c.email.split('@')[1] === domain);
    if (classification) contacts = contacts.filter(c => c.classification?.category === classification);
    if (stage) contacts = contacts.filter(c => (c.lifecycleStage || 'lead') === stage);
    res.json({ success: true, data: contacts });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/contacts', (req, res) => {
  try {
    const { email, name, role, company, industry, productService, campaignId, status } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });
    if (!campaignId) return res.status(400).json({ success: false, error: 'Campaign is required' });
    const contact = storageService.addContact({
      email: email.trim().toLowerCase(), name: name || '', role: role || '', company: company || '',
      industry: industry || '', productService: productService || '', campaignId,
      source: 'manual', status: status || 'manual'
    });
    res.json({ success: true, data: contact });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.put('/api/contacts/:id', (req, res) => {
  try {
    const updated = storageService.updateContact(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Contact not found' });
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/contacts/:id', (req, res) => {
  try { storageService.deleteContact(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/contacts/all/:campaignId', (req, res) => {
  try {
    const removed = storageService.deleteAllContacts(req.params.campaignId);
    res.json({ success: true, removed });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/contacts/invalid/:campaignId', (req, res) => {
  try {
    const removed = storageService.removeInvalidContacts(req.params.campaignId);
    res.json({ success: true, removed });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// CSV Upload
app.post('/api/contacts/upload-csv', upload.single('csvFile'), (req, res) => {
  try {
    const { campaignId } = req.body;
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    if (!campaignId) return res.status(400).json({ success: false, error: 'Campaign is required' });

    const csvContent = fs.readFileSync(req.file.path, 'utf8');
    const lines = csvContent.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return res.status(400).json({ success: false, error: 'CSV must have a header row and at least one data row' });

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const emailIdx = headers.findIndex(h => h.includes('email'));
    const nameIdx = headers.findIndex(h => h.includes('name'));
    const roleIdx = headers.findIndex(h => h.includes('role') || h.includes('position') || h.includes('title'));
    const companyIdx = headers.findIndex(h => h.includes('company') || h.includes('organization'));
    const industryIdx = headers.findIndex(h => h.includes('industry'));
    const productIdx = headers.findIndex(h => h.includes('product') || h.includes('service'));

    if (emailIdx === -1) return res.status(400).json({ success: false, error: 'CSV must have an "email" column' });

    let added = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      const email = cols[emailIdx];
      if (!email || !email.includes('@')) continue;

      storageService.addContact({
        email: email.toLowerCase(), name: cols[nameIdx] || '', role: cols[roleIdx] || '',
        company: cols[companyIdx] || '', industry: cols[industryIdx] || '', productService: cols[productIdx] || '',
        campaignId, source: 'csv_upload', status: 'manual'
      });
      added++;
    }

    fs.unlinkSync(req.file.path);
    res.json({ success: true, added, message: `Uploaded ${added} contacts` });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── CLASSIFICATION ROUTES ──────────────────────────────────

app.post('/api/classify', (req, res) => {
  try {
    const { campaignId, contactIds } = req.body;
    let contacts;
    if (contactIds && contactIds.length) {
      contacts = contactIds.map(id => storageService.getContact(id)).filter(Boolean);
    } else if (campaignId) {
      contacts = storageService.getContactsByCampaign(campaignId);
    } else {
      contacts = storageService.getAllContacts();
    }

    const results = classifierService.classifyContacts(contacts);
    for (const r of results) {
      storageService.updateContact(r.contactId, {
        classification: { category: r.category, confidence: r.confidence, reasons: r.reasons, classifiedAt: new Date().toISOString() }
      });
    }
    res.json({ success: true, data: results, total: results.length });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/classify/stats/:campaignId', (req, res) => {
  try {
    const contacts = storageService.getContactsByCampaign(req.params.campaignId);
    const stats = classifierService.getClassificationStats(contacts);
    res.json({ success: true, data: stats });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/classify/stats', (req, res) => {
  try {
    const contacts = storageService.getAllContacts();
    const stats = classifierService.getClassificationStats(contacts);
    res.json({ success: true, data: stats });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.put('/api/contacts/:id/classify', (req, res) => {
  try {
    const { category } = req.body;
    const updated = storageService.updateContact(req.params.id, {
      classification: { category, confidence: 100, reasons: ['Manual override'], classifiedAt: new Date().toISOString() }
    });
    if (!updated) return res.status(404).json({ success: false, error: 'Contact not found' });
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── ANALYTICS ROUTES ───────────────────────────────────────

app.get('/api/analytics/domains', (req, res) => {
  try {
    const { campaignId } = req.query;
    const contacts = campaignId ? storageService.getContactsByCampaign(campaignId) : storageService.getAllContacts();
    const domains = analyticsService.getDomainAnalytics(contacts);
    res.json({ success: true, data: domains });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/analytics/overview', (req, res) => {
  try {
    const contacts = storageService.getAllContacts();
    const history = storageService.getHistory();
    const overview = analyticsService.getOverviewAnalytics(contacts, history);
    res.json({ success: true, data: overview });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/analytics/timeline', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const contacts = storageService.getAllContacts();
    const timeline = analyticsService.getTimelineData(contacts, days);
    res.json({ success: true, data: timeline });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── CRM ROUTES ─────────────────────────────────────────────

app.put('/api/contacts/:id/stage', (req, res) => {
  try {
    const { stage } = req.body;
    if (!crmService.LIFECYCLE_STAGES.includes(stage)) {
      return res.status(400).json({ success: false, error: 'Invalid lifecycle stage' });
    }
    const updated = storageService.updateContact(req.params.id, { lifecycleStage: stage, lastInteraction: new Date().toISOString() });
    if (!updated) return res.status(404).json({ success: false, error: 'Contact not found' });
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/crm/pipeline', (req, res) => {
  try {
    const { campaignId } = req.query;
    const contacts = campaignId ? storageService.getContactsByCampaign(campaignId) : storageService.getAllContacts();
    const pipeline = crmService.getPipelineData(contacts);
    res.json({ success: true, data: pipeline });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/crm/leaderboard', (req, res) => {
  try {
    const contacts = storageService.getAllContacts();
    const leaderboard = crmService.getLeaderboard(contacts);
    res.json({ success: true, data: leaderboard });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/crm/score', (req, res) => {
  try {
    const { campaignId } = req.body;
    const contacts = campaignId ? storageService.getContactsByCampaign(campaignId) : storageService.getAllContacts();
    let updated = 0;
    for (const c of contacts) {
      const score = crmService.calculateLeadScore(c);
      const suggestion = crmService.suggestStageTransition({ ...c, leadScore: score });
      storageService.updateContact(c.id, { leadScore: score });
      updated++;
    }
    res.json({ success: true, message: `Scored ${updated} contacts` });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// CRM Notes
app.get('/api/crm/notes/:contactId', (req, res) => {
  try { res.json({ success: true, data: storageService.getCRMNotes(req.params.contactId) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/crm/notes', (req, res) => {
  try {
    const { contactId, content, type } = req.body;
    if (!contactId || !content) return res.status(400).json({ success: false, error: 'contactId and content required' });
    const note = storageService.addCRMNote({ contactId, content, type });
    storageService.updateContact(contactId, { lastInteraction: new Date().toISOString(), interactionCount: (storageService.getContact(contactId)?.interactionCount || 0) + 1 });
    res.json({ success: true, data: note });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/crm/notes/:id', (req, res) => {
  try { storageService.deleteCRMNote(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// CRM Tags
app.get('/api/crm/tags', (req, res) => {
  try { res.json({ success: true, data: storageService.getCRMTags() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/crm/tags', (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Tag name required' });
    res.json({ success: true, data: storageService.createCRMTag({ name, color }) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/crm/tags/:id', (req, res) => {
  try { storageService.deleteCRMTag(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.put('/api/contacts/:id/tags', (req, res) => {
  try {
    const { tags } = req.body;
    const updated = storageService.updateContact(req.params.id, { tags });
    if (!updated) return res.status(404).json({ success: false, error: 'Contact not found' });
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// CRM Deals
app.get('/api/crm/deals', (req, res) => {
  try { res.json({ success: true, data: storageService.getCRMDeals() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/crm/deals', (req, res) => {
  try {
    const deal = storageService.createCRMDeal(req.body);
    if (req.body.contactId && req.body.value) {
      storageService.updateContact(req.body.contactId, { dealValue: req.body.value });
    }
    res.json({ success: true, data: deal });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.put('/api/crm/deals/:id', (req, res) => {
  try {
    const updated = storageService.updateCRMDeal(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Deal not found' });
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── A/B TESTING ROUTES ─────────────────────────────────────

app.get('/api/ab-tests', (req, res) => {
  try { res.json({ success: true, data: storageService.getABTests() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/ab-test', (req, res) => {
  try {
    const { campaignId, name, variants } = req.body;
    if (!campaignId) return res.status(400).json({ success: false, error: 'Campaign required' });
    if (!variants || variants.length < 2) return res.status(400).json({ success: false, error: 'At least 2 variants required' });
    const test = abTestingService.createABTest({ campaignId, name, variants });

    // Auto-assign contacts
    const contacts = storageService.getContactsByCampaign(campaignId).filter(c => c.status === 'verified');
    abTestingService.assignContactsToVariants(test, contacts.map(c => c.id));
    test.status = 'running';
    test.startedAt = new Date().toISOString();

    storageService.saveABTest(test);
    res.json({ success: true, data: test });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/ab-test/:id', (req, res) => {
  try {
    const test = storageService.getABTest(req.params.id);
    if (!test) return res.status(404).json({ success: false, error: 'Test not found' });
    const metrics = abTestingService.calculateVariantMetrics(test);
    const winner = test.variants.length >= 2 ? abTestingService.determineWinner(test) : null;
    res.json({ success: true, data: { ...test, variantMetrics: metrics, suggestedWinner: winner } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/ab-test/:id', (req, res) => {
  try { storageService.deleteABTest(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/ab-test/:id/winner', (req, res) => {
  try {
    const test = storageService.getABTest(req.params.id);
    if (!test) return res.status(404).json({ success: false, error: 'Test not found' });
    const winner = abTestingService.determineWinner(test);
    test.winner = winner;
    test.status = 'completed';
    test.completedAt = new Date().toISOString();
    storageService.saveABTest(test);
    res.json({ success: true, data: { test, winner } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── TRACKING ROUTES ────────────────────────────────────────

app.get('/api/track/open/:trackingId', (req, res) => {
  try {
    const parsed = abTestingService.parseTrackingId(req.params.trackingId);
    if (parsed) {
      storageService.addTrackingEvent({ type: 'open', ...parsed, ip: req.ip, userAgent: req.headers['user-agent'] });
      // Update contact tracking data
      const contact = storageService.getContact(parsed.contactId);
      if (contact) {
        storageService.updateContact(parsed.contactId, {
          trackingData: { ...contact.trackingData, opened: true, openCount: (contact.trackingData?.openCount || 0) + 1 },
          lastInteraction: new Date().toISOString(),
          interactionCount: (contact.interactionCount || 0) + 1
        });
      }
      // Update A/B test metrics
      const test = storageService.getABTest(parsed.testId);
      if (test) {
        const variant = test.variants.find(v => v.id === parsed.variantId);
        if (variant) { variant.metrics.opened = (variant.metrics.opened || 0) + 1; storageService.saveABTest(test); }
      }
    }
  } catch (err) { console.error('Track open error:', err); }
  res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache' });
  res.send(TRACKING_PIXEL);
});

app.get('/api/track/click/:trackingId', (req, res) => {
  try {
    const url = req.query.url || '/';
    const parsed = abTestingService.parseTrackingId(req.params.trackingId);
    if (parsed) {
      storageService.addTrackingEvent({ type: 'click', ...parsed, url, ip: req.ip });
      const contact = storageService.getContact(parsed.contactId);
      if (contact) {
        storageService.updateContact(parsed.contactId, {
          trackingData: { ...contact.trackingData, clicked: true, clickCount: (contact.trackingData?.clickCount || 0) + 1 },
          lastInteraction: new Date().toISOString(),
          interactionCount: (contact.interactionCount || 0) + 1
        });
      }
      const test = storageService.getABTest(parsed.testId);
      if (test) {
        const variant = test.variants.find(v => v.id === parsed.variantId);
        if (variant) { variant.metrics.clicked = (variant.metrics.clicked || 0) + 1; storageService.saveABTest(test); }
      }
    }
    res.redirect(url);
  } catch (err) { res.redirect(req.query.url || '/'); }
});

app.get('/api/funnel/:campaignId', (req, res) => {
  try {
    const contacts = storageService.getContactsByCampaign(req.params.campaignId);
    const trackingEvents = storageService.getTrackingEvents();
    const funnel = abTestingService.getFunnelData(contacts, trackingEvents);
    res.json({ success: true, data: funnel });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/heatmap/:campaignId', (req, res) => {
  try {
    const trackingEvents = storageService.getTrackingEvents();
    const heatmap = abTestingService.getLinkHeatmap(trackingEvents);
    res.json({ success: true, data: heatmap });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── INTELLIGENCE ROUTES (Phase 6) ──────────────────────────

app.get('/api/intent/:contactId', (req, res) => {
  try {
    const contact = storageService.getContact(req.params.contactId);
    if (!contact) return res.status(404).json({ success: false, error: 'Contact not found' });
    const trackingEvents = storageService.getTrackingEvents();
    const intent = intentEngine.calculateIntentScore(contact, trackingEvents);
    const twin = intentEngine.buildDigitalTwin(contact, trackingEvents);
    storageService.saveDigitalTwin(twin);
    res.json({ success: true, data: { intent, digitalTwin: twin } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/digital-twin/:contactId', (req, res) => {
  try {
    const contact = storageService.getContact(req.params.contactId);
    if (!contact) return res.status(404).json({ success: false, error: 'Contact not found' });
    const trackingEvents = storageService.getTrackingEvents();
    const twin = intentEngine.buildDigitalTwin(contact, trackingEvents);
    storageService.saveDigitalTwin(twin);
    res.json({ success: true, data: twin });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/ai/copywrite', (req, res) => {
  try {
    const { stage, tone, contactName, companyName } = req.body;
    const copy = intentEngine.generateCopy({ stage: stage || 'lead', tone: tone || 'casual', contactName, companyName });
    res.json({ success: true, data: copy });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/ai/subject-lines', (req, res) => {
  try {
    const { contactId } = req.query;
    let contact = { name: 'there', company: 'your company', lifecycleStage: 'lead' };
    if (contactId) {
      const c = storageService.getContact(contactId);
      if (c) contact = c;
    }
    const lines = intentEngine.generateSubjectLines(contact);
    res.json({ success: true, data: lines });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/multichannel/:contactId', (req, res) => {
  try {
    const contact = storageService.getContact(req.params.contactId);
    if (!contact) return res.status(404).json({ success: false, error: 'Contact not found' });
    const messages = intentEngine.generateMultichannelMessages(contact, '');
    res.json({ success: true, data: messages });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── SCHEDULE ROUTES ────────────────────────────────────────

app.post('/api/schedule', (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !items.length) return res.status(400).json({ success: false, error: 'Items required' });
    const scheduled = schedulerService.scheduleEmails(items);
    res.json({ success: true, data: scheduled });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/schedule/queue', (req, res) => {
  try {
    const status = req.query.status;
    const queue = schedulerService.getQueue(status);
    const stats = schedulerService.getQueueStats();
    res.json({ success: true, data: { queue, stats } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/schedule/:id', (req, res) => {
  try {
    schedulerService.cancelScheduled(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── TEST EMAIL ─────────────────────────────────────────────

app.post('/api/send/test', upload.single('image'), async (req, res) => {
  try {
    const { testEmail, subject, body } = req.body;
    if (!testEmail) return res.status(400).json({ success: false, error: 'Test email address is required' });
    if (!subject) return res.status(400).json({ success: false, error: 'Subject is required' });

    const imagePath = req.file ? req.file.path : null;
    await mailerService.sendEmail({
      to: testEmail, subject: `[TEST] ${subject}`, html: body,
      imagePath, recipientName: 'Test User', companyName: 'Test Company'
    });
    res.json({ success: true, message: `Test email sent to ${testEmail}` });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── EMAIL SENDING ──────────────────────────────────────────

app.post('/api/send', upload.single('image'), async (req, res) => {
  try {
    const { campaignId, subject, body, contactIds } = req.body;
    const imagePath = req.file ? req.file.path : null;

    let contacts;
    if (contactIds) {
      const ids = JSON.parse(contactIds);
      contacts = ids.map(id => storageService.getContact(id)).filter(Boolean);
    } else {
      contacts = storageService.getContactsByCampaign(campaignId).filter(c => c.status === 'verified');
    }

    if (!contacts.length) return res.status(400).json({ success: false, error: 'No verified contacts to send to' });

    const campaign = storageService.getCampaign(campaignId);
    let skipped = 0;
    contacts = contacts.filter(c => {
      if (storageService.isAlreadySent(c.email, campaignId)) { skipped++; return false; }
      return true;
    });

    if (!contacts.length) return res.json({ success: true, message: `All ${skipped} contacts already emailed`, total: 0, skipped });

    res.json({ success: true, message: `Sending to ${contacts.length} contacts (${skipped} duplicates skipped)`, total: contacts.length, skipped });

    let sent = 0, failed = 0;
    for (const contact of contacts) {
      try {
        await mailerService.sendEmail({ to: contact.email, subject, html: body, imagePath, recipientName: contact.name, companyName: contact.company });
        storageService.updateContact(contact.id, { status: 'sent', sentAt: new Date().toISOString() });
        storageService.addHistoryEntry({ type: 'email_sent', email: contact.email, contactName: contact.name, company: contact.company, subject, campaignId, campaignName: campaign?.name || '', status: 'sent' });
        sent++;
        await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
      } catch (err) {
        storageService.updateContact(contact.id, { status: 'send_failed', error: err.message });
        storageService.addHistoryEntry({ type: 'email_failed', email: contact.email, contactName: contact.name, company: contact.company, subject, campaignId, campaignName: campaign?.name || '', status: 'failed', error: err.message });
        failed++;
      }
    }
    storageService.updateCampaign(campaignId, { status: 'sent', sentCount: sent, failedCount: failed, lastActivity: new Date().toISOString() });
  } catch (err) { console.error('Send error:', err); res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/send/status/:campaignId', (req, res) => {
  try {
    const contacts = storageService.getContactsByCampaign(req.params.campaignId);
    const stats = { total: contacts.length, sent: contacts.filter(c => c.status === 'sent').length, failed: contacts.filter(c => c.status === 'send_failed').length, pending: contacts.filter(c => c.status === 'verified').length };
    res.json({ success: true, data: { stats, contacts } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── AUTOMATIONS ROUTES ─────────────────────────────────────

app.get('/api/automations', (req, res) => {
  try { res.json({ success: true, data: storageService.getAutomations() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/automations', (req, res) => {
  try { 
    const auto = req.body;
    const newAuto = { ...auto, id: 'auto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6) };
    storageService.saveAutomation(newAuto);
    res.json({ success: true, data: newAuto }); 
  }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.put('/api/automations/:id', (req, res) => {
  try {
    const existing = storageService.getAutomation(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    storageService.saveAutomation(updated);
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/automations/:id', (req, res) => {
  try { storageService.deleteAutomation(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── HISTORY ROUTES ─────────────────────────────────────────

app.get('/api/history', (req, res) => {
  try {
    let history = storageService.getHistory();
    const { campaignId, limit } = req.query;
    if (campaignId) history = history.filter(h => h.campaignId === campaignId);
    if (limit) history = history.slice(0, parseInt(limit));
    res.json({ success: true, data: history });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── TEMPLATE ROUTES ────────────────────────────────────────

app.get('/api/templates', (req, res) => {
  try {
    let templates = storageService.getTemplates();
    const { category } = req.query;
    if (category) templates = templates.filter(t => t.category === category);
    res.json({ success: true, data: templates });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/templates', (req, res) => {
  try {
    const { name, subject, body, category, tags, description } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Template name is required' });
    res.json({ success: true, data: storageService.saveTemplate({ name, subject, body, category, tags, description }) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.put('/api/templates/:id', (req, res) => {
  try {
    const updated = storageService.updateTemplate(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Template not found' });
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/templates/:id', (req, res) => {
  try { storageService.deleteTemplate(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/templates/:id/duplicate', (req, res) => {
  try {
    const dup = storageService.duplicateTemplate(req.params.id);
    if (!dup) return res.status(404).json({ success: false, error: 'Template not found' });
    res.json({ success: true, data: dup });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/templates/:id/use', (req, res) => {
  try {
    storageService.incrementTemplateUse(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── AUTOMATIONS ROUTES ─────────────────────────────────────

app.get('/api/automations', (req, res) => {
  try { res.json({ success: true, data: storageService.getAutomations() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/automations', (req, res) => {
  try {
    const { name, trigger, rules, active } = req.body;
    if (!name || !trigger) return res.status(400).json({ success: false, error: 'Name and Trigger are required' });
    const automation = { name, trigger, rules: rules || [], active: active !== false };
    storageService.saveAutomation(automation);
    res.json({ success: true, data: automation });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.put('/api/automations/:id', (req, res) => {
  try {
    const updated = { id: req.params.id, ...req.body };
    storageService.saveAutomation(updated);
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/automations/:id', (req, res) => {
  try { storageService.deleteAutomation(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/automations/process', (req, res) => {
  try {
    const result = schedulerService.processAutomations();
    res.json({ success: true, ...result });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── GOOGLE AUTH ROUTES ─────────────────────────────────────

app.get('/api/auth/google', (req, res) => {
  try { res.json({ success: true, url: sheetsService.getAuthUrl() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.get('/api/auth/google/callback', async (req, res) => {
  try { await sheetsService.handleCallback(req.query.code); res.redirect('/?auth=success'); }
  catch (err) { res.redirect('/?auth=error&message=' + encodeURIComponent(err.message)); }
});
app.get('/api/auth/status', (req, res) => {
  const tokenPath = path.join(__dirname, 'token.json');
  res.json({ success: true, authenticated: fs.existsSync(tokenPath) });
});

// ─── GOOGLE SHEETS ROUTES ───────────────────────────────────

app.post('/api/sheets/export', async (req, res) => {
  try {
    const { campaignId, sheetId } = req.body;
    const contacts = storageService.getContactsByCampaign(campaignId).filter(c => c.status === 'verified');
    const result = await sheetsService.exportContacts(sheetId || process.env.GOOGLE_SHEET_ID, contacts);
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.post('/api/sheets/import', async (req, res) => {
  try {
    const { campaignId, sheetId, range } = req.body;
    const contacts = await sheetsService.importContacts(sheetId || process.env.GOOGLE_SHEET_ID, range);
    for (const contact of contacts) storageService.addContact({ ...contact, campaignId, status: 'imported' });
    res.json({ success: true, data: contacts });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── SETTINGS ROUTES ────────────────────────────────────────

app.get('/api/settings', (req, res) => {
  try { res.json({ success: true, data: storageService.getSettings() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.post('/api/settings', (req, res) => {
  try { storageService.saveSettings(req.body); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── MANUAL SYNC ────────────────────────────────────────────
app.post('/api/sync', async (req, res) => {
  try { await storageService.syncToGoogleSheets(); res.json({ success: true, message: 'Synced' }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── IMAGE UPLOAD ───────────────────────────────────────────
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    res.json({ success: true, data: { filename: req.file.filename, path: `/uploads/${req.file.filename}`, size: req.file.size } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ═══════════════════════════════════════════════════════════
//  NEW FEATURE API ROUTES
// ═══════════════════════════════════════════════════════════

// ─── SCORING ENGINE ─────────────────────────────────────────
app.post('/api/scoring/compute', (req, res) => {
  try {
    const { campaignId } = req.body;
    const contacts = campaignId ? storageService.getContactsByCampaign(campaignId) : storageService.getAllContacts();
    const history = storageService.getHistory();
    const trackingEvents = storageService.getTrackingEvents();
    const results = scoringEngine.scoreAllContacts(contacts, history, trackingEvents);
    for (const r of results) {
      storageService.updateContact(r.contactId, { scoringData: r, leadScore: r.composite });
    }
    res.json({ success: true, data: results, total: results.length });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/scoring/:contactId', (req, res) => {
  try {
    const contact = storageService.getContact(req.params.contactId);
    if (!contact) return res.status(404).json({ success: false, error: 'Contact not found' });
    const history = storageService.getHistory();
    const trackingEvents = storageService.getTrackingEvents();
    const score = scoringEngine.calculateCompositeScore(contact, history, trackingEvents);
    res.json({ success: true, data: score });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── MULTI-USER ─────────────────────────────────────────────
app.get('/api/users', (req, res) => {
  try { res.json({ success: true, data: userManager.getUsers() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/users/seats', (req, res) => {
  try { res.json({ success: true, data: userManager.getSeatInfo() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/users', (req, res) => {
  try {
    const user = userManager.createUser(req.body);
    res.json({ success: true, data: user });
  } catch (err) { res.status(400).json({ success: false, error: err.message }); }
});

app.put('/api/users/:id', (req, res) => {
  try {
    const updated = userManager.updateUser(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/users/:id', (req, res) => {
  try { userManager.deleteUser(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(400).json({ success: false, error: err.message }); }
});

app.get('/api/users/activity', (req, res) => {
  try { res.json({ success: true, data: userManager.getActivityLog(null, 100) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email } = req.body;
    const user = userManager.getUserByEmail(email || 'admin@mailforge.local');
    if (!user || !user.isActive) return res.status(401).json({ success: false, error: 'User not found or inactive' });
    const session = userManager.createSession(user.id);
    userManager.logActivity(user.id, 'login', { simulated: true });
    res.json({ success: true, data: { token: session.token, expiresAt: session.expiresAt, user } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/auth/me', (req, res) => {
  res.json({ success: true, data: req.user || userManager.getUsers()[0] || null });
});

// ─── MULTI-ACCOUNT ──────────────────────────────────────────
app.get('/api/accounts', (req, res) => {
  try { res.json({ success: true, data: multiAccount.getAccounts() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/accounts', (req, res) => {
  try { res.json({ success: true, data: multiAccount.createAccount(req.body) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.put('/api/accounts/:id', (req, res) => {
  try {
    const updated = multiAccount.updateAccount(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Account not found' });
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/accounts/:id', (req, res) => {
  try { multiAccount.deleteAccount(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(400).json({ success: false, error: err.message }); }
});

// ─── CHANNELS (WhatsApp, Push, Popups) ──────────────────────
app.post('/api/channels/whatsapp/send', (req, res) => {
  try { res.json({ success: true, data: channelsService.sendWhatsApp(req.body) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/channels/whatsapp/messages', (req, res) => {
  try { res.json({ success: true, data: channelsService.getWhatsAppMessages() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/channels/push/web', (req, res) => {
  try { res.json({ success: true, data: channelsService.sendPushNotification(req.body) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/channels/push/mobile', (req, res) => {
  try { res.json({ success: true, data: channelsService.sendMobilePush(req.body) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/channels/push/subscriptions', (req, res) => {
  try { res.json({ success: true, data: channelsService.getPushSubscriptions() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/channels/push/subscriptions', (req, res) => {
  try { res.json({ success: true, data: channelsService.addPushSubscription(req.body) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/channels/stats', (req, res) => {
  try { res.json({ success: true, data: channelsService.getChannelStats() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/popups', (req, res) => {
  try { res.json({ success: true, data: channelsService.getPopups() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/popups', (req, res) => {
  try { res.json({ success: true, data: channelsService.createPopup(req.body) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.put('/api/popups/:id', (req, res) => {
  try {
    const updated = channelsService.updatePopup(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Popup not found' });
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/popups/:id', (req, res) => {
  try { channelsService.deletePopup(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── E-COMMERCE ─────────────────────────────────────────────
app.get('/api/products', (req, res) => {
  try { res.json({ success: true, data: ecommerceService.getProducts() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/products', (req, res) => {
  try { res.json({ success: true, data: ecommerceService.createProduct(req.body) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.put('/api/products/:id', (req, res) => {
  try {
    const updated = ecommerceService.updateProduct(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/products/:id', (req, res) => {
  try { ecommerceService.deleteProduct(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/products/recommendations/:contactId', (req, res) => {
  try {
    const contact = storageService.getContact(req.params.contactId);
    if (!contact) return res.status(404).json({ success: false, error: 'Contact not found' });
    res.json({ success: true, data: ecommerceService.getRecommendations(contact) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/coupons', (req, res) => {
  try { res.json({ success: true, data: ecommerceService.getCoupons() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/coupons', (req, res) => {
  try { res.json({ success: true, data: ecommerceService.createCoupon(req.body) }); }
  catch (err) { res.status(400).json({ success: false, error: err.message }); }
});

app.delete('/api/coupons/:id', (req, res) => {
  try { ecommerceService.deleteCoupon(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/coupons/redeem', (req, res) => {
  try { res.json({ success: true, data: ecommerceService.redeemCoupon(req.body.code, req.body.contactId) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/stock-alerts', (req, res) => {
  try { res.json({ success: true, data: ecommerceService.getStockAlerts() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/stock-alerts', (req, res) => {
  try { res.json({ success: true, data: ecommerceService.createStockAlert(req.body) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── AI SEGMENTATION ────────────────────────────────────────
app.get('/api/segments', (req, res) => {
  try { res.json({ success: true, data: aiSegmentation.getSegments() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/segments', (req, res) => {
  try { res.json({ success: true, data: aiSegmentation.createSegment(req.body) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.put('/api/segments/:id', (req, res) => {
  try {
    const updated = aiSegmentation.updateSegment(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Segment not found' });
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/segments/:id', (req, res) => {
  try { aiSegmentation.deleteSegment(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/segments/ai-suggest', (req, res) => {
  try {
    const contacts = storageService.getAllContacts();
    const suggestions = aiSegmentation.suggestSegments(contacts);
    res.json({ success: true, data: suggestions });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── AI DATA ANALYST ────────────────────────────────────────
app.post('/api/ai/analyst', (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ success: false, error: 'Query required' });
    const contacts = storageService.getAllContacts();
    const campaigns = storageService.getCampaigns();
    const history = storageService.getHistory();
    const result = aiAnalyst.analyzeQuery(query, contacts, campaigns, history);
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/ai/analyst/suggestions', (req, res) => {
  try { res.json({ success: true, data: aiAnalyst.getQuerySuggestions() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── LOYALTY ENGINE ─────────────────────────────────────────
app.get('/api/loyalty', (req, res) => {
  try { res.json({ success: true, data: loyaltyEngine.getLoyaltyAccounts() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/loyalty/stats', (req, res) => {
  try { res.json({ success: true, data: loyaltyEngine.getLoyaltyStats() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/loyalty/:contactId', (req, res) => {
  try {
    const account = loyaltyEngine.getLoyaltyAccount(req.params.contactId);
    if (!account) return res.status(404).json({ success: false, error: 'No loyalty account' });
    res.json({ success: true, data: account });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/loyalty/enroll', (req, res) => {
  try { res.json({ success: true, data: loyaltyEngine.createLoyaltyAccount(req.body.contactId) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/loyalty/earn', (req, res) => {
  try {
    const { contactId, points, reason } = req.body;
    const result = loyaltyEngine.earnPoints(contactId, points, reason);
    if (!result) return res.status(404).json({ success: false, error: 'Account not found' });
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/loyalty/redeem', (req, res) => {
  try {
    const { contactId, points, rewardId } = req.body;
    const result = loyaltyEngine.redeemPoints(contactId, points, rewardId);
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/rewards', (req, res) => {
  try { res.json({ success: true, data: loyaltyEngine.getRewards() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/rewards', (req, res) => {
  try { res.json({ success: true, data: loyaltyEngine.createReward(req.body) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/rewards/:id', (req, res) => {
  try { loyaltyEngine.deleteReward(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── MOBILE WALLET ──────────────────────────────────────────
app.get('/api/wallet/passes', (req, res) => {
  try { res.json({ success: true, data: mobileWallet.getPasses() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/wallet/stats', (req, res) => {
  try { res.json({ success: true, data: mobileWallet.getWalletStats() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/wallet/passes', (req, res) => {
  try { res.json({ success: true, data: mobileWallet.createPass(req.body) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.put('/api/wallet/passes/:id', (req, res) => {
  try {
    const updated = mobileWallet.updatePass(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Pass not found' });
    res.json({ success: true, data: updated });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/wallet/passes/:id/redeem', (req, res) => {
  try {
    const pass = mobileWallet.redeemPass(req.params.id);
    if (!pass) return res.status(404).json({ success: false, error: 'Pass not found' });
    res.json({ success: true, data: pass });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/wallet/passes/:id', (req, res) => {
  try { mobileWallet.deletePass(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── ENTERPRISE: CUSTOM OBJECTS ─────────────────────────────
app.get('/api/custom-objects', (req, res) => {
  try { res.json({ success: true, data: enterprise.getCustomObjects() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/custom-objects', (req, res) => {
  try { res.json({ success: true, data: enterprise.createCustomObject(req.body) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/custom-objects/:id/records', (req, res) => {
  try {
    const record = enterprise.addCustomRecord(req.params.id, req.body);
    if (!record) return res.status(404).json({ success: false, error: 'Object not found' });
    res.json({ success: true, data: record });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/custom-objects/:id', (req, res) => {
  try { enterprise.deleteCustomObject(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── ENTERPRISE: INTEGRATIONS ───────────────────────────────
app.get('/api/integrations', (req, res) => {
  try { res.json({ success: true, data: enterprise.getIntegrations() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/integrations', (req, res) => {
  try { res.json({ success: true, data: enterprise.createIntegration(req.body) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/integrations/:id/sync', (req, res) => {
  try {
    const result = enterprise.syncIntegration(req.params.id);
    if (!result) return res.status(404).json({ success: false, error: 'Integration not found' });
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/integrations/:id', (req, res) => {
  try { enterprise.deleteIntegration(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── ENTERPRISE: SSO & SAML ────────────────────────────────
app.get('/api/sso', (req, res) => {
  try { res.json({ success: true, data: enterprise.getSSOConfig() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/sso', (req, res) => {
  try { res.json({ success: true, data: enterprise.updateSSOConfig(req.body) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── ENTERPRISE: DEDICATED IP ──────────────────────────────
app.get('/api/dedicated-ip', (req, res) => {
  try { res.json({ success: true, data: enterprise.getDedicatedIPConfig() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/dedicated-ip', (req, res) => {
  try { res.json({ success: true, data: enterprise.updateDedicatedIP(req.body) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ─── SERVE FRONTEND ─────────────────────────────────────────
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

// ─── START SERVER ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════════╗`);
  console.log(`  ║   🧠 MailForge — Revenue Intelligence        ║`);
  console.log(`  ║   🌐 http://localhost:${PORT}                   ║`);
  console.log(`  ╚══════════════════════════════════════════════╝\n`);
});
module.exports = app;
