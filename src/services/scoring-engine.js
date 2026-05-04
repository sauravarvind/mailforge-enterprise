/**
 * ═══════════════════════════════════════════════════════════
 *  Scoring Engine — RFM, CLV, Engagement & Behavioral
 *  Get contact scores based on engagement, purchases, and
 *  behaviours to trigger automations or create targeted segments.
 * ═══════════════════════════════════════════════════════════
 */

// ─── RFM ANALYSIS ───────────────────────────────────────────

function calculateRFM(contact, allHistory) {
  const now = Date.now();
  const contactHistory = allHistory.filter(h => h.email === contact.email);

  // Recency — days since last interaction
  const lastAction = contact.lastInteraction || contact.sentAt || contact.createdAt;
  const daysSinceLast = lastAction ? Math.floor((now - new Date(lastAction).getTime()) / 86400000) : 999;
  let recencyScore = 5;
  if (daysSinceLast <= 1) recencyScore = 5;
  else if (daysSinceLast <= 7) recencyScore = 4;
  else if (daysSinceLast <= 30) recencyScore = 3;
  else if (daysSinceLast <= 90) recencyScore = 2;
  else recencyScore = 1;

  // Frequency — number of interactions
  const interactions = (contact.interactionCount || 0) + contactHistory.length;
  let frequencyScore = 1;
  if (interactions >= 20) frequencyScore = 5;
  else if (interactions >= 10) frequencyScore = 4;
  else if (interactions >= 5) frequencyScore = 3;
  else if (interactions >= 2) frequencyScore = 2;

  // Monetary — deal value
  const monetary = contact.dealValue || 0;
  let monetaryScore = 1;
  if (monetary >= 10000) monetaryScore = 5;
  else if (monetary >= 5000) monetaryScore = 4;
  else if (monetary >= 1000) monetaryScore = 3;
  else if (monetary >= 100) monetaryScore = 2;

  const rfmScore = Math.round(((recencyScore + frequencyScore + monetaryScore) / 15) * 100);

  return {
    recency: { score: recencyScore, daysSinceLast },
    frequency: { score: frequencyScore, totalInteractions: interactions },
    monetary: { score: monetaryScore, totalValue: monetary },
    composite: rfmScore,
    segment: getRFMSegment(recencyScore, frequencyScore, monetaryScore)
  };
}

function getRFMSegment(r, f, m) {
  const avg = (r + f + m) / 3;
  if (r >= 4 && f >= 4 && m >= 4) return 'Champions';
  if (r >= 4 && f >= 3) return 'Loyal Customers';
  if (r >= 4 && f <= 2) return 'Recent Customers';
  if (r >= 3 && f >= 3) return 'Potential Loyalists';
  if (r <= 2 && f >= 4) return 'At Risk';
  if (r <= 2 && f >= 3 && m >= 3) return 'Can\'t Lose Them';
  if (r <= 2 && f <= 2) return 'Hibernating';
  if (r >= 3 && f <= 1) return 'New Customers';
  if (avg >= 3) return 'Promising';
  return 'Need Attention';
}

// ─── CLV PREDICTION ─────────────────────────────────────────

function calculateCLV(contact, allHistory) {
  const contactHistory = allHistory.filter(h => h.email === contact.email);
  const dealValue = contact.dealValue || 0;
  const interactions = contact.interactionCount || 0;

  // Average purchase value
  const avgPurchaseValue = dealValue > 0 ? dealValue : (interactions > 0 ? 50 : 10);

  // Purchase frequency (per month)
  const createdAt = new Date(contact.createdAt || Date.now());
  const monthsActive = Math.max(1, (Date.now() - createdAt.getTime()) / (30 * 86400000));
  const purchaseFrequency = Math.max(0.1, contactHistory.length / monthsActive);

  // Estimated customer lifespan in months
  let estimatedLifespan = 12;
  const stage = contact.lifecycleStage || 'lead';
  if (stage === 'customer' || stage === 'retained') estimatedLifespan = 36;
  else if (stage === 'opportunity') estimatedLifespan = 24;
  else if (stage === 'qualified') estimatedLifespan = 18;
  else if (stage === 'churned') estimatedLifespan = 3;

  // Churn probability
  const daysSinceLast = contact.lastInteraction
    ? Math.floor((Date.now() - new Date(contact.lastInteraction).getTime()) / 86400000)
    : 30;
  const churnProbability = Math.min(0.95, daysSinceLast / 180);

  // CLV = (Avg Value × Frequency × Lifespan) × (1 - Churn Prob)
  const clv = Math.round(avgPurchaseValue * purchaseFrequency * estimatedLifespan * (1 - churnProbability));

  return {
    clv,
    avgPurchaseValue: Math.round(avgPurchaseValue),
    purchaseFrequency: Math.round(purchaseFrequency * 100) / 100,
    estimatedLifespan,
    churnProbability: Math.round(churnProbability * 100),
    tier: clv >= 5000 ? 'platinum' : clv >= 2000 ? 'gold' : clv >= 500 ? 'silver' : 'bronze'
  };
}

