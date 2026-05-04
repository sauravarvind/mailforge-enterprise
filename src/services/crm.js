/**
 * ═══════════════════════════════════════════════════════════
 *  CRM-Lite Engine
 *  Lifecycle stages, lead scoring, notes, tags, deals
 * ═══════════════════════════════════════════════════════════
 */

const LIFECYCLE_STAGES = ['lead', 'prospect', 'qualified', 'opportunity', 'customer', 'retained', 'churned'];
const STAGE_LABELS = {
  lead: 'Lead', prospect: 'Prospect', qualified: 'Qualified',
  opportunity: 'Opportunity', customer: 'Customer', retained: 'Retained', churned: 'Churned'
};
const STAGE_COLORS = {
  lead: '#94A3B8', prospect: '#3B82F6', qualified: '#8B5CF6',
  opportunity: '#F59E0B', customer: '#10B981', retained: '#059669', churned: '#EF4444'
};

/**
 * Calculate lead score (0-100) for a contact
 */
function calculateLeadScore(contact) {
  let score = 10; // baseline

  // ─── Role seniority ─────────────────────────────────────
  const role = (contact.role || '').toLowerCase();
  if (['ceo', 'founder', 'co-founder', 'president', 'owner'].some(r => role.includes(r))) score += 25;
  else if (['cto', 'cmo', 'cfo', 'coo', 'vp', 'vice president'].some(r => role.includes(r))) score += 20;
  else if (['director', 'head'].some(r => role.includes(r))) score += 15;
  else if (['manager', 'lead', 'senior'].some(r => role.includes(r))) score += 10;
  else if (role.length > 0) score += 5;

  // ─── Email verification status ──────────────────────────
  if (contact.status === 'verified') score += 10;
  if (contact.status === 'invalid') score -= 20;

  // ─── Classification ─────────────────────────────────────
  if (contact.classification?.category === 'business') score += 10;
  if (contact.classification?.category === 'spam') score -= 30;
  if (contact.classification?.category === 'support') score += 5;

  // ─── Company domain (not personal email) ────────────────
  const domain = contact.email?.split('@')[1] || '';
  const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
  if (!personalDomains.includes(domain)) score += 8;

  // ─── Engagement ─────────────────────────────────────────
  if (contact.trackingData?.opened) score += 10;
  if (contact.trackingData?.clicked) score += 15;
  if (contact.trackingData?.replied) score += 20;

  // ─── Interaction count ──────────────────────────────────
  const interactions = contact.interactionCount || 0;
  score += Math.min(10, interactions * 2);

  // ─── Lifecycle stage boost ──────────────────────────────
  const stageBoost = { lead: 0, prospect: 5, qualified: 10, opportunity: 15, customer: 20, retained: 25, churned: -10 };
  score += stageBoost[contact.lifecycleStage] || 0;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get pipeline data grouped by lifecycle stage
 */
function getPipelineData(contacts) {
  const pipeline = {};
  for (const stage of LIFECYCLE_STAGES) {
    pipeline[stage] = {
      stage,
      label: STAGE_LABELS[stage],
      color: STAGE_COLORS[stage],
      contacts: [],
      count: 0,
      totalValue: 0
    };
  }

  for (const c of contacts) {
    const stage = c.lifecycleStage || 'lead';
    if (pipeline[stage]) {
      pipeline[stage].contacts.push({
        id: c.id,
        email: c.email,
        name: c.name || '',
        company: c.company || '',
        role: c.role || '',
        leadScore: c.leadScore || calculateLeadScore(c),
        dealValue: c.dealValue || 0,
        tags: c.tags || [],
        lastInteraction: c.lastInteraction || c.createdAt
      });
      pipeline[stage].count++;
      pipeline[stage].totalValue += c.dealValue || 0;
    }
  }

  return pipeline;
}

/**
 * Get top leads sorted by score
 */
function getLeaderboard(contacts, limit = 20) {
  return contacts
    .map(c => ({
      id: c.id,
      email: c.email,
      name: c.name || '',
      company: c.company || '',
      role: c.role || '',
      leadScore: c.leadScore || calculateLeadScore(c),
      lifecycleStage: c.lifecycleStage || 'lead',
      dealValue: c.dealValue || 0
    }))
    .sort((a, b) => b.leadScore - a.leadScore)
    .slice(0, limit);
}

/**
 * Suggest next lifecycle stage transition
 */
function suggestStageTransition(contact) {
  const currentStage = contact.lifecycleStage || 'lead';
  const score = contact.leadScore || calculateLeadScore(contact);
  const idx = LIFECYCLE_STAGES.indexOf(currentStage);

  if (currentStage === 'churned') return null;
  if (idx >= LIFECYCLE_STAGES.length - 2) return null;

  const thresholds = { lead: 25, prospect: 40, qualified: 55, opportunity: 70, customer: 85 };
  const nextStage = LIFECYCLE_STAGES[idx + 1];

  if (score >= (thresholds[currentStage] || 50)) {
    return {
      from: currentStage,
      to: nextStage,
      reason: `Lead score (${score}) exceeds threshold for ${STAGE_LABELS[nextStage]}`,
      confidence: Math.min(95, score)
    };
  }

  return null;
}

module.exports = {
  LIFECYCLE_STAGES, STAGE_LABELS, STAGE_COLORS,
  calculateLeadScore, getPipelineData, getLeaderboard, suggestStageTransition
};
