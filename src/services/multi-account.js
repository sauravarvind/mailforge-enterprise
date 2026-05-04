/**
 * ═══════════════════════════════════════════════════════════
 *  Multi-Account Manager
 *  Manage multiple business units & brands under one master
 * ═══════════════════════════════════════════════════════════
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');

function readJSON(fp) { try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return []; } }
function writeJSON(fp, d) { fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8'); }

function initAccounts() {
  const accounts = fs.existsSync(ACCOUNTS_FILE) ? readJSON(ACCOUNTS_FILE) : [];
  if (!accounts.length) {
    writeJSON(ACCOUNTS_FILE, [{
      id: 'acct_master', name: 'Primary Account', brand: 'MailForge',
      isMaster: true, logo: null, color: '#4F46E5', domain: '',
      timezone: 'UTC', industry: '', memberUserIds: [],
      settings: { dedicatedIp: null, senderDomain: '', replyTo: '' },
      stats: { contacts: 0, campaigns: 0, emailsSent: 0 },
      createdAt: new Date().toISOString()
    }]);
  }
}

function getAccounts() { return readJSON(ACCOUNTS_FILE); }
function getAccount(id) { return getAccounts().find(a => a.id === id); }

function createAccount({ name, brand, domain, industry, color }) {
  const accounts = getAccounts();
  const account = {
    id: 'acct_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    name, brand: brand || name, isMaster: false, logo: null,
    color: color || '#3B82F6', domain: domain || '', timezone: 'UTC',
    industry: industry || '', memberUserIds: [],
    settings: { dedicatedIp: null, senderDomain: domain || '', replyTo: '' },
    stats: { contacts: 0, campaigns: 0, emailsSent: 0 },
    createdAt: new Date().toISOString()
  };
  accounts.push(account);
  writeJSON(ACCOUNTS_FILE, accounts);
  return account;
}

function updateAccount(id, updates) {
  const accounts = getAccounts();
  const idx = accounts.findIndex(a => a.id === id);
  if (idx === -1) return null;
  const safe = ['name','brand','logo','color','domain','timezone','industry','settings','memberUserIds'];
  for (const k of safe) { if (updates[k] !== undefined) accounts[idx][k] = updates[k]; }
  writeJSON(ACCOUNTS_FILE, accounts);
  return accounts[idx];
}

function deleteAccount(id) {
  let accounts = getAccounts();
  if (accounts.find(a => a.id === id)?.isMaster) throw new Error('Cannot delete master');
  accounts = accounts.filter(a => a.id !== id);
  writeJSON(ACCOUNTS_FILE, accounts);
}

function addUserToAccount(accountId, userId) {
  const accounts = getAccounts();
  const idx = accounts.findIndex(a => a.id === accountId);
  if (idx === -1) return null;
  if (!accounts[idx].memberUserIds.includes(userId)) accounts[idx].memberUserIds.push(userId);
  writeJSON(ACCOUNTS_FILE, accounts);
  return accounts[idx];
}

module.exports = {
  initAccounts, getAccounts, getAccount,
  createAccount, updateAccount, deleteAccount, addUserToAccount
};
