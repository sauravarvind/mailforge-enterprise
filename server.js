require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { initStorage } = require('./src/services/storage');
const scraperService = require('./src/services/scraper');
const verifierService = require('./src/services/verifier');
const mailerService = require('./src/services/mailer');
const sheetsService = require('./src/services/sheets');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    const fs = require('fs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Initialize data storage
initStorage();

// ─── CAMPAIGN ROUTES ────────────────────────────────────────
const storageService = require('./src/services/storage');

app.get('/api/campaigns', (req, res) => {
  try {
    const campaigns = storageService.getCampaigns();
    res.json({ success: true, data: campaigns });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/campaigns', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Campaign name is required' });
    const campaign = storageService.createCampaign(name);
    res.json({ success: true, data: campaign });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/campaigns/:id', (req, res) => {
  try {
    storageService.deleteCampaign(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── SCRAPER ROUTES ─────────────────────────────────────────

app.post('/api/scrape', async (req, res) => {
  try {
    const { campaignId, urls } = req.body;
    if (!urls || !urls.length) return res.status(400).json({ success: false, error: 'URLs are required' });

    // Start scraping in background
    res.json({ success: true, message: 'Scraping started', campaignId });

    const results = [];
    for (const url of urls) {
      try {
        const emails = await scraperService.scrapeWebsite(url);
        for (const email of emails) {
          const contact = storageService.addContact({
            email: email.email,
            name: email.name || '',
            role: email.role || '',
            company: email.company || new URL(url).hostname.replace('www.', ''),
            source: url,
            campaignId,
            status: 'scraped'
          });
          results.push(contact);
        }
      } catch (err) {
        console.error(`Error scraping ${url}:`, err.message);
      }
    }

    // Update campaign status
    storageService.updateCampaign(campaignId, { 
      status: 'scraped', 
      scrapedCount: results.length,
      lastActivity: new Date().toISOString()
    });
  } catch (err) {
    console.error('Scrape error:', err);
  }
});

app.get('/api/scrape/status/:campaignId', (req, res) => {
  try {
    const contacts = storageService.getContactsByCampaign(req.params.campaignId);
    const campaign = storageService.getCampaign(req.params.campaignId);
    res.json({ success: true, data: { campaign, contacts: contacts.filter(c => c.status === 'scraped') } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DISCOVERY ROUTES ───────────────────────────────────────

app.post('/api/discover', async (req, res) => {
  try {
    const { campaignId, domains, roles } = req.body;
    const targetRoles = roles || ['founder', 'co-founder', 'ceo', 'cmo', 'marketing head', 'marketing specialist', 'marketing manager'];

    res.json({ success: true, message: 'Discovery started' });

    for (const domain of domains) {
      try {
        // Try Hunter.io if API key is available
        if (process.env.HUNTER_API_KEY) {
          const discovered = await scraperService.discoverWithHunter(domain, targetRoles);
          for (const contact of discovered) {
            storageService.addContact({
              ...contact,
              campaignId,
              source: `hunter:${domain}`,
              status: 'discovered'
            });
          }
        }

        // Pattern-based email guessing
        const patternEmails = await scraperService.guessEmails(domain, targetRoles);
        for (const contact of patternEmails) {
          storageService.addContact({
            ...contact,
            campaignId,
            source: `pattern:${domain}`,
            status: 'discovered'
          });
        }
      } catch (err) {
        console.error(`Discovery error for ${domain}:`, err.message);
      }
    }

    storageService.updateCampaign(campaignId, { 
      status: 'discovered',
      lastActivity: new Date().toISOString()
    });
  } catch (err) {
    console.error('Discovery error:', err);
  }
});

// ─── VERIFICATION ROUTES ────────────────────────────────────

app.post('/api/verify', async (req, res) => {
  try {
    const { campaignId, contactIds } = req.body;
    let contacts;

    if (contactIds && contactIds.length) {
      contacts = contactIds.map(id => storageService.getContact(id)).filter(Boolean);
    } else if (campaignId) {
      contacts = storageService.getContactsByCampaign(campaignId).filter(c => c.status !== 'verified' && c.status !== 'invalid');
    } else {
      return res.status(400).json({ success: false, error: 'Provide campaignId or contactIds' });
    }

    res.json({ success: true, message: `Verifying ${contacts.length} emails`, total: contacts.length });

    let verified = 0, invalid = 0;
    for (const contact of contacts) {
      try {
        const result = await verifierService.verifyEmail(contact.email);
        storageService.updateContact(contact.id, {
          status: result.valid ? 'verified' : 'invalid',
          verificationDetails: result
        });
        if (result.valid) verified++; else invalid++;
      } catch (err) {
        storageService.updateContact(contact.id, { status: 'unknown' });
      }
    }

    storageService.updateCampaign(campaignId, {
      status: 'verified',
      verifiedCount: verified,
      invalidCount: invalid,
      lastActivity: new Date().toISOString()
    });
  } catch (err) {
    console.error('Verification error:', err);
  }
});

app.get('/api/verify/status/:campaignId', (req, res) => {
  try {
    const contacts = storageService.getContactsByCampaign(req.params.campaignId);
    const stats = {
      total: contacts.length,
      verified: contacts.filter(c => c.status === 'verified').length,
      invalid: contacts.filter(c => c.status === 'invalid').length,
      pending: contacts.filter(c => c.status !== 'verified' && c.status !== 'invalid').length,
    };
    res.json({ success: true, data: { stats, contacts } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── CONTACTS ROUTES ────────────────────────────────────────

app.get('/api/contacts', (req, res) => {
  try {
    const { campaignId, status } = req.query;
    let contacts = campaignId 
      ? storageService.getContactsByCampaign(campaignId) 
      : storageService.getAllContacts();
    if (status) contacts = contacts.filter(c => c.status === status);
    res.json({ success: true, data: contacts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/contacts/:id', (req, res) => {
  try {
    storageService.deleteContact(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/contacts/invalid/:campaignId', (req, res) => {
  try {
    const removed = storageService.removeInvalidContacts(req.params.campaignId);
    res.json({ success: true, removed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── EMAIL SENDING ROUTES ───────────────────────────────────

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

    res.json({ success: true, message: `Sending to ${contacts.length} contacts`, total: contacts.length });

    let sent = 0, failed = 0;
    for (const contact of contacts) {
      try {
        await mailerService.sendEmail({
          to: contact.email,
          subject,
          html: body,
          imagePath,
          recipientName: contact.name,
          companyName: contact.company
        });
        storageService.updateContact(contact.id, { status: 'sent', sentAt: new Date().toISOString() });
        sent++;

        // Rate limit: wait 3-5 seconds between emails
        await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
      } catch (err) {
        storageService.updateContact(contact.id, { status: 'send_failed', error: err.message });
        failed++;
      }
    }

    storageService.updateCampaign(campaignId, {
      status: 'sent',
      sentCount: sent,
      failedCount: failed,
      lastActivity: new Date().toISOString()
    });
  } catch (err) {
    console.error('Send error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/send/status/:campaignId', (req, res) => {
  try {
    const contacts = storageService.getContactsByCampaign(req.params.campaignId);
    const stats = {
      total: contacts.length,
      sent: contacts.filter(c => c.status === 'sent').length,
      failed: contacts.filter(c => c.status === 'send_failed').length,
      pending: contacts.filter(c => c.status === 'verified').length,
    };
    res.json({ success: true, data: { stats, contacts } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GOOGLE AUTH ROUTES ─────────────────────────────────────

app.get('/api/auth/google', (req, res) => {
  try {
    const url = sheetsService.getAuthUrl();
    res.json({ success: true, url });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    await sheetsService.handleCallback(code);
    res.redirect('/?auth=success');
  } catch (err) {
    res.redirect('/?auth=error&message=' + encodeURIComponent(err.message));
  }
});

app.get('/api/auth/status', (req, res) => {
  const fs = require('fs');
  const tokenPath = path.join(__dirname, 'token.json');
  const isAuth = fs.existsSync(tokenPath);
  res.json({ success: true, authenticated: isAuth });
});

// ─── GOOGLE SHEETS ROUTES ───────────────────────────────────

app.post('/api/sheets/export', async (req, res) => {
  try {
    const { campaignId, sheetId } = req.body;
    const contacts = storageService.getContactsByCampaign(campaignId).filter(c => c.status === 'verified');
    const result = await sheetsService.exportContacts(sheetId || process.env.GOOGLE_SHEET_ID, contacts);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sheets/import', async (req, res) => {
  try {
    const { campaignId, sheetId, range } = req.body;
    const contacts = await sheetsService.importContacts(sheetId || process.env.GOOGLE_SHEET_ID, range);
    for (const contact of contacts) {
      storageService.addContact({ ...contact, campaignId, status: 'imported' });
    }
    res.json({ success: true, data: contacts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── SETTINGS ROUTES ────────────────────────────────────────

app.get('/api/settings', (req, res) => {
  try {
    const settings = storageService.getSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    storageService.saveSettings(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── IMAGE UPLOAD ───────────────────────────────────────────

app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    res.json({ 
      success: true, 
      data: { 
        filename: req.file.filename, 
        path: `/uploads/${req.file.filename}`,
        size: req.file.size 
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── SERVE FRONTEND ─────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── START SERVER ───────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════════╗`);
  console.log(`  ║   📧 Automatic Email Sender & Scraper        ║`);
  console.log(`  ║   🌐 http://localhost:${PORT}                   ║`);
  console.log(`  ╚══════════════════════════════════════════════╝\n`);
});

module.exports = app;
