/**
 * ═══════════════════════════════════════════════════════════
 *  Predictive Intent & Digital Twin Engine
 *  Intent scoring, AI copywriting, dynamic timing, digital twins
 * ═══════════════════════════════════════════════════════════
 */

// ─── Timezone offsets by common TLDs ──────────────────────
const TLD_TIMEZONES = {
  '.in': 5.5, '.co.in': 5.5, '.cn': 8, '.jp': 9, '.kr': 9,
  '.au': 10, '.nz': 12, '.uk': 0, '.co.uk': 0, '.de': 1,
  '.fr': 1, '.es': 1, '.it': 1, '.nl': 1, '.be': 1,
  '.br': -3, '.mx': -6, '.ca': -5, '.us': -5,
  '.sg': 8, '.hk': 8, '.ae': 4, '.sa': 3, '.il': 2,
  '.za': 2, '.ng': 1, '.ke': 3
};

// ─── Email copy templates by lifecycle stage ──────────────
const COPY_TEMPLATES = {
  lead: {
    tones: {
      formal: [
        'Dear {{name}},\n\nI hope this message finds you well. I am reaching out regarding a potential opportunity that may benefit {{company}}.',
        'Dear {{name}},\n\nI noticed {{company}} has been making impressive strides in your industry. I wanted to introduce how we might support your continued growth.',
      ],
      casual: [
        'Hey {{name}}! 👋\n\nI came across {{company}} and was really impressed. Wanted to quickly share something I think you\'d find valuable.',
        'Hi {{name}},\n\nQuick note — I think there\'s a great fit between what we do and what {{company}} is building.',
      ],
      urgent: [
        '{{name}} — Quick question before I close my outreach for this quarter.\n\nI have a limited opportunity that could significantly impact {{company}}\'s growth trajectory.',
        'Hi {{name}},\n\nTime-sensitive: We\'re offering priority access to a select group of companies, and {{company}} made the list.',
      ]
    },
    subjectLines: [
      'Quick question for {{company}}',
      '{{name}}, thought you\'d want to see this',
      'Partnership idea for {{company}}',
      'Helping {{company}} with [your value prop]',
      'Something caught my eye about {{company}}'
    ],
    ctas: ['Schedule a quick call?', 'Want me to send more details?', 'Open to a 15-min chat?', 'Worth exploring?']
  },
  prospect: {
    tones: {
      formal: [
        'Dear {{name}},\n\nFollowing up on my previous message. I understand you\'re busy, but I genuinely believe we can add value to {{company}}\'s operations.',
      ],
      casual: [
        'Hey {{name}},\n\nJust bumping this up in your inbox! No pressure — but did you get a chance to look at what I shared?',
      ],
      urgent: [
        '{{name}}, I don\'t want this to slip through the cracks.\n\nI\'ve seen companies like {{company}} achieve remarkable results, and I\'d hate for you to miss out.',
      ]
    },
    subjectLines: [
      'Following up — {{company}}',
      'Did you see my last note, {{name}}?',
      'Re: Partnership with {{company}}',
      'Still interested in connecting?'
    ],
    ctas: ['Can we book 15 minutes this week?', 'Reply with "interested" and I\'ll send details', 'What does your calendar look like?']
  },
  qualified: {
    tones: {
      formal: ['Dear {{name}},\n\nThank you for your interest. I\'d love to walk you through how we\'ve helped similar companies achieve measurable results.'],
      casual: ['Hi {{name}},\n\nGreat to hear back from you! Let me show you exactly how this works for companies like {{company}}.'],
      urgent: ['{{name}}, perfect timing.\n\nWe have slots opening up this week for a personalized demo. Shall I reserve one for {{company}}?']
    },
    subjectLines: ['Next steps for {{company}}', 'Your personalized demo', 'Here\'s what we discussed'],
    ctas: ['Book your demo now', 'See the full case study', 'Get your custom proposal']
  },
  opportunity: {
    tones: {
      formal: ['Dear {{name}},\n\nI\'ve prepared a custom proposal for {{company}} based on our discussions. I believe you\'ll find the ROI projections compelling.'],
      casual: ['Hey {{name}}!\n\nPut together something special for {{company}} — think you\'re going to love the numbers.'],
      urgent: ['{{name}}, the proposal I mentioned is ready.\n\nOur current pricing is available until end of month. Let\'s finalize?']
    },
    subjectLines: ['Your proposal is ready', '{{company}} — Custom plan', 'Let\'s make this official'],
    ctas: ['Review proposal', 'Let\'s finalize this week', 'Sign up today']
  },
  customer: {
    tones: {
      formal: ['Dear {{name}},\n\nThank you for choosing us. I wanted to check in on how things are going and share some tips to maximize your results.'],
      casual: ['Hey {{name}}! 🎉\n\nJust checking in — how\'s everything going? Here are some pro tips to get even more value.'],
      urgent: ['{{name}}, important update for your account.\n\nWe\'ve just released new features that could significantly improve your results.']
    },
    subjectLines: ['How\'s everything going?', 'Tips to maximize your results', '{{name}}, quick check-in'],
    ctas: ['Share feedback', 'Explore new features', 'Upgrade your plan']
  },
  retained: {
    tones: {
      formal: ['Dear {{name}},\n\nAs a valued long-term partner, I wanted to personally share our latest developments that could benefit {{company}}.'],
      casual: ['Hi {{name}}!\n\nBeing one of our most valued customers, I wanted you to be the first to know about something exciting.'],
      urgent: ['{{name}}, exclusive early access.\n\nAs a loyal customer, you get first dibs on our newest offering before anyone else.']
    },
    subjectLines: ['Exclusive for you, {{name}}', 'VIP early access', 'Thank you for being with us'],
    ctas: ['Claim your VIP offer', 'Refer a friend, both get rewarded', 'See what\'s new']
  }
};

