/**
 * ═══════════════════════════════════════════════════════════
 *  Email Analytics Engine
 *  Domain analytics, time-series, domain health scoring
 * ═══════════════════════════════════════════════════════════
 */

/**
 * Extract domain analytics from contacts
 */
function getDomainAnalytics(contacts) {
  const domainMap = {};

  for (const c of contacts) {
    if (!c.email || !c.email.includes('@')) continue;
    const domain = c.email.split('@')[1].toLowerCase();

    if (!domainMap[domain]) {
      domainMap[domain] = {
        domain,
        totalContacts: 0,
        verified: 0,
        invalid: 0,
        sent: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        converted: 0,
        categories: {},
        roles: [],
        companies: new Set(),
        firstSeen: c.createdAt,
        lastActivity: c.createdAt
      };
    }

    const d = domainMap[domain];
    d.totalContacts++;

    if (c.status === 'verified') d.verified++;
    if (c.status === 'invalid') d.invalid++;
    if (c.status === 'sent') d.sent++;
    if (c.trackingData?.opened) d.opened++;
    if (c.trackingData?.clicked) d.clicked++;
    if (c.trackingData?.replied) d.replied++;
    if (c.lifecycleStage === 'customer') d.converted++;

    if (c.classification?.category) {
      d.categories[c.classification.category] = (d.categories[c.classification.category] || 0) + 1;
    }

    if (c.role) d.roles.push(c.role);
    if (c.company) d.companies.add(c.company);

    if (c.createdAt && (!d.firstSeen || c.createdAt < d.firstSeen)) d.firstSeen = c.createdAt;
    if (c.lastInteraction && (!d.lastActivity || c.lastInteraction > d.lastActivity)) d.lastActivity = c.lastInteraction;
  }

  // Calculate health scores and convert Sets
  return Object.values(domainMap).map(d => {
    d.companies = [...d.companies];
    d.healthScore = calculateDomainHealth(d);
    d.openRate = d.sent > 0 ? Math.round((d.opened / d.sent) * 100) : 0;
    d.clickRate = d.opened > 0 ? Math.round((d.clicked / d.opened) * 100) : 0;
    d.conversionRate = d.sent > 0 ? Math.round((d.converted / d.sent) * 100) : 0;
    d.verificationRate = d.totalContacts > 0 ? Math.round((d.verified / d.totalContacts) * 100) : 0;
    return d;
  }).sort((a, b) => b.totalContacts - a.totalContacts);
}

/**
 * Calculate domain health score (0-100)
 */
function calculateDomainHealth(domain) {
  let score = 50; // baseline

  // Verification rate boost
  if (domain.totalContacts > 0) {
    const vRate = domain.verified / domain.totalContacts;
    score += vRate * 20;
  }

  // Invalid penalty
  if (domain.totalContacts > 0) {
    const iRate = domain.invalid / domain.totalContacts;
    score -= iRate * 30;
  }

  // Engagement boost
  if (domain.sent > 0) {
    const openRate = domain.opened / domain.sent;
    score += openRate * 15;
    const clickRate = domain.clicked / domain.sent;
    score += clickRate * 10;
  }

  // Multiple contacts = more reliable
  if (domain.totalContacts >= 3) score += 5;
  if (domain.totalContacts >= 10) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get overview analytics
 */
function getOverviewAnalytics(contacts, history) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const recentContacts = contacts.filter(c => new Date(c.createdAt) > thirtyDaysAgo);
  const weekContacts = contacts.filter(c => new Date(c.createdAt) > sevenDaysAgo);

  const totalSent = contacts.filter(c => c.status === 'sent').length;
  const totalVerified = contacts.filter(c => c.status === 'verified').length;
  const totalInvalid = contacts.filter(c => c.status === 'invalid').length;

  // Calculate unique domains
  const domains = new Set(contacts.map(c => c.email?.split('@')[1]).filter(Boolean));

  // Status distribution
  const statusDist = {};
  for (const c of contacts) {
    statusDist[c.status || 'unknown'] = (statusDist[c.status || 'unknown'] || 0) + 1;
  }

  // Source distribution
  const sourceDist = {};
  for (const c of contacts) {
    const src = c.source?.includes('hunter') ? 'Hunter.io' : c.source === 'manual' ? 'Manual' : c.source === 'csv_upload' ? 'CSV Upload' : 'Scraped';
    sourceDist[src] = (sourceDist[src] || 0) + 1;
  }

  return {
    totalContacts: contacts.length,
    totalDomains: domains.size,
    totalSent,
    totalVerified,
    totalInvalid,
    newLast30Days: recentContacts.length,
    newLast7Days: weekContacts.length,
    verificationRate: contacts.length > 0 ? Math.round((totalVerified / contacts.length) * 100) : 0,
    deliveryRate: totalSent > 0 ? Math.round(((totalSent - (contacts.filter(c => c.status === 'send_failed').length)) / totalSent) * 100) : 0,
    statusDistribution: statusDist,
    sourceDistribution: sourceDist
  };
}

/**
 * Get time-series data for contact acquisition
 */
function getTimelineData(contacts, days = 30) {
  const now = new Date();
  const timeline = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const dayContacts = contacts.filter(c => {
      if (!c.createdAt) return false;
      return c.createdAt.startsWith(dateStr);
    });

    const daySent = contacts.filter(c => {
      if (!c.sentAt) return false;
      return c.sentAt.startsWith(dateStr);
    });

    timeline.push({
      date: dateStr,
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      newContacts: dayContacts.length,
      emailsSent: daySent.length
    });
  }

  return timeline;
}

module.exports = { getDomainAnalytics, getOverviewAnalytics, getTimelineData, calculateDomainHealth };
