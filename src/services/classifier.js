/**
 * ═══════════════════════════════════════════════════════════
 *  AI Email Classifier — Rule-based heuristic engine
 *  Categories: business, personal, spam, support
 * ═══════════════════════════════════════════════════════════
 */

// ─── Known personal email domains ─────────────────────────
const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'aol.com', 'icloud.com', 'me.com', 'mac.com', 'mail.com',
  'protonmail.com', 'proton.me', 'zoho.com', 'yandex.com', 'gmx.com',
  'fastmail.com', 'tutanota.com', 'hey.com', 'inbox.com',
  'yahoo.co.in', 'yahoo.co.uk', 'hotmail.co.uk', 'outlook.in',
  'rediffmail.com', 'msn.com', 'att.net', 'sbcglobal.net',
  'comcast.net', 'verizon.net', 'cox.net', 'charter.net'
]);

// ─── Known spam / disposable domains ──────────────────────
const SPAM_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'trashmail.com', '10minutemail.com', 'temp-mail.org', 'fakeinbox.com',
  'dispostable.com', 'maildrop.cc', 'getairmail.com', 'mailnesia.com',
  'guerrillamail.info', 'binkmail.com', 'safetymail.info', 'tempinbox.com',
  'trash-mail.com', 'mytemp.email', 'mohmal.com', 'emailondeck.com',
  'getnada.com', 'burnermail.io', 'inboxkitten.com', 'mailsac.com'
]);

// ─── Support-indicating prefixes ──────────────────────────
const SUPPORT_PREFIXES = [
  'support', 'help', 'helpdesk', 'service', 'customerservice',
  'customercare', 'care', 'assist', 'ticket', 'billing',
  'accounts', 'feedback', 'complaints', 'returns', 'refund',
  'warranty', 'technical', 'techsupport', 'it-support', 'desk'
];

// ─── Spam-indicating prefixes ─────────────────────────────
const SPAM_PREFIXES = [
  'noreply', 'no-reply', 'donotreply', 'do-not-reply', 'mailer-daemon',
  'bounce', 'unsubscribe', 'newsletter', 'promo', 'promotions',
  'marketing', 'notification', 'notifications', 'alert', 'alerts',
  'auto', 'automated', 'system', 'admin', 'postmaster', 'webmaster'
];

// ─── Business-indicating prefixes ─────────────────────────
const BUSINESS_PREFIXES = [
  'ceo', 'cto', 'cfo', 'cmo', 'coo', 'founder', 'cofounder',
  'director', 'manager', 'head', 'lead', 'vp', 'president',
  'sales', 'biz', 'business', 'partner', 'partnerships',
  'hr', 'recruitment', 'talent', 'careers', 'jobs',
  'press', 'media', 'pr', 'communications', 'investor',
  'legal', 'compliance', 'procurement', 'operations'
];

// ─── Business TLDs ────────────────────────────────────────
const BUSINESS_TLDS = new Set(['.com', '.io', '.co', '.ai', '.tech', '.app', '.dev', '.cloud', '.net', '.org']);
const EDUCATION_TLDS = new Set(['.edu', '.ac.uk', '.edu.in', '.edu.au']);
const GOVERNMENT_TLDS = new Set(['.gov', '.gov.uk', '.gov.in', '.mil']);

/**
 * Classify a single email address
 * Returns: { category, confidence, reasons[] }
 */
