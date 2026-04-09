const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const EMAILS_FILE = path.join(DATA_DIR, 'emails.json');
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function initStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(EMAILS_FILE)) fs.writeFileSync(EMAILS_FILE, '[]', 'utf8');
  if (!fs.existsSync(CAMPAIGNS_FILE)) fs.writeFileSync(CAMPAIGNS_FILE, '[]', 'utf8');
  if (!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, '{}', 'utf8');
}

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return filePath === SETTINGS_FILE ? {} : [];
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ─── CAMPAIGNS ──────────────────────────────────────────────

function getCampaigns() {
  return readJSON(CAMPAIGNS_FILE);
}

function getCampaign(id) {
  return getCampaigns().find(c => c.id === id);
}

function createCampaign(name) {
  const campaigns = getCampaigns();
  const campaign = {
    id: 'camp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    name,
    status: 'created',
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    scrapedCount: 0,
    verifiedCount: 0,
    invalidCount: 0,
    sentCount: 0,
    failedCount: 0
  };
  campaigns.push(campaign);
  writeJSON(CAMPAIGNS_FILE, campaigns);
  return campaign;
}

function updateCampaign(id, updates) {
  const campaigns = getCampaigns();
  const idx = campaigns.findIndex(c => c.id === id);
  if (idx === -1) return null;
  campaigns[idx] = { ...campaigns[idx], ...updates };
  writeJSON(CAMPAIGNS_FILE, campaigns);
  return campaigns[idx];
}

function deleteCampaign(id) {
  let campaigns = getCampaigns();
  campaigns = campaigns.filter(c => c.id !== id);
  writeJSON(CAMPAIGNS_FILE, campaigns);

  // Also remove associated contacts
  let contacts = getAllContacts();
  contacts = contacts.filter(c => c.campaignId !== id);
  writeJSON(EMAILS_FILE, contacts);
}

// ─── CONTACTS ───────────────────────────────────────────────

function getAllContacts() {
  return readJSON(EMAILS_FILE);
}

function getContact(id) {
  return getAllContacts().find(c => c.id === id);
}

function getContactsByCampaign(campaignId) {
  return getAllContacts().filter(c => c.campaignId === campaignId);
}

function addContact(contact) {
  const contacts = getAllContacts();
  
  // Deduplicate by email within the same campaign
  const exists = contacts.find(c => c.email === contact.email && c.campaignId === contact.campaignId);
  if (exists) return exists;

  const newContact = {
    id: 'ct_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    ...contact,
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

function removeInvalidContacts(campaignId) {
  let contacts = getAllContacts();
  const before = contacts.length;
  contacts = contacts.filter(c => !(c.campaignId === campaignId && c.status === 'invalid'));
  writeJSON(EMAILS_FILE, contacts);
  return before - contacts.length;
}

// ─── SETTINGS ───────────────────────────────────────────────

function getSettings() {
  return readJSON(SETTINGS_FILE);
}

function saveSettings(settings) {
  const current = getSettings();
  writeJSON(SETTINGS_FILE, { ...current, ...settings });
}

module.exports = {
  initStorage,
  getCampaigns, getCampaign, createCampaign, updateCampaign, deleteCampaign,
  getAllContacts, getContact, getContactsByCampaign, addContact, updateContact, deleteContact, removeInvalidContacts,
  getSettings, saveSettings
};
