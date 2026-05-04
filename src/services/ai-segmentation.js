/**
 * ═══════════════════════════════════════════════════════════
 *  Aura AI Segmentation
 *  Suggest audience groups based on behaviour and attributes
 * ═══════════════════════════════════════════════════════════
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SEGMENTS_FILE = path.join(DATA_DIR, 'segments.json');

function readJSON(fp) { try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return []; } }
function writeJSON(fp, d) { fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8'); }

function initSegments() {
  if (!fs.existsSync(SEGMENTS_FILE)) writeJSON(SEGMENTS_FILE, []);
}

function getSegments() { return readJSON(SEGMENTS_FILE); }
function getSegment(id) { return getSegments().find(s => s.id === id); }

function createSegment({ name, description, rules, isAiGenerated, contactIds }) {
  const segments = getSegments();
  const segment = {
    id: 'seg_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    name, description: description || '', rules: rules || [],
    isAiGenerated: isAiGenerated || false,
    contactIds: contactIds || [], memberCount: (contactIds || []).length,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  segments.push(segment);
  writeJSON(SEGMENTS_FILE, segments);
  return segment;
}

function updateSegment(id, updates) {
  const segments = getSegments();
  const idx = segments.findIndex(s => s.id === id);
  if (idx === -1) return null;
  segments[idx] = { ...segments[idx], ...updates, updatedAt: new Date().toISOString() };
  if (updates.contactIds) segments[idx].memberCount = updates.contactIds.length;
  writeJSON(SEGMENTS_FILE, segments);
  return segments[idx];
}

function deleteSegment(id) {
  let segments = getSegments();
  segments = segments.filter(s => s.id !== id);
  writeJSON(SEGMENTS_FILE, segments);
}

// ─── AI SEGMENTATION ENGINE ────────────────────────────────

function suggestSegments(contacts) {
  const suggestions = [];

  // 1. Engagement-based segments
  const highEngagement = contacts.filter(c => (c.trackingData?.openCount || 0) >= 3 || (c.trackingData?.clickCount || 0) >= 1);
  const coldContacts = contacts.filter(c => !c.trackingData?.opened && !c.lastInteraction);
  const warmLeads = contacts.filter(c => c.trackingData?.opened && !c.trackingData?.clicked);

  if (highEngagement.length > 0) {
    suggestions.push({
      name: 'Highly Engaged',
      description: 'Contacts who opened 3+ emails or clicked at least once. Prime candidates for conversion.',
      reason: 'Based on open/click engagement patterns',
      contactIds: highEngagement.map(c => c.id),
      memberCount: highEngagement.length,
      suggestedAction: 'Send a conversion-focused offer or schedule a call'
    });
  }

  if (coldContacts.length > 0) {
    suggestions.push({
      name: 'Cold Contacts',
      description: 'Contacts with zero opens and no interactions. Need re-engagement campaign.',
      reason: 'No engagement detected since creation',
      contactIds: coldContacts.map(c => c.id),
      memberCount: coldContacts.length,
      suggestedAction: 'Run a re-engagement sequence with a compelling offer'
    });
  }

  if (warmLeads.length > 0) {
    suggestions.push({
      name: 'Warm Leads',
      description: 'Opened but haven\'t clicked. Interest is there but need more compelling CTAs.',
      reason: 'Opens without clicks suggest curiosity without conviction',
      contactIds: warmLeads.map(c => c.id),
      memberCount: warmLeads.length,
      suggestedAction: 'A/B test different CTAs and value propositions'
    });
  }

  // 2. Role-based segments
  const cSuite = contacts.filter(c => {
    const role = (c.role || '').toLowerCase();
    return ['ceo','cto','cmo','cfo','coo','founder','owner','president'].some(r => role.includes(r));
  });
  if (cSuite.length > 0) {
    suggestions.push({
      name: 'C-Suite Decision Makers',
      description: 'Senior executives with purchasing authority.',
      reason: 'Role-based targeting for high-value prospects',
      contactIds: cSuite.map(c => c.id),
      memberCount: cSuite.length,
      suggestedAction: 'Personalized outreach with ROI-focused messaging'
    });
  }

  // 3. Industry-based segments
  const industries = {};
  contacts.forEach(c => { if (c.industry) { if (!industries[c.industry]) industries[c.industry] = []; industries[c.industry].push(c.id); } });
  Object.entries(industries).forEach(([industry, ids]) => {
    if (ids.length >= 3) {
      suggestions.push({
        name: `${industry} Professionals`,
        description: `Contacts from the ${industry} industry. Create industry-specific campaigns.`,
        reason: `${ids.length} contacts share this industry attribute`,
        contactIds: ids, memberCount: ids.length,
        suggestedAction: `Create ${industry}-specific case studies and content`
      });
    }
  });

  // 4. Score-based segments
  const hotLeads = contacts.filter(c => (c.leadScore || 0) >= 70);
  if (hotLeads.length > 0) {
    suggestions.push({
      name: 'Hot Leads (Score 70+)',
      description: 'High-scoring contacts ready for sales outreach.',
      reason: 'Lead score indicates high purchase intent',
      contactIds: hotLeads.map(c => c.id),
      memberCount: hotLeads.length,
      suggestedAction: 'Assign to sales team for direct outreach'
    });
  }

  // 5. Lifecycle-based
  const customers = contacts.filter(c => c.lifecycleStage === 'customer' || c.lifecycleStage === 'retained');
  if (customers.length > 0) {
    suggestions.push({
      name: 'Existing Customers',
      description: 'Active customers for upsell and retention campaigns.',
      reason: 'Lifecycle stage indicates existing relationship',
      contactIds: customers.map(c => c.id),
      memberCount: customers.length,
      suggestedAction: 'Send loyalty rewards, upsell offers, or referral requests'
    });
  }

  // 6. Domain-based
  const domainGroups = {};
  contacts.forEach(c => {
    const d = c.email?.split('@')[1];
    if (d && !['gmail.com','yahoo.com','hotmail.com','outlook.com'].includes(d)) {
      if (!domainGroups[d]) domainGroups[d] = [];
      domainGroups[d].push(c.id);
    }
  });
  Object.entries(domainGroups).forEach(([domain, ids]) => {
    if (ids.length >= 3) {
      suggestions.push({
        name: `${domain} Team`,
        description: `Multiple contacts from ${domain}. Account-based marketing opportunity.`,
        reason: `${ids.length} contacts share the same company domain`,
        contactIds: ids, memberCount: ids.length,
        suggestedAction: 'Run an ABM campaign targeting this company'
      });
    }
  });

  return suggestions;
}

module.exports = {
  initSegments, getSegments, getSegment,
  createSegment, updateSegment, deleteSegment, suggestSegments
};