/**
 * Calculate predictive intent score (0-100)
 */
function calculateIntentScore(contact, trackingEvents = []) {
  let intent = 0;
  const factors = [];

  // ─── Engagement signals ─────────────────────────────────
  const contactEvents = trackingEvents.filter(e => e.contactId === contact.id);
  const opens = contactEvents.filter(e => e.type === 'open').length;
  const clicks = contactEvents.filter(e => e.type === 'click').length;

  if (opens > 0) { intent += Math.min(20, opens * 5); factors.push(`Opened ${opens}x`); }
  if (clicks > 0) { intent += Math.min(25, clicks * 8); factors.push(`Clicked ${clicks}x`); }
  if (contact.trackingData?.replied) { intent += 25; factors.push('Replied to email'); }

  // ─── Recency ────────────────────────────────────────────
  if (contact.lastInteraction) {
    const daysSince = (Date.now() - new Date(contact.lastInteraction).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 1) { intent += 15; factors.push('Active today'); }
    else if (daysSince < 3) { intent += 10; factors.push('Active in last 3 days'); }
    else if (daysSince < 7) { intent += 5; factors.push('Active this week'); }
    else if (daysSince > 30) { intent -= 10; factors.push('Inactive 30+ days'); }
  }

  // ─── Velocity (engagement increasing?) ──────────────────
  if (contactEvents.length >= 2) {
    const sorted = contactEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const recentGap = new Date(sorted[0].timestamp) - new Date(sorted[1].timestamp);
    if (recentGap < 24 * 60 * 60 * 1000) { intent += 10; factors.push('Engagement velocity increasing'); }
  }

  // ─── Lifecycle position ─────────────────────────────────
  const stageIntent = { lead: 0, prospect: 5, qualified: 10, opportunity: 20, customer: 15, retained: 10, churned: -5 };
  intent += stageIntent[contact.lifecycleStage] || 0;

  // ─── Lead score correlation ─────────────────────────────
  if (contact.leadScore > 70) { intent += 10; factors.push('High lead score'); }

  return {
    score: Math.max(0, Math.min(100, Math.round(intent))),
    factors,
    label: intent >= 75 ? 'Hot' : intent >= 50 ? 'Warm' : intent >= 25 ? 'Cool' : 'Cold',
    color: intent >= 75 ? '#EF4444' : intent >= 50 ? '#F59E0B' : intent >= 25 ? '#3B82F6' : '#94A3B8'
  };
}

/**
 * Build digital twin profile for a contact
 */