// ─── ENGAGEMENT SCORING ─────────────────────────────────────

function calculateEngagementScore(contact, trackingEvents) {
  const contactEvents = trackingEvents.filter(e => e.contactId === contact.id);
  let score = 0;
  const breakdown = { opens: 0, clicks: 0, replies: 0, pageVisits: 0, formSubmissions: 0 };

  // Open tracking
  const opens = contact.trackingData?.openCount || 0;
  breakdown.opens = opens;
  score += Math.min(25, opens * 3);

  // Click tracking
  const clicks = contact.trackingData?.clickCount || 0;
  breakdown.clicks = clicks;
  score += Math.min(30, clicks * 5);

  // Reply tracking
  if (contact.trackingData?.replied) { breakdown.replies = 1; score += 20; }

  // Event-based scoring
  for (const event of contactEvents) {
    if (event.type === 'page_visit') { breakdown.pageVisits++; score += 2; }
    if (event.type === 'form_submit') { breakdown.formSubmissions++; score += 10; }
  }

  // Recency bonus
  if (contact.lastInteraction) {
    const daysSince = (Date.now() - new Date(contact.lastInteraction).getTime()) / 86400000;
    if (daysSince <= 1) score += 15;
    else if (daysSince <= 7) score += 10;
    else if (daysSince <= 30) score += 5;
  }

  return {
    score: Math.min(100, Math.round(score)),
    breakdown,
    level: score >= 80 ? 'highly_engaged' : score >= 50 ? 'engaged' : score >= 25 ? 'warming' : 'cold'
  };
}

// ─── BEHAVIORAL SCORING ─────────────────────────────────────

function calculateBehavioralScore(contact) {
  let score = 0;
  const signals = [];

  // Role-based signals
  const role = (contact.role || '').toLowerCase();
  if (['ceo', 'founder', 'owner', 'president'].some(r => role.includes(r))) {
    score += 25; signals.push({ signal: 'Decision Maker', points: 25 });
  } else if (['cto', 'cmo', 'cfo', 'vp', 'director'].some(r => role.includes(r))) {
    score += 20; signals.push({ signal: 'Senior Executive', points: 20 });
  } else if (['manager', 'head', 'lead'].some(r => role.includes(r))) {
    score += 15; signals.push({ signal: 'Middle Management', points: 15 });
  }

  // Domain quality
  const domain = contact.email?.split('@')[1] || '';
  const freeDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
  if (domain && !freeDomains.includes(domain)) {
    score += 15; signals.push({ signal: 'Business Domain', points: 15 });
  }

  // Classification boost
  if (contact.classification?.category === 'business') {
    score += 10; signals.push({ signal: 'Business Classification', points: 10 });
  }

  // Verification
  if (contact.status === 'verified') {
    score += 10; signals.push({ signal: 'Verified Email', points: 10 });
  }

  // Company provided
  if (contact.company) {
    score += 5; signals.push({ signal: 'Company Known', points: 5 });
  }

  // Tags
  if (contact.tags?.length > 0) {
    score += 5; signals.push({ signal: 'Tagged Contact', points: 5 });
  }

  return {
    score: Math.min(100, Math.round(score)),
    signals,
    quality: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'
  };
}

// ─── COMPOSITE SCORE ────────────────────────────────────────

function calculateCompositeScore(contact, allHistory, trackingEvents) {
  const rfm = calculateRFM(contact, allHistory);
  const clv = calculateCLV(contact, allHistory);
  const engagement = calculateEngagementScore(contact, trackingEvents);
  const behavioral = calculateBehavioralScore(contact);

  // Weighted composite
  const weights = { rfm: 0.25, engagement: 0.30, behavioral: 0.25, clv: 0.20 };
  const clvNormalized = Math.min(100, Math.round((clv.clv / 5000) * 100));

  const composite = Math.round(
    rfm.composite * weights.rfm +
    engagement.score * weights.engagement +
    behavioral.score * weights.behavioral +
    clvNormalized * weights.clv
  );

  return {
    composite: Math.min(100, composite),
    rfm,
    clv,
    engagement,
    behavioral,
    grade: composite >= 90 ? 'A+' : composite >= 80 ? 'A' : composite >= 70 ? 'B+' :
           composite >= 60 ? 'B' : composite >= 50 ? 'C+' : composite >= 40 ? 'C' :
           composite >= 30 ? 'D' : 'F',
    updatedAt: new Date().toISOString()
  };
}

// ─── BATCH SCORING ──────────────────────────────────────────

function scoreAllContacts(contacts, allHistory, trackingEvents) {
  return contacts.map(contact => ({
    contactId: contact.id,
    email: contact.email,
    ...calculateCompositeScore(contact, allHistory, trackingEvents)
  }));
}

module.exports = {
  calculateRFM, calculateCLV, calculateEngagementScore,
  calculateBehavioralScore, calculateCompositeScore, scoreAllContacts
};
