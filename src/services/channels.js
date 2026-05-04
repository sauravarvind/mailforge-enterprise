/**
 * ═══════════════════════════════════════════════════════════
 *  Channels Service — WhatsApp, Web Push, Mobile Push, Popups
 *  Omnichannel messaging hub for marketing outreach
 * ═══════════════════════════════════════════════════════════
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');
const PUSH_SUBS_FILE = path.join(DATA_DIR, 'push_subscriptions.json');
const POPUPS_FILE = path.join(DATA_DIR, 'popups.json');

function readJSON(fp) { try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return []; } }
function writeJSON(fp, d) { fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8'); }

function initChannels() {
  [CHANNELS_FILE, PUSH_SUBS_FILE, POPUPS_FILE].forEach(f => {
    if (!fs.existsSync(f)) fs.writeFileSync(f, '[]', 'utf8');
  });
}

// ─── WHATSAPP MESSAGES ──────────────────────────────────────

function getWhatsAppMessages() { return readJSON(CHANNELS_FILE).filter(m => m.channel === 'whatsapp'); }

function sendWhatsApp({ to, templateName, body, contactId, campaignId }) {
  const messages = readJSON(CHANNELS_FILE);
  const msg = {
    id: 'wa_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    channel: 'whatsapp', to, templateName, body,
    contactId, campaignId,
    status: 'queued',
    deliveredAt: null, readAt: null,
    createdAt: new Date().toISOString()
  };
  messages.push(msg);
  writeJSON(CHANNELS_FILE, messages);
  // Simulate delivery after 2s
  setTimeout(() => {
    const msgs = readJSON(CHANNELS_FILE);
    const idx = msgs.findIndex(m => m.id === msg.id);
    if (idx !== -1) { msgs[idx].status = 'delivered'; msgs[idx].deliveredAt = new Date().toISOString(); writeJSON(CHANNELS_FILE, msgs); }
  }, 2000);
  return msg;
}

// ─── WEB PUSH NOTIFICATIONS ────────────────────────────────

function getPushSubscriptions() { return readJSON(PUSH_SUBS_FILE); }

function addPushSubscription(sub) {
  const subs = getPushSubscriptions();
  const subscription = {
    id: 'push_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    endpoint: sub.endpoint, keys: sub.keys,
    contactId: sub.contactId || null,
    createdAt: new Date().toISOString()
  };
  subs.push(subscription);
  writeJSON(PUSH_SUBS_FILE, subs);
  return subscription;
}

function sendPushNotification({ title, body, icon, url, contactIds, campaignId }) {
  const messages = readJSON(CHANNELS_FILE);
  const targets = resolveAudience(contactIds);
  const notifications = targets.map(cid => ({
    id: 'pn_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    channel: 'web_push', contactId: cid, campaignId,
    title, body, icon, url,
    status: 'sent',
    createdAt: new Date().toISOString()
  }));
  messages.push(...notifications);
  writeJSON(CHANNELS_FILE, messages);
  return { sent: notifications.length, simulated: targets.includes('broadcast_simulated') };
}

function sendMobilePush({ title, body, data, contactIds, campaignId }) {
  const messages = readJSON(CHANNELS_FILE);
  const targets = resolveAudience(contactIds);
  const notifications = targets.map(cid => ({
    id: 'mp_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    channel: 'mobile_push', contactId: cid, campaignId,
    title, body, data,
    status: 'sent',
    createdAt: new Date().toISOString()
  }));
  messages.push(...notifications);
  writeJSON(CHANNELS_FILE, messages);
  return { sent: notifications.length, simulated: targets.includes('broadcast_simulated') };
}

function resolveAudience(contactIds) {
  if (Array.isArray(contactIds) && contactIds.length) return contactIds;
  const subscriptions = getPushSubscriptions();
  if (subscriptions.length) return subscriptions.map(sub => sub.contactId || sub.id);
  try {
    const storage = require('./storage');
    const contacts = storage.getAllContacts();
    if (contacts.length) return contacts.map(contact => contact.id);
  } catch { /* fall through to simulated broadcast */ }
  return ['broadcast_simulated'];
}

// ─── POPUPS ─────────────────────────────────────────────────

function getPopups() { return readJSON(POPUPS_FILE); }
function getPopup(id) { return getPopups().find(p => p.id === id); }

function createPopup({ name, type, trigger, content, style, targeting, campaignId }) {
  const popups = getPopups();
  const popup = {
    id: 'popup_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    name, type: type || 'modal',
    trigger: trigger || { type: 'time_delay', value: 5 },
    content: content || { headline: '', body: '', cta: 'Subscribe', image: '' },
    style: style || { bgColor: '#ffffff', textColor: '#0F172A', ctaColor: '#4F46E5', position: 'center', animation: 'fadeIn' },
    targeting: targeting || { pages: ['all'], segments: [], excludeSegments: [] },
    campaignId, isActive: false,
    stats: { views: 0, conversions: 0, dismissals: 0 },
    createdAt: new Date().toISOString()
  };
  popups.push(popup);
  writeJSON(POPUPS_FILE, popups);
  return popup;
}

function updatePopup(id, updates) {
  const popups = getPopups();
  const idx = popups.findIndex(p => p.id === id);
  if (idx === -1) return null;
  popups[idx] = { ...popups[idx], ...updates };
  writeJSON(POPUPS_FILE, popups);
  return popups[idx];
}

function deletePopup(id) {
  let popups = getPopups();
  popups = popups.filter(p => p.id !== id);
  writeJSON(POPUPS_FILE, popups);
}

// ─── CHANNEL ANALYTICS ─────────────────────────────────────

function getChannelStats() {
  const messages = readJSON(CHANNELS_FILE);
  return {
    whatsapp: { sent: messages.filter(m => m.channel === 'whatsapp').length, delivered: messages.filter(m => m.channel === 'whatsapp' && m.status === 'delivered').length },
    webPush: { sent: messages.filter(m => m.channel === 'web_push').length },
    mobilePush: { sent: messages.filter(m => m.channel === 'mobile_push').length },
    popups: { total: getPopups().length, active: getPopups().filter(p => p.isActive).length }
  };
}

module.exports = {
  initChannels, getWhatsAppMessages, sendWhatsApp,
  getPushSubscriptions, addPushSubscription, sendPushNotification, sendMobilePush,
  getPopups, getPopup, createPopup, updatePopup, deletePopup,
  getChannelStats
};
