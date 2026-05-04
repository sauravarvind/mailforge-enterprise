const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const EMAILS_FILE = path.join(DATA_DIR, 'emails.json');
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const AB_TESTS_FILE = path.join(DATA_DIR, 'ab_tests.json');
const TRACKING_FILE = path.join(DATA_DIR, 'tracking_events.json');
const CRM_NOTES_FILE = path.join(DATA_DIR, 'crm_notes.json');
const CRM_TAGS_FILE = path.join(DATA_DIR, 'crm_tags.json');
const CRM_DEALS_FILE = path.join(DATA_DIR, 'crm_deals.json');
const DIGITAL_TWINS_FILE = path.join(DATA_DIR, 'digital_twins.json');
const SCHEDULED_QUEUE_FILE = path.join(DATA_DIR, 'scheduled_queue.json');
const AUTOMATIONS_FILE = path.join(DATA_DIR, 'automations.json');
const COLLECTION_FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  accounts: path.join(DATA_DIR, 'accounts.json'),
  scoring_profiles: path.join(DATA_DIR, 'scoring_profiles.json'),
  segments: path.join(DATA_DIR, 'segments.json'),
  custom_objects: path.join(DATA_DIR, 'custom_objects.json'),
  loyalty: path.join(DATA_DIR, 'loyalty.json'),
  integrations: path.join(DATA_DIR, 'integrations.json'),
  wallet: path.join(DATA_DIR, 'wallet.json'),
  channels: path.join(DATA_DIR, 'channels.json'),
  products: path.join(DATA_DIR, 'products.json'),
  coupons: path.join(DATA_DIR, 'coupons.json')
};

function initStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const defaults = [
    [EMAILS_FILE, '[]'], [CAMPAIGNS_FILE, '[]'], [SETTINGS_FILE, '{}'],
    [TEMPLATES_FILE, '[]'], [HISTORY_FILE, '[]'], [AB_TESTS_FILE, '[]'],
    [TRACKING_FILE, '[]'], [CRM_NOTES_FILE, '[]'], [CRM_TAGS_FILE, '[]'],
    [CRM_DEALS_FILE, '[]'], [DIGITAL_TWINS_FILE, '[]'], [SCHEDULED_QUEUE_FILE, '[]'], [AUTOMATIONS_FILE, '[]'],
    ...Object.values(COLLECTION_FILES).map(file => [file, '[]'])
  ];
  for (const [file, def] of defaults) {
    if (!fs.existsSync(file)) fs.writeFileSync(file, def, 'utf8');
  }
  seedDefaultTemplates();
}

function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return filePath === SETTINGS_FILE ? {} : []; }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getCollectionFile(collection) {
  const file = COLLECTION_FILES[collection];
  if (!file) throw new Error(`Unknown collection: ${collection}`);
  return file;
}

function getCollection(collection) {
  return readJSON(getCollectionFile(collection));
}

function saveCollection(collection, items) {
  writeJSON(getCollectionFile(collection), Array.isArray(items) ? items : []);
  return items;
}

