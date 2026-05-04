/**
 * ═══════════════════════════════════════════════════════════
 *  Aura AI Data Analyst
 *  Ask plain-language questions, get instant answers
 * ═══════════════════════════════════════════════════════════
 */

function analyzeQuery(query, contacts, campaigns, history) {
  const q = query.toLowerCase().trim();
  const totalContacts = contacts.length;
  const verified = contacts.filter(c => c.status === 'verified').length;
  const sent = contacts.filter(c => c.status === 'sent').length;
  const opened = contacts.filter(c => c.trackingData?.opened).length;
  const clicked = contacts.filter(c => c.trackingData?.clicked).length;
  const customers = contacts.filter(c => c.lifecycleStage === 'customer' || c.lifecycleStage === 'retained').length;
  const totalDeals = contacts.reduce((s, c) => s + (c.dealValue || 0), 0);

  // Pattern matching for common queries
  if (q.includes('how many') && q.includes('contact')) {
    return { type: 'number', answer: `You have **${totalContacts}** total contacts across ${campaigns.length} campaigns.`, value: totalContacts, chart: null };
  }

  if (q.includes('conversion') && q.includes('rate')) {
    const rate = sent > 0 ? ((customers / sent) * 100).toFixed(1) : '0';
    return { type: 'percentage', answer: `Your overall conversion rate is **${rate}%** (${customers} customers from ${sent} sent).`, value: rate, chart: 'funnel' };
  }

  if (q.includes('open') && (q.includes('rate') || q.includes('how many'))) {
    const rate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : '0';
    return { type: 'percentage', answer: `**${opened}** contacts opened emails — that's a **${rate}%** open rate.`, value: rate, chart: 'bar' };
  }

  if (q.includes('click') && (q.includes('rate') || q.includes('how many'))) {
    const rate = sent > 0 ? ((clicked / sent) * 100).toFixed(1) : '0';
    return { type: 'percentage', answer: `**${clicked}** contacts clicked — **${rate}%** CTR.`, value: rate, chart: 'bar' };
  }

  if (q.includes('top') && q.includes('campaign')) {
    const ranked = campaigns.map(c => ({ name: c.name, sent: c.sentCount || 0, verified: c.verifiedCount || 0 })).sort((a, b) => b.sent - a.sent);
    const top = ranked[0];
    return { type: 'table', answer: top ? `Your top campaign is **"${top.name}"** with ${top.sent} emails sent.` : 'No campaigns yet.', data: ranked.slice(0, 5), chart: 'table' };
  }

  if (q.includes('pipeline') || q.includes('deal') || q.includes('revenue')) {
    return { type: 'number', answer: `Total pipeline value is **$${totalDeals.toLocaleString()}** across ${customers} paying customers.`, value: totalDeals, chart: 'bar' };
  }

  if (q.includes('verified') || q.includes('valid')) {
    const rate = totalContacts > 0 ? ((verified / totalContacts) * 100).toFixed(1) : '0';
    return { type: 'number', answer: `**${verified}** contacts verified (${rate}% of total). ${totalContacts - verified} pending.`, value: verified, chart: 'pie' };
  }

  if ((q.includes('best') || q.includes('optimal')) && (q.includes('time') || q.includes('when') || q.includes('send'))) {
    return { type: 'text', answer: 'Based on B2B engagement data, **Tuesday-Thursday 9-11 AM** yields the highest open rates. Your best window is **10 AM local time**.', value: null, chart: 'heatmap' };
  }

  if (q.includes('churn') || q.includes('lost') || q.includes('inactive')) {
    const churned = contacts.filter(c => c.lifecycleStage === 'churned').length;
    const inactive = contacts.filter(c => { const li = c.lastInteraction; return li && (Date.now() - new Date(li).getTime()) > 30 * 86400000; }).length;
    return { type: 'number', answer: `**${churned}** contacts churned and **${inactive}** have been inactive for 30+ days.`, value: churned + inactive, chart: 'bar' };
  }

  if (q.includes('segment') || q.includes('audience') || q.includes('group')) {
    const stages = {};
    contacts.forEach(c => { const s = c.lifecycleStage || 'lead'; stages[s] = (stages[s] || 0) + 1; });
    return { type: 'table', answer: 'Here\'s your audience breakdown by lifecycle stage:', data: Object.entries(stages).map(([stage, count]) => ({ stage, count })), chart: 'pie' };
  }

  if (q.includes('score') || q.includes('lead')) {
    const avgScore = totalContacts > 0 ? Math.round(contacts.reduce((s, c) => s + (c.leadScore || 0), 0) / totalContacts) : 0;
    const high = contacts.filter(c => (c.leadScore || 0) >= 70).length;
    return { type: 'number', answer: `Average lead score is **${avgScore}**. You have **${high}** hot leads (score ≥ 70).`, value: avgScore, chart: 'histogram' };
  }

  if (q.includes('email') && q.includes('sent')) {
    return { type: 'number', answer: `**${history.length}** emails sent in total across all campaigns.`, value: history.length, chart: 'timeline' };
  }

  if (q.includes('industry') || q.includes('industries')) {
    const industries = {};
    contacts.forEach(c => { if (c.industry) industries[c.industry] = (industries[c.industry] || 0) + 1; });
    return { type: 'table', answer: 'Contact distribution by industry:', data: Object.entries(industries).map(([name, count]) => ({ industry: name, count })).sort((a, b) => b.count - a.count), chart: 'bar' };
  }

  if (q.includes('summary') || q.includes('overview') || q.includes('dashboard')) {
    return {
      type: 'summary',
      answer: `📊 **Quick Summary**\n• ${totalContacts} contacts (${verified} verified)\n• ${campaigns.length} campaigns\n• ${sent} emails sent\n• ${opened} opens (${sent > 0 ? ((opened/sent)*100).toFixed(0) : 0}% rate)\n• ${clicked} clicks\n• ${customers} customers\n• $${totalDeals.toLocaleString()} pipeline`,
      value: null, chart: null
    };
  }

  // Fallback
  return {
    type: 'text',
    answer: `I analyzed your data but couldn't find a specific answer. Here's what I know:\n\n• **${totalContacts}** contacts across **${campaigns.length}** campaigns\n• **${verified}** verified, **${sent}** emailed\n• Pipeline: **$${totalDeals.toLocaleString()}**\n\nTry asking: "What's my open rate?", "Show top campaigns", or "How many hot leads?"`,
    value: null, chart: null
  };
}

function getQuerySuggestions() {
  return [
    'How many contacts do I have?',
    'What\'s my conversion rate?',
    'Show me the open rate',
    'What\'s the click rate?',
    'Show top campaigns',
    'How much is my pipeline worth?',
    'How many contacts are verified?',
    'When is the best time to send?',
    'Show audience breakdown',
    'What\'s the average lead score?',
    'How many emails have been sent?',
    'Give me a quick summary'
  ];
}

module.exports = { analyzeQuery, getQuerySuggestions };