function classifyEmail(email, contact = {}) {
  const results = { business: 0, personal: 0, spam: 0, support: 0 };
  const reasons = [];

  if (!email || !email.includes('@')) {
    return { category: 'spam', confidence: 90, reasons: ['Invalid email format'] };
  }

  const [prefix, domain] = email.toLowerCase().split('@');
  const tld = '.' + domain.split('.').slice(-1)[0];
  const fullTld = '.' + domain.split('.').slice(-2).join('.');

  // ─── Domain-based classification ────────────────────────
  if (PERSONAL_DOMAINS.has(domain)) {
    results.personal += 40;
    reasons.push(`Personal email provider (${domain})`);
  }

  if (SPAM_DOMAINS.has(domain)) {
    results.spam += 70;
    reasons.push(`Known disposable/spam domain (${domain})`);
  }

  if (EDUCATION_TLDS.has(tld) || EDUCATION_TLDS.has(fullTld)) {
    results.personal += 20;
    results.business += 15;
    reasons.push('Educational domain');
  }

  if (GOVERNMENT_TLDS.has(tld) || GOVERNMENT_TLDS.has(fullTld)) {
    results.business += 35;
    reasons.push('Government domain');
  }

  // If domain is NOT personal/spam, it's likely a company domain
  if (!PERSONAL_DOMAINS.has(domain) && !SPAM_DOMAINS.has(domain)) {
    results.business += 25;
    reasons.push('Custom/company domain');
  }

  // ─── Prefix-based classification ────────────────────────
  const prefixLower = prefix.replace(/[._\-0-9]/g, '').toLowerCase();

  for (const sp of SUPPORT_PREFIXES) {
    if (prefix.startsWith(sp) || prefix === sp) {
      results.support += 45;
      reasons.push(`Support-indicating prefix: ${sp}`);
      break;
    }
  }

  for (const sp of SPAM_PREFIXES) {
    if (prefix.startsWith(sp) || prefix === sp) {
      results.spam += 40;
      reasons.push(`Automated/no-reply prefix: ${sp}`);
      break;
    }
  }

  for (const bp of BUSINESS_PREFIXES) {
    if (prefix.startsWith(bp) || prefix === bp) {
      results.business += 30;
      reasons.push(`Business role prefix: ${bp}`);
      break;
    }
  }

  // ─── Name pattern analysis ──────────────────────────────
  // Patterns like "john.doe" or "jdoe" suggest real person
  if (/^[a-z]+\.[a-z]+$/.test(prefix)) {
    results.business += 15;
    results.personal += 10;
    reasons.push('First.Last name pattern');
  }

  if (/^[a-z]{1,2}[a-z]+$/.test(prefix) && prefix.length > 3 && prefix.length < 15) {
    results.personal += 5;
  }

  // Generic prefixes like "info@" or "contact@"
  if (['info', 'contact', 'hello', 'hi', 'hey', 'team', 'office', 'general', 'enquiries', 'inquiries'].includes(prefix)) {
    results.business += 20;
    reasons.push('Generic business contact prefix');
  }

  // ─── Contact metadata boost ─────────────────────────────
  if (contact.role) {
    const roleLower = (contact.role || '').toLowerCase();
    const seniorRoles = ['ceo', 'founder', 'co-founder', 'cto', 'cmo', 'director', 'vp', 'president', 'head', 'manager'];
    if (seniorRoles.some(r => roleLower.includes(r))) {
      results.business += 25;
      reasons.push(`Senior role detected: ${contact.role}`);
    }
  }

  if (contact.company && contact.company.length > 2) {
    results.business += 10;
    reasons.push('Company name present');
  }

  // ─── Determine winner ──────────────────────────────────
  const entries = Object.entries(results).sort((a, b) => b[1] - a[1]);
  const [topCategory, topScore] = entries[0];
  const [, secondScore] = entries[1] || [null, 0];

  // Confidence: how much the top category leads over the second
  let confidence = Math.min(95, Math.max(30, topScore));
  if (topScore > 0 && secondScore > 0) {
    const gap = topScore - secondScore;
    confidence = Math.min(95, 40 + gap * 1.5);
  }

  return {
    category: topCategory,
    confidence: Math.round(confidence),
    reasons,
    scores: results
  };
}

/**
 * Classify an array of contacts
 */
function classifyContacts(contacts) {
  return contacts.map(contact => {
    const result = classifyEmail(contact.email, contact);
    return {
      contactId: contact.id,
      email: contact.email,
      ...result
    };
  });
}

/**
 * Get classification distribution stats
 */
function getClassificationStats(contacts) {
  const stats = { business: 0, personal: 0, spam: 0, support: 0, unclassified: 0, total: contacts.length };
  const confidenceSum = { business: 0, personal: 0, spam: 0, support: 0 };

  for (const c of contacts) {
    if (c.classification && c.classification.category) {
      const cat = c.classification.category;
      stats[cat] = (stats[cat] || 0) + 1;
      confidenceSum[cat] = (confidenceSum[cat] || 0) + (c.classification.confidence || 0);
    } else {
      stats.unclassified++;
    }
  }

  const avgConfidence = {};
  for (const cat of ['business', 'personal', 'spam', 'support']) {
    avgConfidence[cat] = stats[cat] > 0 ? Math.round(confidenceSum[cat] / stats[cat]) : 0;
  }

  return { ...stats, avgConfidence };
}

module.exports = { classifyEmail, classifyContacts, getClassificationStats };
