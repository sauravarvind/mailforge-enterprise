/**
 * ═══════════════════════════════════════════════════════════
 *  A/B Testing Engine
 *  Variant management, tracking, statistical analysis
 * ═══════════════════════════════════════════════════════════
 */

const crypto = require('crypto');

/**
 * Create a new A/B test
 */
function createABTest({ campaignId, name, variants }) {
  return {
    id: 'ab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    campaignId,
    name: name || 'Untitled Test',
    status: 'draft', // draft, running, completed
    variants: variants.map((v, i) => ({
      id: 'var_' + i + '_' + Math.random().toString(36).substr(2, 4),
      name: v.name || `Variant ${String.fromCharCode(65 + i)}`,
      subject: v.subject || '',
      body: v.body || '',
      weight: v.weight || Math.floor(100 / variants.length),
      assignments: [],
      metrics: { sent: 0, opened: 0, clicked: 0, replied: 0, converted: 0 }
    })),
    winner: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    totalSent: 0,
    significanceThreshold: 95
  };
}

/**
 * Assign contacts to variants randomly based on weights
 */
function assignContactsToVariants(test, contactIds) {
  const totalWeight = test.variants.reduce((sum, v) => sum + v.weight, 0);
  const shuffled = [...contactIds].sort(() => Math.random() - 0.5);

  let assignedCount = 0;
  for (let vi = 0; vi < test.variants.length; vi++) {
    const variant = test.variants[vi];
    const count = vi === test.variants.length - 1
      ? shuffled.length - assignedCount
      : Math.round((variant.weight / totalWeight) * shuffled.length);

    variant.assignments = shuffled.slice(assignedCount, assignedCount + count);
    assignedCount += count;
  }

  return test;
}

/**
 * Generate a tracking ID for open/click tracking
 */
function generateTrackingId(testId, variantId, contactId, type) {
  const payload = `${testId}:${variantId}:${contactId}:${type}`;
  return Buffer.from(payload).toString('base64url');
}

/**
 * Parse a tracking ID back to its components
 */
function parseTrackingId(trackingId) {
  try {
    const payload = Buffer.from(trackingId, 'base64url').toString('utf8');
    const [testId, variantId, contactId, type] = payload.split(':');
    return { testId, variantId, contactId, type };
  } catch {
    return null;
  }
}

/**
 * Generate tracking pixel HTML
 */
function generateTrackingPixel(baseUrl, trackingId) {
  return `<img src="${baseUrl}/api/track/open/${trackingId}" width="1" height="1" style="display:none;" alt="" />`;
}

/**
 * Wrap links in HTML with click tracking
 */
function wrapLinksWithTracking(html, baseUrl, testId, variantId, contactId) {
  return html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (match, url) => {
      const trackId = generateTrackingId(testId, variantId, contactId, 'click');
      const trackedUrl = `${baseUrl}/api/track/click/${trackId}?url=${encodeURIComponent(url)}`;
      return `href="${trackedUrl}"`;
    }
  );
}

/**
 * Calculate metrics for each variant
 */
function calculateVariantMetrics(test) {
  return test.variants.map(v => {
    const m = v.metrics;
    const sent = m.sent || v.assignments.length;
    return {
      id: v.id,
      name: v.name,
      subject: v.subject,
      sent,
      opened: m.opened,
      clicked: m.clicked,
      replied: m.replied,
      converted: m.converted,
      openRate: sent > 0 ? ((m.opened / sent) * 100).toFixed(1) : '0.0',
      clickRate: m.opened > 0 ? ((m.clicked / m.opened) * 100).toFixed(1) : '0.0',
      ctr: sent > 0 ? ((m.clicked / sent) * 100).toFixed(1) : '0.0',
      replyRate: sent > 0 ? ((m.replied / sent) * 100).toFixed(1) : '0.0',
      conversionRate: sent > 0 ? ((m.converted / sent) * 100).toFixed(1) : '0.0'
    };
  });
}

/**
 * Chi-square test for statistical significance between two variants
 */
