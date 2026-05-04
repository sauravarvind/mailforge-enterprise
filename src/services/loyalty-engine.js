/**
 * ═══════════════════════════════════════════════════════════
 *  Loyalty Engine — Points, Tiers, Rewards
 *  Boost retention and LTV with customizable loyalty programs
 * ═══════════════════════════════════════════════════════════
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const LOYALTY_FILE = path.join(DATA_DIR, 'loyalty.json');
const REWARDS_FILE = path.join(DATA_DIR, 'rewards.json');

function readJSON(fp) { try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return []; } }
function writeJSON(fp, d) { fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8'); }

function initLoyalty() {
  [LOYALTY_FILE, REWARDS_FILE].forEach(f => {
    if (!fs.existsSync(f)) fs.writeFileSync(f, '[]', 'utf8');
  });
}

const TIERS = [
  { name: 'Bronze', minPoints: 0, color: '#CD7F32', perks: ['Basic rewards access'] },
  { name: 'Silver', minPoints: 500, color: '#C0C0C0', perks: ['5% bonus points', 'Early access to sales'] },
  { name: 'Gold', minPoints: 2000, color: '#FFD700', perks: ['10% bonus points', 'Free shipping', 'Priority support'] },
  { name: 'Platinum', minPoints: 5000, color: '#E5E4E2', perks: ['15% bonus points', 'Exclusive events', 'VIP support', 'Birthday rewards'] }
];

// ─── LOYALTY ACCOUNTS ───────────────────────────────────────

function getLoyaltyAccounts() { return readJSON(LOYALTY_FILE); }
function getLoyaltyAccount(contactId) { return getLoyaltyAccounts().find(a => a.contactId === contactId); }

function createLoyaltyAccount(contactId) {
  const accounts = getLoyaltyAccounts();
  if (accounts.find(a => a.contactId === contactId)) return accounts.find(a => a.contactId === contactId);
  const account = {
    id: 'loy_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    contactId, points: 0, lifetimePoints: 0,
    tier: 'Bronze', tierColor: '#CD7F32',
    history: [], redemptions: [],
    createdAt: new Date().toISOString()
  };
  accounts.push(account);
  writeJSON(LOYALTY_FILE, accounts);
  return account;
}

function earnPoints(contactId, points, reason) {
  const accounts = getLoyaltyAccounts();
  const idx = accounts.findIndex(a => a.contactId === contactId);
  if (idx === -1) return null;
  // Apply tier bonus
  const tierInfo = TIERS.find(t => t.name === accounts[idx].tier);
  const tierIdx = TIERS.indexOf(tierInfo);
  const bonus = tierIdx >= 3 ? 0.15 : tierIdx >= 2 ? 0.10 : tierIdx >= 1 ? 0.05 : 0;
  const totalPoints = Math.round(points * (1 + bonus));
  accounts[idx].points += totalPoints;
  accounts[idx].lifetimePoints += totalPoints;
  accounts[idx].history.unshift({ type: 'earn', points: totalPoints, reason, bonus: Math.round(points * bonus), at: new Date().toISOString() });
  // Check tier upgrade
  const newTier = [...TIERS].reverse().find(t => accounts[idx].lifetimePoints >= t.minPoints);
  if (newTier && newTier.name !== accounts[idx].tier) {
    accounts[idx].tier = newTier.name;
    accounts[idx].tierColor = newTier.color;
    accounts[idx].history.unshift({ type: 'tier_upgrade', tier: newTier.name, at: new Date().toISOString() });
  }
  writeJSON(LOYALTY_FILE, accounts);
  return accounts[idx];
}

function redeemPoints(contactId, points, rewardId) {
  const accounts = getLoyaltyAccounts();
  const idx = accounts.findIndex(a => a.contactId === contactId);
  if (idx === -1) return { success: false, error: 'Account not found' };
  if (accounts[idx].points < points) return { success: false, error: 'Insufficient points' };
  accounts[idx].points -= points;
  accounts[idx].redemptions.push({ rewardId, points, at: new Date().toISOString() });
  accounts[idx].history.unshift({ type: 'redeem', points: -points, rewardId, at: new Date().toISOString() });
  writeJSON(LOYALTY_FILE, accounts);
  return { success: true, account: accounts[idx] };
}

// ─── REWARDS ────────────────────────────────────────────────

function getRewards() { return readJSON(REWARDS_FILE); }

function createReward({ name, description, pointsCost, category, image, stock }) {
  const rewards = getRewards();
  const reward = {
    id: 'rwd_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    name, description: description || '', pointsCost: pointsCost || 100,
    category: category || 'general', image: image || '',
    stock: stock || -1, redeemed: 0,
    isActive: true, createdAt: new Date().toISOString()
  };
  rewards.push(reward);
  writeJSON(REWARDS_FILE, rewards);
  return reward;
}

function deleteReward(id) {
  let rewards = getRewards();
  rewards = rewards.filter(r => r.id !== id);
  writeJSON(REWARDS_FILE, rewards);
}

function getLoyaltyStats() {
  const accounts = getLoyaltyAccounts();
  const tiers = {};
  TIERS.forEach(t => tiers[t.name] = 0);
  accounts.forEach(a => { if (tiers[a.tier] !== undefined) tiers[a.tier]++; });
  return {
    totalMembers: accounts.length,
    totalPointsIssued: accounts.reduce((s, a) => s + a.lifetimePoints, 0),
    totalPointsActive: accounts.reduce((s, a) => s + a.points, 0),
    tierDistribution: tiers
  };
}

module.exports = {
  initLoyalty, TIERS, getLoyaltyAccounts, getLoyaltyAccount,
  createLoyaltyAccount, earnPoints, redeemPoints,
  getRewards, createReward, deleteReward, getLoyaltyStats
};