function buildDigitalTwin(contact, trackingEvents = []) {
  const contactEvents = trackingEvents.filter(e => e.contactId === contact.id);

  // ─── Preferred communication time ───────────────────────
  const openHours = contactEvents
    .filter(e => e.type === 'open')
    .map(e => new Date(e.timestamp).getHours());

  let preferredHour = 10; // default 10am
  if (openHours.length > 0) {
    const hourCounts = {};
    openHours.forEach(h => { hourCounts[h] = (hourCounts[h] || 0) + 1; });
    preferredHour = parseInt(Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0][0]);
  }

  // ─── Timezone estimation ────────────────────────────────
  const domain = contact.email?.split('@')[1] || '';
  let estimatedTimezone = 0;
  for (const [tld, offset] of Object.entries(TLD_TIMEZONES)) {
    if (domain.endsWith(tld)) { estimatedTimezone = offset; break; }
  }

  // ─── Content preferences ────────────────────────────────
  const clickedUrls = contactEvents.filter(e => e.type === 'click').map(e => e.url).filter(Boolean);
  const contentPreferences = [];
  if (clickedUrls.some(u => u.includes('demo') || u.includes('trial'))) contentPreferences.push('product-demos');
  if (clickedUrls.some(u => u.includes('case-study') || u.includes('testimonial'))) contentPreferences.push('social-proof');
  if (clickedUrls.some(u => u.includes('pricing') || u.includes('plan'))) contentPreferences.push('pricing-info');
  if (clickedUrls.some(u => u.includes('blog') || u.includes('article'))) contentPreferences.push('educational-content');

  // ─── Engagement pattern ─────────────────────────────────
  const dayOfWeekCounts = {};
  contactEvents.forEach(e => {
    const day = new Date(e.timestamp).getDay();
    dayOfWeekCounts[day] = (dayOfWeekCounts[day] || 0) + 1;
  });
  const preferredDay = Object.entries(dayOfWeekCounts).sort((a, b) => b[1] - a[1])[0];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // ─── Engagement velocity ────────────────────────────────
  let velocity = 'stable';
  if (contactEvents.length >= 3) {
    const sorted = contactEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
    if (secondHalf.length > firstHalf.length * 1.5) velocity = 'increasing';
    else if (secondHalf.length < firstHalf.length * 0.5) velocity = 'decreasing';
  }

  // ─── Channel recommendation ─────────────────────────────
  const channels = ['email'];
  if (contact.role && ['ceo', 'founder', 'cto', 'director'].some(r => contact.role.toLowerCase().includes(r))) {
    channels.push('linkedin');
  }
  if (contact.lifecycleStage === 'customer' || contact.lifecycleStage === 'retained') {
    channels.push('whatsapp');
  }

  return {
    contactId: contact.id,
    email: contact.email,
    name: contact.name || '',
    company: contact.company || '',

    // Timing
    preferredHour,
    preferredHourLabel: `${preferredHour}:00 - ${preferredHour + 1}:00`,
    preferredDay: preferredDay ? dayNames[parseInt(preferredDay[0])] : 'Tuesday',
    estimatedTimezone,
    optimalSendTime: calculateOptimalSendTime(preferredHour, estimatedTimezone),

    // Behavior
    contentPreferences: contentPreferences.length > 0 ? contentPreferences : ['general'],
    engagementVelocity: velocity,
    totalInteractions: contactEvents.length,
    lastInteraction: contact.lastInteraction || null,

    // Profile
    recommendedChannels: channels,
    recommendedTone: determineTone(contact),
    predictedNextAction: predictNextAction(contact, contactEvents),

    // Scores
    intentScore: calculateIntentScore(contact, trackingEvents).score,
    leadScore: contact.leadScore || 0,

    updatedAt: new Date().toISOString()
  };
}

/**
 * Calculate optimal send time in UTC based on recipient preferences
 */
function calculateOptimalSendTime(preferredHour, timezone) {
  const utcHour = (preferredHour - timezone + 24) % 24;
  return `${String(Math.floor(utcHour)).padStart(2, '0')}:00 UTC`;
}

/**
 * Determine recommended tone for a contact
 */
function determineTone(contact) {
  const role = (contact.role || '').toLowerCase();
  if (['ceo', 'president', 'director', 'vp', 'chief'].some(r => role.includes(r))) return 'formal';
  if (['intern', 'junior', 'associate'].some(r => role.includes(r))) return 'casual';
  if (contact.lifecycleStage === 'opportunity') return 'urgent';
  return 'casual';
}

/**
 * Predict what the contact will likely do next
 */