function calculateSignificance(variantA, variantB, metric = 'opened') {
  const aTotal = variantA.metrics.sent || variantA.assignments.length;
  const bTotal = variantB.metrics.sent || variantB.assignments.length;
  const aSuccess = variantA.metrics[metric] || 0;
  const bSuccess = variantB.metrics[metric] || 0;
  const aFail = aTotal - aSuccess;
  const bFail = bTotal - bSuccess;

  if (aTotal === 0 || bTotal === 0) return { significant: false, confidence: 0 };

  const total = aTotal + bTotal;
  const totalSuccess = aSuccess + bSuccess;
  const totalFail = aFail + bFail;

  // Expected values
  const eAS = (aTotal * totalSuccess) / total;
  const eAF = (aTotal * totalFail) / total;
  const eBS = (bTotal * totalSuccess) / total;
  const eBF = (bTotal * totalFail) / total;

  if (eAS === 0 || eAF === 0 || eBS === 0 || eBF === 0) return { significant: false, confidence: 0 };

  // Chi-square statistic
  const chi2 = Math.pow(aSuccess - eAS, 2) / eAS
    + Math.pow(aFail - eAF, 2) / eAF
    + Math.pow(bSuccess - eBS, 2) / eBS
    + Math.pow(bFail - eBF, 2) / eBF;

  // p-value approximation (1 degree of freedom)
  // chi2 > 3.84 = 95% confidence, > 6.63 = 99%
  let confidence = 0;
  if (chi2 >= 10.83) confidence = 99.9;
  else if (chi2 >= 6.63) confidence = 99;
  else if (chi2 >= 3.84) confidence = 95;
  else if (chi2 >= 2.71) confidence = 90;
  else if (chi2 >= 1.64) confidence = 80;
  else confidence = Math.round(chi2 / 3.84 * 80);

  return { significant: confidence >= 95, confidence, chi2: Math.round(chi2 * 100) / 100 };
}

/**
 * Determine the winning variant
 */
function determineWinner(test, metric = 'opened') {
  if (test.variants.length < 2) return null;

  const metrics = calculateVariantMetrics(test);
  const sorted = [...metrics].sort((a, b) => parseFloat(b[metric === 'opened' ? 'openRate' : 'ctr']) - parseFloat(a[metric === 'opened' ? 'openRate' : 'ctr']));

  const sig = calculateSignificance(
    test.variants.find(v => v.id === sorted[0].id),
    test.variants.find(v => v.id === sorted[1].id),
    metric
  );

  return {
    winnerId: sorted[0].id,
    winnerName: sorted[0].name,
    margin: (parseFloat(sorted[0].openRate) - parseFloat(sorted[1].openRate)).toFixed(1),
    significance: sig
  };
}

/**
 * Get funnel data for a campaign
 */
function getFunnelData(contacts, trackingEvents) {
  const sent = contacts.filter(c => c.status === 'sent').length;
  const opened = trackingEvents.filter(e => e.type === 'open').length;
  const uniqueOpens = new Set(trackingEvents.filter(e => e.type === 'open').map(e => e.contactId)).size;
  const clicked = new Set(trackingEvents.filter(e => e.type === 'click').map(e => e.contactId)).size;
  const replied = contacts.filter(c => c.trackingData?.replied).length;
  const converted = contacts.filter(c => c.lifecycleStage === 'customer' || c.lifecycleStage === 'retained').length;

  return {
    stages: [
      { name: 'Sent', count: sent, color: '#3B82F6', pct: 100 },
      { name: 'Opened', count: uniqueOpens, color: '#8B5CF6', pct: sent > 0 ? Math.round((uniqueOpens / sent) * 100) : 0 },
      { name: 'Clicked', count: clicked, color: '#F59E0B', pct: sent > 0 ? Math.round((clicked / sent) * 100) : 0 },
      { name: 'Replied', count: replied, color: '#10B981', pct: sent > 0 ? Math.round((replied / sent) * 100) : 0 },
      { name: 'Converted', count: converted, color: '#059669', pct: sent > 0 ? Math.round((converted / sent) * 100) : 0 }
    ]
  };
}

/**
 * Get link heatmap data
 */
function getLinkHeatmap(trackingEvents) {
  const linkClicks = {};
  for (const e of trackingEvents) {
    if (e.type === 'click' && e.url) {
      if (!linkClicks[e.url]) linkClicks[e.url] = { url: e.url, clicks: 0, uniqueClickers: new Set() };
      linkClicks[e.url].clicks++;
      linkClicks[e.url].uniqueClickers.add(e.contactId);
    }
  }

  return Object.values(linkClicks)
    .map(l => ({ url: l.url, clicks: l.clicks, uniqueClickers: l.uniqueClickers.size }))
    .sort((a, b) => b.clicks - a.clicks);
}

module.exports = {
  createABTest, assignContactsToVariants,
  generateTrackingId, parseTrackingId, generateTrackingPixel, wrapLinksWithTracking,
  calculateVariantMetrics, calculateSignificance, determineWinner,
  getFunnelData, getLinkHeatmap
};
