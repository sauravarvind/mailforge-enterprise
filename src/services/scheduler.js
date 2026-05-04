/**
 * ═══════════════════════════════════════════════════════════
 *  Email Scheduler
 *  Queue management, timezone-aware scheduling, retry logic
 * ═══════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, '..', '..', 'data', 'scheduled_queue.json');
const storageService = require('./storage');
const intentEngine = require('./intent-engine');

function readQueue() {
  try { return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')); }
  catch { return []; }
}

function writeQueue(queue) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');
}

/**
 * Add emails to the scheduled queue
 */
function scheduleEmails(items) {
  const queue = readQueue();
  const newItems = items.map(item => ({
    id: 'sched_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    contactId: item.contactId,
    email: item.email,
    subject: item.subject,
    body: item.body,
    campaignId: item.campaignId,
    scheduledFor: item.scheduledFor || new Date().toISOString(),
    timezone: item.timezone || 0,
    status: 'queued', // queued, sending, sent, failed, cancelled
    retries: 0,
    maxRetries: 3,
    createdAt: new Date().toISOString(),
    sentAt: null,
    error: null
  }));

  queue.push(...newItems);
  writeQueue(queue);
  return newItems;
}

/**
 * Get emails due for sending
 */
function getDueEmails() {
  const queue = readQueue();
  const now = new Date().toISOString();
  return queue.filter(item =>
    item.status === 'queued' &&
    item.scheduledFor <= now
  );
}

/**
 * Update queue item status
 */
function updateQueueItem(id, updates) {
  const queue = readQueue();
  const idx = queue.findIndex(q => q.id === id);
  if (idx === -1) return null;
  queue[idx] = { ...queue[idx], ...updates };
  writeQueue(queue);
  return queue[idx];
}

/**
 * Mark item as sent
 */
function markSent(id) {
  return updateQueueItem(id, { status: 'sent', sentAt: new Date().toISOString() });
}

/**
 * Mark item as failed with retry logic
 */
function markFailed(id, error) {
  const queue = readQueue();
  const item = queue.find(q => q.id === id);
  if (!item) return null;

  if (item.retries < item.maxRetries) {
    // Retry with exponential backoff
    const delayMs = Math.pow(2, item.retries) * 60000; // 1min, 2min, 4min
    const nextRetry = new Date(Date.now() + delayMs).toISOString();
    return updateQueueItem(id, {
      status: 'queued',
      retries: item.retries + 1,
      scheduledFor: nextRetry,
      error: error
    });
  }

  return updateQueueItem(id, { status: 'failed', error });
}

/**
 * Cancel a scheduled email
 */
function cancelScheduled(id) {
  return updateQueueItem(id, { status: 'cancelled' });
}

/**
 * Get queue stats
 */
function getQueueStats() {
  const queue = readQueue();
  return {
    total: queue.length,
    queued: queue.filter(q => q.status === 'queued').length,
    sent: queue.filter(q => q.status === 'sent').length,
    failed: queue.filter(q => q.status === 'failed').length,
    cancelled: queue.filter(q => q.status === 'cancelled').length
  };
}

/**
 * Get full queue
 */
function getQueue(status) {
  const queue = readQueue();
  if (status) return queue.filter(q => q.status === status);
  return queue;
}

/**
 * Calculate optimal send time for a contact based on their timezone
 */
function calculateSendTime(preferredHour, timezone, daysFromNow = 0) {
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + daysFromNow);

  // Adjust for recipient's timezone
  const utcHour = (preferredHour - timezone + 24) % 24;
  targetDate.setUTCHours(utcHour, 0, 0, 0);

  // If the time has passed today, schedule for tomorrow
  if (targetDate <= now) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  // Avoid weekends
  const day = targetDate.getDay();
  if (day === 0) targetDate.setDate(targetDate.getDate() + 1); // Sunday → Monday
  if (day === 6) targetDate.setDate(targetDate.getDate() + 2); // Saturday → Monday

  return targetDate.toISOString();
}

/**
 * Evaluate active automations against contact logic.
 */
function processAutomations() {
  const automations = storageService.getAutomations().filter(a => a.active);
  if (!automations.length) return { processed: 0 };

  const contacts = storageService.getAllContacts();
  const events = storageService.getTrackingEvents();
  let processedCount = 0;

  for (const contact of contacts) {
    const contactEvents = events.filter(e => e.contactId === contact.id);
    const sortedEvents = contactEvents.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    const lastEvent = sortedEvents[0];
    
    for (const automation of automations) {
      let triggered = false;
      
      // Basic trigger logic
      if (automation.trigger === 'contact_created' && contact.createdAt) {
        const ageHours = (new Date() - new Date(contact.createdAt)) / 3600000;
        if (ageHours < 24) triggered = true;
      } else if (automation.trigger === 'email_opened' && lastEvent && lastEvent.type === 'open') {
        const ageHours = (new Date() - new Date(lastEvent.timestamp)) / 3600000;
        if (ageHours < 24) triggered = true;
      } else if (automation.trigger === 'email_clicked' && lastEvent && lastEvent.type === 'click') {
        triggered = true;
      } else if (automation.trigger === 'intent_hot') {
        const intent = intentEngine.calculateIntentScore(contact, events);
        if (intent.score >= 75) triggered = true;
      }

      // Very simple execution - real implementation would track execution state per contact
      if (triggered && automation.rules && automation.rules.length > 0) {
        console.log(`[Automation] Triggering ${automation.name} for ${contact.email}`);
        processedCount++;
        // Enqueue actions into scheduled queue instead of raw execution
        for (const rule of automation.rules) {
          if (rule.type === 'change_stage') {
             storageService.updateContact(contact.id, { lifecycleStage: rule.stage });
          } else if (rule.type === 'send_template') {
             const tpl = storageService.getTemplate(rule.templateId);
             if (tpl && !storageService.isAlreadySent(contact.email, 'auto_' + automation.id)) {
               const compiled = intentEngine.generateCopy({ stage: contact.lifecycleStage, tone: 'casual', contactName: contact.name, companyName: contact.company });
               scheduleEmails([{
                 contactId: contact.id, email: contact.email,
                 subject: tpl.subject, body: tpl.body, campaignId: 'auto_' + automation.id
               }]);
             }
          }
        }
      }
    }
  }
  return { processed: processedCount };
}

module.exports = {
  scheduleEmails, getDueEmails, updateQueueItem,
  markSent, markFailed, cancelScheduled,
  getQueueStats, getQueue, calculateSendTime, processAutomations
};