function predictNextAction(contact, events) {
  const stage = contact.lifecycleStage || 'lead';
  const hasOpened = events.some(e => e.type === 'open');
  const hasClicked = events.some(e => e.type === 'click');

  if (stage === 'lead' && !hasOpened) return 'Likely to open first email within 48h';
  if (stage === 'lead' && hasOpened && !hasClicked) return 'May click a link — add clear CTA';
  if (stage === 'prospect') return 'Follow up needed — 60% likely to respond';
  if (stage === 'qualified') return 'Ready for demo — send scheduling link';
  if (stage === 'opportunity') return 'High intent — send proposal';
  if (stage === 'customer') return 'Upsell opportunity — share premium features';
  if (stage === 'retained') return 'Referral opportunity — ask for introduction';
  if (stage === 'churned') return 'Re-engagement needed — offer incentive';
  return 'Monitor for engagement signals';
}

/**
 * Generate AI copy suggestions
 */
function generateCopy({ stage, tone, contactName, companyName }) {
  if (tone && !['casual', 'formal', 'urgent'].includes(tone)) {
    const body = `Hi ${contactName || 'there'},\n\nRegarding: "${tone}"\n\nWe believe ${companyName || 'your company'} could really benefit from our expertise here.\n\nLet's chat soon!`;
    return { body, subjectLines: ['Quick Question', 'Partnership idea', 'Something caught my eye'], ctas: ['Let\'s talk'], tone: 'custom', stage };
  }

  const stageTemplates = COPY_TEMPLATES[stage] || COPY_TEMPLATES.lead;
  const toneTemplates = stageTemplates.tones[tone] || stageTemplates.tones.casual;

  const body = toneTemplates[Math.floor(Math.random() * toneTemplates.length)]
    .replace(/\{\{name\}\}/g, contactName || 'there')
    .replace(/\{\{company\}\}/g, companyName || 'your company');

  const subjectLines = stageTemplates.subjectLines.map(s =>
    s.replace(/\{\{name\}\}/g, contactName || 'there')
      .replace(/\{\{company\}\}/g, companyName || 'your company')
  );

  const ctas = stageTemplates.ctas;

  return { body, subjectLines, ctas, tone, stage };
}

/**
 * Generate subject line variations
 */
function generateSubjectLines(contact) {
  const name = contact.name || 'there';
  const company = contact.company || 'your team';
  const stage = contact.lifecycleStage || 'lead';
  const templates = COPY_TEMPLATES[stage] || COPY_TEMPLATES.lead;

  return templates.subjectLines.map(s =>
    s.replace(/\{\{name\}\}/g, name).replace(/\{\{company\}\}/g, company)
  );
}

/**
 * Get recommended send times for a list of contacts
 */
function getOptimalSendSchedule(contacts, trackingEvents = []) {
  return contacts.map(c => {
    const twin = buildDigitalTwin(c, trackingEvents);
    return {
      contactId: c.id,
      email: c.email,
      optimalTime: twin.optimalSendTime,
      preferredHour: twin.preferredHour,
      timezone: twin.estimatedTimezone,
      preferredDay: twin.preferredDay
    };
  });
}

/**
 * Multichannel message adapters
 */
function generateMultichannelMessages(contact, emailBody) {
  const name = contact.name || 'there';
  const company = contact.company || '';

  return {
    linkedin: {
      connectionRequest: `Hi ${name}, I came across ${company} and was impressed by what you're building. Would love to connect and share an idea that might help with growth. Looking forward!`,
      message: `Hi ${name}! Following up on my email — wanted to connect here as well. ${company} seems like a great fit for what we're working on. Would you be open to a quick chat?`,
      platform: 'LinkedIn'
    },
    sms: {
      text: `Hi ${name}, this is [Your Name]. Sent you an email about a potential collab with ${company}. Quick chat this week? Reply YES to schedule.`,
      platform: 'SMS'
    },
    whatsapp: {
      text: `Hey ${name}! 👋 Sent you an email earlier about an opportunity for ${company}. Just wanted to follow up here. Let me know if you're interested!`,
      platform: 'WhatsApp'
    }
  };
}

module.exports = {
  calculateIntentScore, buildDigitalTwin,
  generateCopy, generateSubjectLines,
  getOptimalSendSchedule, generateMultichannelMessages,
  TLD_TIMEZONES
};
