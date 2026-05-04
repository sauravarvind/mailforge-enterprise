/**
 * ═══════════════════════════════════════════════════════════
 *  E-Commerce Engine
 *  AI recommendations, back-in-stock alerts, coupon engine
 * ═══════════════════════════════════════════════════════════
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const COUPONS_FILE = path.join(DATA_DIR, 'coupons.json');
const ALERTS_FILE = path.join(DATA_DIR, 'stock_alerts.json');

function readJSON(fp) { try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return []; } }
function writeJSON(fp, d) { fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8'); }

function initEcommerce() {
  [PRODUCTS_FILE, COUPONS_FILE, ALERTS_FILE].forEach(f => {
    if (!fs.existsSync(f)) fs.writeFileSync(f, '[]', 'utf8');
  });
}

// ─── PRODUCTS ───────────────────────────────────────────────

function getProducts() { return readJSON(PRODUCTS_FILE); }
function getProduct(id) { return getProducts().find(p => p.id === id); }

function createProduct({ name, sku, price, category, image, description, inStock, tags }) {
  const products = getProducts();
  const product = {
    id: 'prod_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    name, sku: sku || '', price: price || 0, category: category || '',
    image: image || '', description: description || '',
    inStock: inStock !== false, tags: tags || [],
    views: 0, purchases: 0,
    createdAt: new Date().toISOString()
  };
  products.push(product);
  writeJSON(PRODUCTS_FILE, products);
  return product;
}

function updateProduct(id, updates) {
  const products = getProducts();
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return null;
  products[idx] = { ...products[idx], ...updates };
  writeJSON(PRODUCTS_FILE, products);
  return products[idx];
}

function deleteProduct(id) {
  let products = getProducts();
  products = products.filter(p => p.id !== id);
  writeJSON(PRODUCTS_FILE, products);
}

// ─── AI RECOMMENDATIONS ────────────────────────────────────

function getRecommendations(contact, limit = 5) {
  const products = getProducts().filter(p => p.inStock);
  if (!products.length) return [];

  // Score products based on contact's behavior and attributes
  const scored = products.map(p => {
    let score = 0;
    // Industry match
    if (contact.industry && p.category && p.category.toLowerCase().includes(contact.industry.toLowerCase())) score += 30;
    // Tag match with contact tags
    if (contact.tags?.length && p.tags?.length) {
      const overlap = p.tags.filter(t => contact.tags.includes(t)).length;
      score += overlap * 15;
    }
    // Popularity boost
    score += Math.min(20, (p.purchases || 0) * 2);
    // Price-based scoring (higher engagement contacts get premium products)
    const leadScore = contact.leadScore || 0;
    if (leadScore >= 70 && p.price >= 100) score += 15;
    else if (leadScore < 30 && p.price <= 50) score += 10;
    // Randomness factor for variety
    score += Math.random() * 10;
    return { ...p, recommendationScore: Math.round(score) };
  });

  return scored.sort((a, b) => b.recommendationScore - a.recommendationScore).slice(0, limit);
}

// ─── BACK-IN-STOCK ALERTS ──────────────────────────────────

function getStockAlerts() { return readJSON(ALERTS_FILE); }

function createStockAlert({ productId, contactId, email }) {
  const alerts = getStockAlerts();
  if (alerts.find(a => a.productId === productId && a.contactId === contactId)) return null;
  const alert = {
    id: 'alert_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    productId, contactId, email,
    status: 'waiting', notifiedAt: null,
    createdAt: new Date().toISOString()
  };
  alerts.push(alert);
  writeJSON(ALERTS_FILE, alerts);
  return alert;
}

function triggerStockAlerts(productId) {
  const alerts = getStockAlerts();
  const triggered = [];
  for (let i = 0; i < alerts.length; i++) {
    if (alerts[i].productId === productId && alerts[i].status === 'waiting') {
      alerts[i].status = 'notified';
      alerts[i].notifiedAt = new Date().toISOString();
      triggered.push(alerts[i]);
    }
  }
  writeJSON(ALERTS_FILE, alerts);
  return triggered;
}

// ─── COUPON ENGINE ──────────────────────────────────────────

function getCoupons() { return readJSON(COUPONS_FILE); }
function getCoupon(id) { return getCoupons().find(c => c.id === id); }
function getCouponByCode(code) { return getCoupons().find(c => c.code === code.toUpperCase()); }

function createCoupon({ code, type, value, minPurchase, maxUses, expiresAt, campaignId, description }) {
  const coupons = getCoupons();
  if (coupons.find(c => c.code === code.toUpperCase())) throw new Error('Coupon code already exists');
  const coupon = {
    id: 'cpn_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    code: code.toUpperCase(),
    type: type || 'percentage', // percentage, fixed, free_shipping
    value: value || 10,
    minPurchase: minPurchase || 0,
    maxUses: maxUses || 0, // 0 = unlimited
    usedCount: 0,
    usedBy: [],
    campaignId: campaignId || null,
    description: description || '',
    isActive: true,
    expiresAt: expiresAt || null,
    createdAt: new Date().toISOString()
  };
  coupons.push(coupon);
  writeJSON(COUPONS_FILE, coupons);
  return coupon;
}

function redeemCoupon(code, contactId) {
  const coupons = getCoupons();
  const idx = coupons.findIndex(c => c.code === code.toUpperCase());
  if (idx === -1) return { valid: false, error: 'Coupon not found' };
  const coupon = coupons[idx];
  if (!coupon.isActive) return { valid: false, error: 'Coupon is inactive' };
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return { valid: false, error: 'Coupon expired' };
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) return { valid: false, error: 'Coupon usage limit reached' };
  if (coupon.usedBy.includes(contactId)) return { valid: false, error: 'Already used by this contact' };
  coupon.usedCount++;
  coupon.usedBy.push(contactId);
  writeJSON(COUPONS_FILE, coupons);
  return { valid: true, coupon };
}

function deleteCoupon(id) {
  let coupons = getCoupons();
  coupons = coupons.filter(c => c.id !== id);
  writeJSON(COUPONS_FILE, coupons);
}

module.exports = {
  initEcommerce, getProducts, getProduct, createProduct, updateProduct, deleteProduct,
  getRecommendations, getStockAlerts, createStockAlert, triggerStockAlerts,
  getCoupons, getCoupon, getCouponByCode, createCoupon, redeemCoupon, deleteCoupon
};
