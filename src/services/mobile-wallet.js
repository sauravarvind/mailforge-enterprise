/**
 * ═══════════════════════════════════════════════════════════
 *  Mobile Wallet — Digitize loyalty cards, vouchers, tickets
 * ═══════════════════════════════════════════════════════════
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const WALLET_FILE = path.join(DATA_DIR, 'wallet_passes.json');

function readJSON(fp) { try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return []; } }
function writeJSON(fp, d) { fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8'); }

function initWallet() {
  if (!fs.existsSync(WALLET_FILE)) writeJSON(WALLET_FILE, []);
}

function getPasses() { return readJSON(WALLET_FILE); }
function getPass(id) { return getPasses().find(p => p.id === id); }
function getContactPasses(contactId) { return getPasses().filter(p => p.contactId === contactId); }

function createPass({ type, contactId, title, subtitle, barcode, fields, style, expiresAt }) {
  const passes = getPasses();
  const pass = {
    id: 'pass_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    type: type || 'loyalty', // loyalty, coupon, ticket, voucher
    contactId, title, subtitle: subtitle || '',
    barcode: barcode || crypto.randomBytes(8).toString('hex').toUpperCase(),
    fields: fields || [],
    style: style || { bgColor: '#4F46E5', textColor: '#ffffff', logo: '' },
    isActive: true, isRedeemed: false,
    expiresAt: expiresAt || null,
    notificationsSent: 0,
    createdAt: new Date().toISOString()
  };
  passes.push(pass);
  writeJSON(WALLET_FILE, passes);
  return pass;
}

function updatePass(id, updates) {
  const passes = getPasses();
  const idx = passes.findIndex(p => p.id === id);
  if (idx === -1) return null;
  passes[idx] = { ...passes[idx], ...updates };
  writeJSON(WALLET_FILE, passes);
  return passes[idx];
}

function redeemPass(id) {
  return updatePass(id, { isRedeemed: true, redeemedAt: new Date().toISOString() });
}

function deletePass(id) {
  let passes = getPasses();
  passes = passes.filter(p => p.id !== id);
  writeJSON(WALLET_FILE, passes);
}

function getWalletStats() {
  const passes = getPasses();
  return {
    total: passes.length,
    active: passes.filter(p => p.isActive && !p.isRedeemed).length,
    redeemed: passes.filter(p => p.isRedeemed).length,
    byType: { loyalty: passes.filter(p => p.type === 'loyalty').length, coupon: passes.filter(p => p.type === 'coupon').length, ticket: passes.filter(p => p.type === 'ticket').length, voucher: passes.filter(p => p.type === 'voucher').length }
  };
}

module.exports = {
  initWallet, getPasses, getPass, getContactPasses,
  createPass, updatePass, redeemPass, deletePass, getWalletStats
};