function createEntity(collection, entity, prefix) {
  const items = getCollection(collection);
  const item = {
    id: `${prefix || collection}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...entity,
    createdAt: entity.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  items.push(item);
  saveCollection(collection, items);
  return item;
}

function updateEntity(collection, id, updates) {
  const items = getCollection(collection);
  const idx = items.findIndex(item => item.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
  saveCollection(collection, items);
  return items[idx];
}

function deleteEntity(collection, id) {
  const items = getCollection(collection);
  const filtered = items.filter(item => item.id !== id);
  saveCollection(collection, filtered);
  return items.length - filtered.length;
}

function getScopedCollection(collection, { accountId, userId } = {}) {
  return getCollection(collection).filter(item => {
    if (accountId && item.accountId && item.accountId !== accountId) return false;
    if (userId && item.userId && item.userId !== userId) return false;
    return true;
  });
}

// ─── CAMPAIGNS ──────────────────────────────────────────────

function getCampaigns() { return readJSON(CAMPAIGNS_FILE); }
function getCampaign(id) { return getCampaigns().find(c => c.id === id); }

function createCampaign(data) {
  const campaigns = getCampaigns();
  const campaign = {
    id: 'camp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    name: typeof data === 'string' ? data : data.name,
    industry: (typeof data === 'object' ? data.industry : '') || '',
    productService: (typeof data === 'object' ? data.productService : '') || '',
    status: 'created',
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    scrapedCount: 0, verifiedCount: 0, invalidCount: 0, sentCount: 0, failedCount: 0
  };
  campaigns.push(campaign);
  writeJSON(CAMPAIGNS_FILE, campaigns);
  scheduleSync();
  return campaign;
}

function updateCampaign(id, updates) {
  const campaigns = getCampaigns();
  const idx = campaigns.findIndex(c => c.id === id);
  if (idx === -1) return null;
  campaigns[idx] = { ...campaigns[idx], ...updates };
  writeJSON(CAMPAIGNS_FILE, campaigns);
  scheduleSync();
  return campaigns[idx];
}

function deleteCampaign(id) {
  let campaigns = getCampaigns();
  campaigns = campaigns.filter(c => c.id !== id);
  writeJSON(CAMPAIGNS_FILE, campaigns);
  let contacts = getAllContacts();
  contacts = contacts.filter(c => c.campaignId !== id);
  writeJSON(EMAILS_FILE, contacts);
  scheduleSync();
}

// ─── CONTACTS ───────────────────────────────────────────────

function getAllContacts() { return readJSON(EMAILS_FILE); }
function getContact(id) { return getAllContacts().find(c => c.id === id); }
function getContactsByCampaign(campaignId) { return getAllContacts().filter(c => c.campaignId === campaignId); }

function addContact(contact) {
  const contacts = getAllContacts();
  const exists = contacts.find(c => c.email === contact.email && c.campaignId === contact.campaignId);
  if (exists) return exists;
  const newContact = {
    id: 'ct_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    ...contact,
    industry: contact.industry || '',
    productService: contact.productService || '',
    classification: null,
    lifecycleStage: 'lead',
    leadScore: 0,
    tags: [],
    dealValue: 0,
    interactionCount: 0,
    lastInteraction: null,
    trackingData: { opened: false, clicked: false, replied: false, openCount: 0, clickCount: 0 },
    createdAt: new Date().toISOString()
  };
  contacts.push(newContact);
  writeJSON(EMAILS_FILE, contacts);
  return newContact;
}

function updateContact(id, updates) {
  const contacts = getAllContacts();
  const idx = contacts.findIndex(c => c.id === id);
  if (idx === -1) return null;
  contacts[idx] = { ...contacts[idx], ...updates };
  writeJSON(EMAILS_FILE, contacts);
  return contacts[idx];
}

function deleteContact(id) {
  let contacts = getAllContacts();
  contacts = contacts.filter(c => c.id !== id);
  writeJSON(EMAILS_FILE, contacts);
}

function deleteAllContacts(campaignId) {
  let contacts = getAllContacts();
  const before = contacts.length;
  if (campaignId) { contacts = contacts.filter(c => c.campaignId !== campaignId); }
  else { contacts = []; }
  writeJSON(EMAILS_FILE, contacts);
  scheduleSync();
  return before - contacts.length;
}

function removeInvalidContacts(campaignId) {
  let contacts = getAllContacts();
  const before = contacts.length;
  contacts = contacts.filter(c => !(c.campaignId === campaignId && c.status === 'invalid'));
  writeJSON(EMAILS_FILE, contacts);
  scheduleSync();
  return before - contacts.length;
}

// ─── HISTORY ────────────────────────────────────────────────

function getHistory() { return readJSON(HISTORY_FILE); }

function addHistoryEntry(entry) {
  const history = getHistory();
  const newEntry = {
    id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    ...entry,
    timestamp: new Date().toISOString()
  };
  history.unshift(newEntry);
  if (history.length > 5000) history.length = 5000;
  writeJSON(HISTORY_FILE, history);
  return newEntry;
}

function isAlreadySent(email, campaignId) {
  const history = getHistory();
  return history.some(h => h.email === email && h.campaignId === campaignId && h.status === 'sent');
}

// ─── TEMPLATES ──────────────────────────────────────────────

function getTemplates() { return readJSON(TEMPLATES_FILE); }
function getTemplate(id) { return getTemplates().find(t => t.id === id); }

function saveTemplate(template) {
  const templates = getTemplates();
  const newTemplate = {
    id: 'tpl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    name: template.name,
    subject: template.subject,
    body: template.body,
    category: template.category || 'custom',
    tags: template.tags || [],
    description: template.description || '',
    useCount: 0,
    lastUsed: null,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  templates.push(newTemplate);
  writeJSON(TEMPLATES_FILE, templates);
  scheduleSync();
  return newTemplate;
}

function updateTemplate(id, updates) {
  const templates = getTemplates();
  const idx = templates.findIndex(t => t.id === id);
  if (idx === -1) return null;
  templates[idx] = { ...templates[idx], ...updates, updatedAt: new Date().toISOString() };
  writeJSON(TEMPLATES_FILE, templates);
  scheduleSync();
  return templates[idx];
}

function deleteTemplate(id) {
  let templates = getTemplates();
  templates = templates.filter(t => t.id !== id);
  writeJSON(TEMPLATES_FILE, templates);
  scheduleSync();
}

function incrementTemplateUse(id) {
  const templates = getTemplates();
  const idx = templates.findIndex(t => t.id === id);
  if (idx === -1) return;
  templates[idx].useCount = (templates[idx].useCount || 0) + 1;
  templates[idx].lastUsed = new Date().toISOString();
  writeJSON(TEMPLATES_FILE, templates);
}

function duplicateTemplate(id) {
  const original = getTemplate(id);
  if (!original) return null;
  return saveTemplate({
    name: original.name + ' (Copy)',
    subject: original.subject,
    body: original.body,
    category: original.category,
    tags: original.tags,
    description: original.description
  });
}

// ─── DEFAULT TEMPLATE SEEDING ───────────────────────────────

function seedDefaultTemplates() {
  const templates = getTemplates();
  if (templates.some(t => t.isDefault)) return; // already seeded

  const defaults = [
    {
      name: 'Cold Outreach — SaaS', category: 'outreach',
      tags: ['cold', 'saas', 'b2b'],
      description: 'Professional cold outreach for SaaS products',
      subject: 'Quick question about {{company}}\'s growth strategy',
      body: '<div style="line-height:1.7;color:#334155;"><p>Hi {{name}},</p><p>I came across {{company}} and was impressed by what you\'re building. We help companies like yours automate their outreach and increase conversion rates by 40%.</p><p>Would you be open to a quick 15-minute call this week to explore if we can help?</p><p>Best regards</p></div>'
    },
    {
      name: 'Cold Outreach — Agency', category: 'outreach',
      tags: ['cold', 'agency', 'services'],
      description: 'Outreach template for marketing/design agencies',
      subject: 'Collaboration idea for {{company}}',
      body: '<div style="line-height:1.7;color:#334155;"><p>Hi {{name}},</p><p>I\'ve been following {{company}}\'s work and love what you\'re doing. I specialize in helping agencies scale their client acquisition through automated outreach systems.</p><p>I\'d love to share some strategies that have worked for similar agencies. Can we connect?</p><p>Cheers</p></div>'
    },
    {
      name: 'Cold Outreach — Freelancer', category: 'outreach',
      tags: ['cold', 'freelance', 'personal'],
      description: 'Personal outreach from freelancer to potential client',
      subject: '{{name}}, I can help {{company}} with [service]',
      body: '<div style="line-height:1.7;color:#334155;"><p>Hey {{name}}! 👋</p><p>I noticed {{company}} is growing fast — congrats! I\'m a freelance [role] who specializes in helping companies like yours [value prop].</p><p>I recently helped a similar company achieve [specific result]. Would love to chat about doing the same for you.</p><p>— [Your Name]</p></div>'
    },
    {
      name: 'Follow-up #1 (Gentle)', category: 'followup',
      tags: ['followup', 'gentle', 'first'],
      description: 'First gentle follow-up after no response',
      subject: 'Re: Quick question about {{company}}',
      body: '<div style="line-height:1.7;color:#334155;"><p>Hi {{name}},</p><p>Just wanted to bump my previous email in case it got buried. I know you\'re busy!</p><p>Happy to adjust my approach if the timing isn\'t right — just let me know.</p><p>Best</p></div>'
    },
    {
      name: 'Follow-up #2 (Value Add)', category: 'followup',
      tags: ['followup', 'value', 'second'],
      description: 'Second follow-up with added value',
      subject: 'Thought you\'d find this useful, {{name}}',
      body: '<div style="line-height:1.7;color:#334155;"><p>Hi {{name}},</p><p>I wanted to share a quick insight that might be relevant to {{company}}:</p><p>[Share a relevant tip, stat, or case study]</p><p>This is the kind of thing we help companies with every day. Worth a quick chat?</p></div>'
    },
    {
      name: 'Follow-up #3 (Breakup)', category: 'followup',
      tags: ['followup', 'breakup', 'last'],
      description: 'Final breakup email — creates urgency',
      subject: 'Closing the loop — {{company}}',
      body: '<div style="line-height:1.7;color:#334155;"><p>Hi {{name}},</p><p>I\'ve reached out a couple of times and haven\'t heard back, so I\'ll assume the timing isn\'t right.</p><p>I\'ll close my file on this, but if things change in the future, my door is always open.</p><p>Wishing {{company}} continued success! 🚀</p></div>'
    },
    {
      name: 'Partnership Proposal', category: 'outreach',
      tags: ['partnership', 'proposal', 'b2b'],
      description: 'Formal partnership proposal',
      subject: 'Strategic partnership — {{company}} × [Your Company]',
      body: '<div style="line-height:1.7;color:#334155;"><p>Dear {{name}},</p><p>I\'m reaching out because I see a strong synergy between {{company}} and what we\'re building.</p><p>We serve a similar audience but with complementary offerings. A partnership could help both of us expand our reach significantly.</p><p>I\'ve put together a brief one-pager on how this could work. Would you be interested in reviewing it?</p><p>Best regards</p></div>'
    },
    {
      name: 'Case Study Share', category: 'nurture',
      tags: ['case-study', 'social-proof', 'nurture'],
      description: 'Share a relevant case study to build trust',
      subject: 'How [Client] achieved [Result] — relevant for {{company}}',
      body: '<div style="line-height:1.7;color:#334155;"><p>Hi {{name}},</p><p>I thought you might find this interesting — we recently helped [similar company] achieve [specific result].</p><p>The challenge was very similar to what {{company}} might be experiencing: [pain point].</p><p><a href="#" style="color:#4F46E5;">Read the full case study →</a></p><p>Would love to discuss how we can replicate these results for you.</p></div>'
    },
    {
      name: 'Event Invitation', category: 'nurture',
      tags: ['event', 'webinar', 'invitation'],
      description: 'Invite contacts to a webinar or event',
      subject: 'You\'re invited: [Event Name] — {{name}}',
      body: '<div style="line-height:1.7;color:#334155;"><p>Hi {{name}},</p><p>We\'re hosting an exclusive [webinar/event] on [topic] and thought it would be perfect for someone in your role at {{company}}.</p><p>📅 Date: [Date]<br>🕐 Time: [Time]<br>📍 Where: [Link]</p><p>We\'ll be covering [key topics]. Spots are limited.</p><p><a href="#" style="display:inline-block;padding:12px 32px;background:#4F46E5;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Reserve Your Spot →</a></p></div>'
    },
    {
      name: 'Re-engagement', category: 'retention',
      tags: ['re-engagement', 'winback', 'retention'],
      description: 'Re-engage inactive contacts or churned customers',
      subject: 'We miss you, {{name}}! Here\'s what\'s new',
      body: '<div style="line-height:1.7;color:#334155;"><p>Hi {{name}},</p><p>It\'s been a while since we connected, and a lot has changed! Here\'s what you\'ve been missing:</p><ul><li>✨ [New Feature 1]</li><li>🚀 [Improvement 2]</li><li>🎁 [Special Offer]</li></ul><p>We\'d love to have you back. Here\'s a special offer just for you:</p><p><a href="#" style="display:inline-block;padding:12px 32px;background:#10B981;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Claim Your Offer →</a></p></div>'
    },
    {
      name: 'Thank You / Post-Meeting', category: 'nurture',
      tags: ['thank-you', 'post-meeting', 'followup'],
      description: 'Follow up after a meeting or call',
      subject: 'Great chatting, {{name}}! Next steps',
      body: '<div style="line-height:1.7;color:#334155;"><p>Hi {{name}},</p><p>Thank you for taking the time to chat today! I really enjoyed learning about {{company}} and the exciting things you\'re working on.</p><p>As discussed, here are the next steps:</p><ol><li>[Action item 1]</li><li>[Action item 2]</li><li>[Action item 3]</li></ol><p>I\'ll follow up by [date]. In the meantime, feel free to reach out anytime.</p><p>Looking forward to working together! 🤝</p></div>'
    },
    {
      name: 'Social Proof / Testimonial', category: 'conversion',
      tags: ['testimonial', 'social-proof', 'conversion'],
      description: 'Use social proof to push toward conversion',
      subject: 'What [Company] said about working with us',
      body: '<div style="line-height:1.7;color:#334155;"><p>Hi {{name}},</p><p>Don\'t just take my word for it — here\'s what [Client Name], [Role] at [Company] had to say:</p><blockquote style="border-left:4px solid #4F46E5;margin:16px 0;padding:12px 20px;background:#F8FAFC;border-radius:0 8px 8px 0;font-style:italic;">"[Compelling testimonial quote about the results they achieved]"</blockquote><p>{{company}} is in a similar position, and I believe we can deliver the same results for you.</p><p>Ready to get started?</p></div>'
    }
  ];

  for (const d of defaults) {
    templates.push({
      id: 'tpl_default_' + Math.random().toString(36).substr(2, 8),
      ...d,
      useCount: 0,
      lastUsed: null,
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  writeJSON(TEMPLATES_FILE, templates);
}

// ─── A/B TESTS ──────────────────────────────────────────────

function getABTests() { return readJSON(AB_TESTS_FILE); }
function getABTest(id) { return getABTests().find(t => t.id === id); }

function saveABTest(test) {
  const tests = getABTests();
  const idx = tests.findIndex(t => t.id === test.id);
  if (idx !== -1) tests[idx] = test;
  else tests.push(test);
  writeJSON(AB_TESTS_FILE, tests);
  return test;
}

function deleteABTest(id) {
  let tests = getABTests();
  tests = tests.filter(t => t.id !== id);
  writeJSON(AB_TESTS_FILE, tests);
}

// ─── TRACKING EVENTS ────────────────────────────────────────

function getTrackingEvents() { return readJSON(TRACKING_FILE); }

function addTrackingEvent(event) {
  const events = getTrackingEvents();
  const newEvent = {
    id: 'trk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    ...event,
    timestamp: new Date().toISOString()
  };
  events.push(newEvent);
  if (events.length > 50000) events.splice(0, events.length - 50000);
  writeJSON(TRACKING_FILE, events);
  return newEvent;
}

// ─── CRM: NOTES ─────────────────────────────────────────────

function getCRMNotes(contactId) {
  return readJSON(CRM_NOTES_FILE).filter(n => n.contactId === contactId);
}

function addCRMNote(note) {
  const notes = readJSON(CRM_NOTES_FILE);
  const newNote = {
    id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    contactId: note.contactId,
    content: note.content,
    type: note.type || 'note', // note, call, meeting, task
    createdAt: new Date().toISOString()
  };
  notes.unshift(newNote);
  writeJSON(CRM_NOTES_FILE, notes);
  return newNote;
}

function deleteCRMNote(id) {
  let notes = readJSON(CRM_NOTES_FILE);
  notes = notes.filter(n => n.id !== id);
  writeJSON(CRM_NOTES_FILE, notes);
}

// ─── CRM: TAGS ──────────────────────────────────────────────

function getCRMTags() { return readJSON(CRM_TAGS_FILE); }

function createCRMTag(tag) {
  const tags = getCRMTags();
  const newTag = {
    id: 'tag_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    name: tag.name,
    color: tag.color || '#3B82F6',
    createdAt: new Date().toISOString()
  };
  tags.push(newTag);
  writeJSON(CRM_TAGS_FILE, tags);
  return newTag;
}

function deleteCRMTag(id) {
  let tags = getCRMTags();
  tags = tags.filter(t => t.id !== id);
  writeJSON(CRM_TAGS_FILE, tags);
}

// ─── CRM: DEALS ─────────────────────────────────────────────

function getCRMDeals() { return readJSON(CRM_DEALS_FILE); }

function createCRMDeal(deal) {
  const deals = getCRMDeals();
  const newDeal = {
    id: 'deal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    contactId: deal.contactId,
    title: deal.title,
    value: deal.value || 0,
    stage: deal.stage || 'lead',
    status: deal.status || 'open', // open, won, lost
    createdAt: new Date().toISOString(),
    closedAt: null
  };
  deals.push(newDeal);
  writeJSON(CRM_DEALS_FILE, deals);
  return newDeal;
}

function updateCRMDeal(id, updates) {
  const deals = getCRMDeals();
  const idx = deals.findIndex(d => d.id === id);
  if (idx === -1) return null;
  deals[idx] = { ...deals[idx], ...updates };
  writeJSON(CRM_DEALS_FILE, deals);
  return deals[idx];
}

// ─── DIGITAL TWINS ──────────────────────────────────────────

function getDigitalTwins() { return readJSON(DIGITAL_TWINS_FILE); }
function getDigitalTwin(contactId) { return getDigitalTwins().find(t => t.contactId === contactId); }

function saveDigitalTwin(twin) {
  const twins = getDigitalTwins();
  const idx = twins.findIndex(t => t.contactId === twin.contactId);
  if (idx !== -1) twins[idx] = twin;
  else twins.push(twin);
  writeJSON(DIGITAL_TWINS_FILE, twins);
  return twin;
}

// ─── SETTINGS ───────────────────────────────────────────────

function getSettings() { return readJSON(SETTINGS_FILE); }

function saveSettings(settings) {
  const current = getSettings();
  writeJSON(SETTINGS_FILE, { ...current, ...settings });
}

// ─── GOOGLE SHEETS AUTO-SYNC ────────────────────────────────

let syncTimer = null;

function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncToGoogleSheets().catch(err => {
      console.log('[Sync] Auto-sync skipped:', err.message);
    });
  }, 3000);
}

async function syncToGoogleSheets() {
  const { google } = require('googleapis');
  const TOKEN_PATH = path.join(__dirname, '..', '..', 'token.json');
  const SETTINGS_PATH = path.join(__dirname, '..', '..', 'data', 'settings.json');

  if (!fs.existsSync(TOKEN_PATH)) return;

  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); } catch (e) { return; }

  const sheetId = settings.syncSheetId;
  if (!sheetId) return;

  const clientId = settings.clientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = settings.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || clientId === 'your_client_id_here') return;

  try {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oauth2Client.setCredentials(token);

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    const contacts = getAllContacts();
    const contactHeaders = ['ID', 'Email', 'Name', 'Role', 'Company', 'Industry', 'Product/Service', 'Status', 'Classification', 'Lead Score', 'Lifecycle', 'Source', 'Campaign ID', 'Created At', 'Sent At'];
    const contactRows = contacts.map(c => [
      c.id, c.email, c.name || '', c.role || '', c.company || '',
      c.industry || '', c.productService || '',
      c.status || '', c.classification?.category || '', c.leadScore || 0,
      c.lifecycleStage || 'lead', c.source || '', c.campaignId || '', c.createdAt || '', c.sentAt || ''
    ]);
    await syncSheet(sheets, sheetId, 'Contacts', [contactHeaders, ...contactRows]);

    const campaigns = getCampaigns();
    const campHeaders = ['ID', 'Name', 'Industry', 'Product/Service', 'Status', 'Scraped', 'Verified', 'Invalid', 'Sent', 'Failed', 'Created At'];
    const campRows = campaigns.map(c => [
      c.id, c.name, c.industry || '', c.productService || '', c.status,
      c.scrapedCount || 0, c.verifiedCount || 0, c.invalidCount || 0,
      c.sentCount || 0, c.failedCount || 0, c.createdAt || ''
    ]);
    await syncSheet(sheets, sheetId, 'Campaigns', [campHeaders, ...campRows]);

    const templates = getTemplates();
    const tplHeaders = ['ID', 'Name', 'Category', 'Subject', 'Use Count', 'Created At'];
    const tplRows = templates.map(t => [t.id, t.name, t.category || '', t.subject || '', t.useCount || 0, t.createdAt || '']);
    await syncSheet(sheets, sheetId, 'Templates', [tplHeaders, ...tplRows]);

    const history = getHistory().slice(0, 500);
    const histHeaders = ['ID', 'Email', 'Subject', 'Campaign', 'Status', 'Timestamp'];
    const histRows = history.map(h => [h.id, h.email, h.subject || '', h.campaignName || '', h.status, h.timestamp]);
    await syncSheet(sheets, sheetId, 'History', [histHeaders, ...histRows]);

    console.log('[Sync] ✓ Data synced to Google Sheets');
  } catch (err) {
    console.error('[Sync] Error:', err.message);
  }
}
// ─── AUTOMATIONS ────────────────────────────────────────────

function getAutomations() { return readJSON(AUTOMATIONS_FILE); }
function getAutomation(id) { return getAutomations().find(a => a.id === id); }
function saveAutomation(automation) {
  const automations = getAutomations();
  const existingIndex = automations.findIndex(a => a.id === automation.id);
  if (existingIndex > -1) {
    automations[existingIndex] = { ...automations[existingIndex], ...automation, updatedAt: new Date().toISOString() };
  } else {
    automations.push({
      ...automation,
      id: 'auto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  writeJSON(AUTOMATIONS_FILE, automations);
  return true;
}
function deleteAutomation(id) {
  let automations = getAutomations();
  automations = automations.filter(a => a.id !== id);
  writeJSON(AUTOMATIONS_FILE, automations);
}

async function syncSheet(sheets, sheetId, tabName, values) {
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId, range: `${tabName}!A1`,
      valueInputOption: 'RAW', resource: { values }
    });
  } catch {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        resource: { requests: [{ addSheet: { properties: { title: tabName } } }] }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId, range: `${tabName}!A1`,
        valueInputOption: 'RAW', resource: { values }
      });
    } catch (e) { /* ignore */ }
  }
}

module.exports = {
  initStorage,
  getCampaigns, getCampaign, createCampaign, updateCampaign, deleteCampaign,
  getAllContacts, getContact, getContactsByCampaign, addContact, updateContact, deleteContact, deleteAllContacts, removeInvalidContacts,
  getHistory, addHistoryEntry, isAlreadySent,
  getTemplates, getTemplate, saveTemplate, updateTemplate, deleteTemplate, incrementTemplateUse, duplicateTemplate,
  getSettings, saveSettings,
  getABTests, getABTest, saveABTest, deleteABTest,
  getTrackingEvents, addTrackingEvent,
  getCRMNotes, addCRMNote, deleteCRMNote,
  getCRMTags, createCRMTag, deleteCRMTag,
  getCRMDeals, createCRMDeal, updateCRMDeal,
  getDigitalTwins, getDigitalTwin, saveDigitalTwin,
  getAutomations, getAutomation, saveAutomation, deleteAutomation,
  getCollection, saveCollection, createEntity, updateEntity, deleteEntity, getScopedCollection,
  syncToGoogleSheets
};
