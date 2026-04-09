/* ═══════════════════════════════════════════════════════════
   MAILFORGE — Main Application Logic
   ═══════════════════════════════════════════════════════════ */

const App = {
  state: {
    currentPage: 'dashboard',
    campaigns: [],
    contacts: [],
    selectedContacts: new Set(),
    uploadedImage: null,
    pollingIntervals: {}
  },

  // ─── INITIALIZATION ─────────────────────────────────────
  async init() {
    this.setupRouter();
    this.checkAuthStatus();
    this.loadDashboard();
    this.loadCampaignSelects();

    // Check URL for auth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      this.toast('Google account connected successfully!', 'success');
      window.history.replaceState({}, '', '/');
    } else if (params.get('auth') === 'error') {
      this.toast('Google auth failed: ' + (params.get('message') || 'Unknown error'), 'error');
      window.history.replaceState({}, '', '/');
    }
  },

  // ─── ROUTER ────────────────────────────────────────────
  setupRouter() {
    const handleRoute = () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      this.navigateTo(hash);
    };
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  },

  navigateTo(page) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Show target page
    const targetPage = document.getElementById(`page-${page}`);
    const targetNav = document.getElementById(`nav-${page}`);
    
    if (targetPage) {
      targetPage.classList.add('active');
      this.state.currentPage = page;
    }
    if (targetNav) targetNav.classList.add('active');

    // Load page-specific data
    switch (page) {
      case 'dashboard': this.loadDashboard(); break;
      case 'contacts': this.loadContacts(); break;
      case 'settings': this.loadSettings(); break;
    }
  },

  // ─── API HELPER ────────────────────────────────────────
  async api(url, options = {}) {
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
      });
      return await res.json();
    } catch (err) {
      console.error('API Error:', err);
      return { success: false, error: err.message };
    }
  },

  // ─── DASHBOARD ─────────────────────────────────────────
  async loadDashboard() {
    const campRes = await this.api('/api/campaigns');
    const contactRes = await this.api('/api/contacts');

    if (campRes.success) this.state.campaigns = campRes.data;
    if (contactRes.success) this.state.contacts = contactRes.data;

    // Update stats with animation
    const campaigns = this.state.campaigns;
    const contacts = this.state.contacts;

    this.animateCounter('stat-campaigns', campaigns.length);
    this.animateCounter('stat-contacts', contacts.length);
    this.animateCounter('stat-verified', contacts.filter(c => c.status === 'verified').length);
    this.animateCounter('stat-sent', contacts.filter(c => c.status === 'sent').length);

    // Update badges
    this.updateBadge('badge-contacts', contacts.length);

    // Render campaign list
    this.renderCampaignList(campaigns);
    this.loadCampaignSelects();
  },

  animateCounter(elementId, targetValue) {
    const el = document.querySelector(`#${elementId} .stat-value`);
    if (!el) return;
    
    const current = parseInt(el.textContent) || 0;
    if (current === targetValue) return;

    const duration = 600;
    const steps = 30;
    const increment = (targetValue - current) / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const value = Math.round(current + increment * step);
      el.textContent = value;
      if (step >= steps) {
        el.textContent = targetValue;
        clearInterval(timer);
      }
    }, duration / steps);
  },

  updateBadge(id, count) {
    const badge = document.getElementById(id);
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    }
  },

  renderCampaignList(campaigns) {
    const container = document.getElementById('campaignList');
    const empty = document.getElementById('emptyCampaigns');

    if (!campaigns.length) {
      container.innerHTML = '';
      container.appendChild(empty);
      empty.style.display = '';
      return;
    }

    empty.style.display = 'none';
    container.innerHTML = campaigns.map(c => `
      <div class="campaign-item">
        <div class="campaign-info">
          <div class="campaign-name">${this.escapeHtml(c.name)}</div>
          <div class="campaign-meta">
            <span>📧 ${c.scrapedCount || 0} scraped</span>
            <span>✅ ${c.verifiedCount || 0} verified</span>
            <span>📤 ${c.sentCount || 0} sent</span>
            <span>🕐 ${this.timeAgo(c.lastActivity || c.createdAt)}</span>
          </div>
        </div>
        <div class="campaign-actions">
          <span class="badge badge-${c.status}"><span class="badge-dot"></span>${c.status}</span>
          <button class="btn btn-secondary" onclick="App.selectCampaign('${c.id}')">Open</button>
          <button class="action-btn delete" onclick="App.deleteCampaign('${c.id}')" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `).join('');
  },

  // ─── CAMPAIGNS ─────────────────────────────────────────
  showNewCampaignModal() {
    document.getElementById('modalTitle').textContent = 'Create New Campaign';
    document.getElementById('modalBody').innerHTML = `
      <div class="form-group">
        <label class="form-label">Campaign Name</label>
        <input type="text" class="form-input" id="newCampaignName" placeholder="e.g., Q2 SaaS Outreach" autofocus/>
      </div>
      <button class="btn btn-primary btn-lg" style="width:100%;justify-content:center;" onclick="App.createCampaign()">
        Create Campaign
      </button>
    `;
    document.getElementById('modalOverlay').classList.add('active');
    setTimeout(() => document.getElementById('newCampaignName')?.focus(), 100);
  },

  async createCampaign() {
    const name = document.getElementById('newCampaignName').value.trim();
    if (!name) return this.toast('Please enter a campaign name', 'warning');

    const res = await this.api('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify({ name })
    });

    if (res.success) {
      this.toast(`Campaign "${name}" created!`, 'success');
      this.closeModal();
      this.loadDashboard();
    } else {
      this.toast(res.error || 'Failed to create campaign', 'error');
    }
  },

  async deleteCampaign(id) {
    if (!confirm('Delete this campaign and all associated contacts?')) return;

    const res = await this.api(`/api/campaigns/${id}`, { method: 'DELETE' });
    if (res.success) {
      this.toast('Campaign deleted', 'success');
      this.loadDashboard();
    } else {
      this.toast(res.error || 'Failed to delete', 'error');
    }
  },

  selectCampaign(id) {
    // Navigate to scraper with this campaign selected
    window.location.hash = '#scraper';
    setTimeout(() => {
      document.getElementById('scraperCampaignSelect').value = id;
    }, 100);
  },

  loadCampaignSelects() {
    const campaigns = this.state.campaigns;
    const selects = ['scraperCampaignSelect', 'contactCampaignFilter', 'composerCampaignSelect', 'sheetsCampaignSelect'];

    selects.forEach(selectId => {
      const el = document.getElementById(selectId);
      if (!el) return;
      const currentVal = el.value;
      const defaultOption = selectId === 'contactCampaignFilter' ? 'All Campaigns' : '-- Select a campaign --';
      el.innerHTML = `<option value="">${defaultOption}</option>` +
        campaigns.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('');
      if (currentVal) el.value = currentVal;
    });
  },

  // ─── SCRAPER ───────────────────────────────────────────
  async startScraping() {
    const campaignId = document.getElementById('scraperCampaignSelect').value;
    const urlsText = document.getElementById('scraperUrls').value.trim();

    if (!campaignId) return this.toast('Please select a campaign', 'warning');
    if (!urlsText) return this.toast('Please enter at least one URL', 'warning');

    const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u.length > 0);

    // Validate URLs
    for (const url of urls) {
      try { new URL(url); } catch {
        return this.toast(`Invalid URL: ${url}`, 'error');
      }
    }

    const logEl = document.getElementById('scrapeLog');
    const progressEl = document.getElementById('scrapeProgress');
    
    progressEl.style.display = 'flex';
    logEl.innerHTML = '';
    this.addLog(logEl, `Starting scrape of ${urls.length} website(s)...`, 'info');

    document.getElementById('btnStartScrape').disabled = true;

    const res = await this.api('/api/scrape', {
      method: 'POST',
      body: JSON.stringify({ campaignId, urls })
    });

    if (res.success) {
      this.addLog(logEl, 'Scraping initiated — processing URLs...', 'info');
      
      // Poll for results
      let lastCount = 0;
      const poll = setInterval(async () => {
        const status = await this.api(`/api/scrape/status/${campaignId}`);
        if (status.success) {
          const contacts = status.data.contacts;
          if (contacts.length > lastCount) {
            for (let i = lastCount; i < contacts.length; i++) {
              this.addLog(logEl, `✓ Found: ${contacts[i].email} (${contacts[i].company})`, 'success');
            }
            lastCount = contacts.length;
          }

          // Check if campaign is done
          if (status.data.campaign?.status === 'scraped') {
            clearInterval(poll);
            progressEl.style.display = 'none';
            document.getElementById('btnStartScrape').disabled = false;
            this.addLog(logEl, `\n═══ Scraping complete! Found ${lastCount} email(s) ═══`, 'info');
            this.toast(`Found ${lastCount} emails!`, 'success');
            this.updateBadge('badge-scraper', lastCount);
            this.loadDashboard();
          }
        }
      }, 2000);

      // Safety timeout
      setTimeout(() => {
        clearInterval(poll);
        progressEl.style.display = 'none';
        document.getElementById('btnStartScrape').disabled = false;
      }, 120000);
    } else {
      progressEl.style.display = 'none';
      document.getElementById('btnStartScrape').disabled = false;
      this.toast(res.error || 'Scraping failed', 'error');
    }
  },

  async startDiscovery() {
    const campaignId = document.getElementById('scraperCampaignSelect').value;
    const urlsText = document.getElementById('scraperUrls').value.trim();

    if (!campaignId) return this.toast('Please select a campaign', 'warning');
    if (!urlsText) return this.toast('Please enter at least one URL', 'warning');

    const domains = urlsText.split('\n')
      .map(u => { try { return new URL(u.trim()).hostname.replace('www.', ''); } catch { return null; } })
      .filter(Boolean);

    const logEl = document.getElementById('scrapeLog');
    this.addLog(logEl, `\nDiscovering decision-makers on ${domains.length} domain(s)...`, 'info');
    this.addLog(logEl, 'Searching for: Founder, CEO, CMO, Marketing roles...', 'info');

    const res = await this.api('/api/discover', {
      method: 'POST',
      body: JSON.stringify({ campaignId, domains })
    });

    if (res.success) {
      this.addLog(logEl, 'Discovery started — checking domains...', 'info');
      setTimeout(() => this.loadDashboard(), 5000);
    } else {
      this.toast(res.error || 'Discovery failed', 'error');
    }
  },

  addLog(container, text, type = 'info') {
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
  },

  // ─── CONTACTS ──────────────────────────────────────────
  async loadContacts() {
    const campaignId = document.getElementById('contactCampaignFilter')?.value || '';
    const status = document.getElementById('contactStatusFilter')?.value || '';

    let url = '/api/contacts?';
    if (campaignId) url += `campaignId=${campaignId}&`;
    if (status) url += `status=${status}&`;

    const res = await this.api(url);
    if (res.success) {
      this.state.contacts = res.data;
      this.renderContacts(res.data);
      this.updateContactStats(res.data);
    }
  },

  renderContacts(contacts) {
    const tbody = document.getElementById('contactsTableBody');
    const search = (document.getElementById('contactSearch')?.value || '').toLowerCase();

    let filtered = contacts;
    if (search) {
      filtered = contacts.filter(c =>
        (c.email || '').toLowerCase().includes(search) ||
        (c.name || '').toLowerCase().includes(search) ||
        (c.company || '').toLowerCase().includes(search) ||
        (c.role || '').toLowerCase().includes(search)
      );
    }

    if (!filtered.length) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="7">
            <div class="table-empty"><p>No contacts found</p></div>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(c => `
      <tr data-id="${c.id}">
        <td><input type="checkbox" class="contact-checkbox" value="${c.id}" onchange="App.toggleContact('${c.id}')"/></td>
        <td><strong>${this.escapeHtml(c.email)}</strong></td>
        <td>${this.escapeHtml(c.name || '—')}</td>
        <td>${this.escapeHtml(c.role || '—')}</td>
        <td>${this.escapeHtml(c.company || '—')}</td>
        <td><span class="badge badge-${c.status}"><span class="badge-dot"></span>${c.status}</span></td>
        <td>
          <button class="action-btn" onclick="App.verifySingle('${c.id}')" title="Verify">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </button>
          <button class="action-btn delete" onclick="App.deleteContact('${c.id}')" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>
      </tr>
    `).join('');
  },

  updateContactStats(contacts) {
    document.getElementById('totalCount').textContent = contacts.length;
    document.getElementById('verifiedCount').textContent = contacts.filter(c => c.status === 'verified').length;
    document.getElementById('invalidCount').textContent = contacts.filter(c => c.status === 'invalid').length;
    document.getElementById('pendingCount').textContent = contacts.filter(c => !['verified', 'invalid'].includes(c.status)).length;
  },

  filterContacts() {
    this.renderContacts(this.state.contacts);
  },

  toggleContact(id) {
    if (this.state.selectedContacts.has(id)) {
      this.state.selectedContacts.delete(id);
    } else {
      this.state.selectedContacts.add(id);
    }
  },

  toggleSelectAll() {
    const checked = document.getElementById('selectAllContacts').checked;
    document.querySelectorAll('.contact-checkbox').forEach(cb => {
      cb.checked = checked;
      if (checked) this.state.selectedContacts.add(cb.value);
      else this.state.selectedContacts.delete(cb.value);
    });
  },

  // ─── VERIFICATION ──────────────────────────────────────
  async verifyAll() {
    const campaignId = document.getElementById('contactCampaignFilter')?.value;
    if (!campaignId) return this.toast('Please select a campaign to verify', 'warning');

    const progressEl = document.getElementById('verificationProgress');
    const barEl = document.getElementById('verifyProgressBar');
    const textEl = document.getElementById('verifyProgressText');
    
    progressEl.style.display = 'block';
    textEl.textContent = 'Starting verification...';

    const res = await this.api('/api/verify', {
      method: 'POST',
      body: JSON.stringify({ campaignId })
    });

    if (res.success) {
      const total = res.total;
      let checked = 0;

      const poll = setInterval(async () => {
        const status = await this.api(`/api/verify/status/${campaignId}`);
        if (status.success) {
          const stats = status.data.stats;
          checked = stats.verified + stats.invalid;
          const pct = total > 0 ? (checked / total) * 100 : 0;
          barEl.style.width = pct + '%';
          textEl.textContent = `Verified ${checked}/${total} — ${stats.verified} valid, ${stats.invalid} invalid`;

          if (stats.pending === 0) {
            clearInterval(poll);
            progressEl.style.display = 'none';
            this.toast(`Verification complete! ${stats.verified} valid, ${stats.invalid} invalid`, 'success');
            this.loadContacts();
            this.loadDashboard();
          }
        }
      }, 3000);

      setTimeout(() => {
        clearInterval(poll);
        progressEl.style.display = 'none';
        this.loadContacts();
      }, 180000);
    }
  },

  async verifySingle(contactId) {
    this.toast('Verifying email...', 'info');
    const res = await this.api('/api/verify', {
      method: 'POST',
      body: JSON.stringify({ contactIds: [contactId] })
    });

    if (res.success) {
      setTimeout(() => this.loadContacts(), 5000);
    }
  },

  async removeInvalid() {
    const campaignId = document.getElementById('contactCampaignFilter')?.value;
    if (!campaignId) return this.toast('Please select a campaign first', 'warning');
    if (!confirm('Remove all invalid emails from this campaign?')) return;

    const res = await this.api(`/api/contacts/invalid/${campaignId}`, { method: 'DELETE' });
    if (res.success) {
      this.toast(`Removed ${res.removed} invalid contacts`, 'success');
      this.loadContacts();
      this.loadDashboard();
    }
  },

  async deleteContact(id) {
    const res = await this.api(`/api/contacts/${id}`, { method: 'DELETE' });
    if (res.success) {
      this.toast('Contact deleted', 'success');
      this.loadContacts();
    }
  },

  // ─── COMPOSER ──────────────────────────────────────────
  async loadComposerRecipients() {
    const campaignId = document.getElementById('composerCampaignSelect').value;
    const box = document.getElementById('recipientsBox');

    if (!campaignId) {
      box.innerHTML = '<span class="recipients-placeholder">Select a campaign to see verified recipients</span>';
      return;
    }

    const res = await this.api(`/api/contacts?campaignId=${campaignId}&status=verified`);
    if (res.success && res.data.length) {
      box.innerHTML = res.data.map(c =>
        `<span class="recipient-chip">${this.escapeHtml(c.email)}</span>`
      ).join('');
    } else {
      box.innerHTML = '<span class="recipients-placeholder">No verified contacts in this campaign</span>';
    }
  },

  insertVariable(varName) {
    const editor = document.getElementById('emailBody');
    editor.focus();
    document.execCommand('insertText', false, `{{${varName}}}`);
  },

  previewEmail() {
    const subject = document.getElementById('emailSubject').value || 'No Subject';
    const body = document.getElementById('emailBody').innerHTML;
    const preview = document.getElementById('emailPreview');

    preview.innerHTML = `
      <div class="preview-subject">${this.escapeHtml(subject.replace(/\{\{name\}\}/gi, 'John').replace(/\{\{company\}\}/gi, 'Acme Corp'))}</div>
      <div class="preview-body">${body.replace(/\{\{name\}\}/gi, '<strong>John</strong>').replace(/\{\{company\}\}/gi, '<strong>Acme Corp</strong>')}</div>
      ${this.state.uploadedImage ? `<img src="${this.state.uploadedImage}" style="max-width:100%;border-radius:8px;margin-top:16px;" alt="Attached"/>` : ''}
    `;
  },

  async sendCampaign() {
    const campaignId = document.getElementById('composerCampaignSelect').value;
    const subject = document.getElementById('emailSubject').value;
    const body = document.getElementById('emailBody').innerHTML;

    if (!campaignId) return this.toast('Please select a campaign', 'warning');
    if (!subject) return this.toast('Please enter a subject line', 'warning');
    if (!body.trim()) return this.toast('Please write an email body', 'warning');

    if (!confirm('Send emails to all verified contacts in this campaign?')) return;

    const formData = new FormData();
    formData.append('campaignId', campaignId);
    formData.append('subject', subject);
    formData.append('body', body);

    const imageInput = document.getElementById('imageInput');
    if (imageInput.files[0]) {
      formData.append('image', imageInput.files[0]);
    }

    const sendSection = document.getElementById('sendingSection');
    sendSection.style.display = 'block';

    const res = await fetch('/api/send', { method: 'POST', body: formData });
    const result = await res.json();

    if (result.success) {
      this.toast(`Sending to ${result.total} contacts...`, 'info');

      const poll = setInterval(async () => {
        const status = await this.api(`/api/send/status/${campaignId}`);
        if (status.success) {
          const s = status.data.stats;
          const total = s.sent + s.failed + s.pending;
          const pct = total > 0 ? ((s.sent + s.failed) / total) * 100 : 0;

          document.getElementById('sendProgressBar').style.width = pct + '%';
          document.getElementById('sentSuccessCount').textContent = s.sent;
          document.getElementById('sentFailedCount').textContent = s.failed;
          document.getElementById('sentRemainingCount').textContent = s.pending;

          if (s.pending === 0) {
            clearInterval(poll);
            this.toast(`Campaign sent! ${s.sent} delivered, ${s.failed} failed`, s.failed ? 'warning' : 'success');
            this.loadDashboard();
          }
        }
      }, 4000);
    } else {
      this.toast(result.error || 'Failed to send', 'error');
    }
  },

  // ─── IMAGE HANDLING ────────────────────────────────────
  handleDragOver(e) {
    e.preventDefault();
    document.getElementById('imageDropzone').classList.add('dragover');
  },

  handleDragLeave(e) {
    document.getElementById('imageDropzone').classList.remove('dragover');
  },

  handleDrop(e) {
    e.preventDefault();
    document.getElementById('imageDropzone').classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files[0]) this.showImagePreview(files[0]);
  },

  handleImageSelect(e) {
    if (e.target.files[0]) this.showImagePreview(e.target.files[0]);
  },

  showImagePreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.state.uploadedImage = e.target.result;
      document.getElementById('dropzoneContent').style.display = 'none';
      document.getElementById('dropzonePreview').style.display = 'block';
      document.getElementById('imagePreviewImg').src = e.target.result;
    };
    reader.readAsDataURL(file);

    // Set the file on the hidden input for upload
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    document.getElementById('imageInput').files = dataTransfer.files;
  },

  removeImage() {
    this.state.uploadedImage = null;
    document.getElementById('dropzoneContent').style.display = '';
    document.getElementById('dropzonePreview').style.display = 'none';
    document.getElementById('imageInput').value = '';
  },

  // ─── GOOGLE SHEETS ─────────────────────────────────────
  async connectGoogle() {
    const res = await this.api('/api/auth/google');
    if (res.success && res.url) {
      window.open(res.url, '_blank', 'width=500,height=600');
    } else {
      this.toast('Failed to generate auth URL. Check your Google credentials in Settings.', 'error');
    }
  },

  async exportToSheets() {
    const campaignId = document.getElementById('sheetsCampaignSelect').value;
    const sheetId = document.getElementById('sheetsId').value.trim();

    if (!campaignId) return this.toast('Please select a campaign', 'warning');
    if (!sheetId) return this.toast('Please enter a Google Sheet ID', 'warning');

    const res = await this.api('/api/sheets/export', {
      method: 'POST',
      body: JSON.stringify({ campaignId, sheetId })
    });

    if (res.success) {
      this.toast(`Exported ${res.data.updatedRows} rows to Google Sheets!`, 'success');
    } else {
      this.toast(res.error || 'Export failed', 'error');
    }
  },

  async importFromSheets() {
    const campaignId = document.getElementById('sheetsCampaignSelect').value;
    const sheetId = document.getElementById('sheetsId').value.trim();

    if (!campaignId) return this.toast('Please select a campaign', 'warning');
    if (!sheetId) return this.toast('Please enter a Google Sheet ID', 'warning');

    const res = await this.api('/api/sheets/import', {
      method: 'POST',
      body: JSON.stringify({ campaignId, sheetId })
    });

    if (res.success) {
      this.toast(`Imported ${res.data.length} contacts from Google Sheets!`, 'success');
      this.loadDashboard();
    } else {
      this.toast(res.error || 'Import failed', 'error');
    }
  },

  // ─── AUTH STATUS ───────────────────────────────────────
  async checkAuthStatus() {
    const res = await this.api('/api/auth/status');
    const statusEl = document.getElementById('authStatus');
    const connStatus = document.getElementById('sheetsConnectionStatus');

    if (res.success && res.authenticated) {
      statusEl.innerHTML = '<div class="auth-dot connected"></div><span>Google: Connected</span>';
      if (connStatus) {
        document.getElementById('connectionTitle').textContent = 'Connected';
        document.getElementById('connectionText').textContent = 'Your Google account is linked';
        connStatus.querySelector('.connection-icon').classList.remove('disconnected');
        connStatus.querySelector('.connection-icon').classList.add('connected');
      }
    }
  },

  // ─── SETTINGS ──────────────────────────────────────────
  async loadSettings() {
    const res = await this.api('/api/settings');
    if (res.success && res.data) {
      const s = res.data;
      document.getElementById('settingClientId').value = s.clientId || '';
      document.getElementById('settingClientSecret').value = s.clientSecret || '';
      document.getElementById('settingGmailUser').value = s.gmailUser || '';
      document.getElementById('settingHunterKey').value = s.hunterKey || '';
      document.getElementById('settingSenderName').value = s.senderName || '';
      document.getElementById('settingDelay').value = s.emailDelay || 4;
    }
  },

  async saveSettings() {
    const settings = {
      clientId: document.getElementById('settingClientId').value,
      clientSecret: document.getElementById('settingClientSecret').value,
      gmailUser: document.getElementById('settingGmailUser').value,
      hunterKey: document.getElementById('settingHunterKey').value,
      senderName: document.getElementById('settingSenderName').value,
      emailDelay: parseInt(document.getElementById('settingDelay').value) || 4
    };

    const res = await this.api('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });

    if (res.success) {
      this.toast('Settings saved successfully!', 'success');
    } else {
      this.toast('Failed to save settings', 'error');
    }
  },

  showSetupGuide() {
    document.getElementById('modalTitle').textContent = 'Google Cloud Setup Guide';
    document.getElementById('modalBody').innerHTML = `
      <div style="font-size:0.87rem;line-height:1.7;color:var(--text-secondary);">
        <p><strong>Step 1:</strong> Go to <a href="https://console.cloud.google.com" target="_blank">Google Cloud Console</a></p>
        <p><strong>Step 2:</strong> Create a new project or select existing</p>
        <p><strong>Step 3:</strong> Enable <strong>Gmail API</strong> and <strong>Google Sheets API</strong></p>
        <p><strong>Step 4:</strong> Go to <strong>APIs & Services → Credentials</strong></p>
        <p><strong>Step 5:</strong> Configure <strong>OAuth consent screen</strong> (External, add your email as test user)</p>
        <p><strong>Step 6:</strong> Create <strong>OAuth 2.0 Client ID</strong> (Web application)</p>
        <p><strong>Step 7:</strong> Set redirect URI to: <code style="background:var(--gray-100);padding:2px 6px;border-radius:4px;font-size:0.8rem;">http://localhost:3000/api/auth/google/callback</code></p>
        <p><strong>Step 8:</strong> Copy Client ID and Client Secret to Settings</p>
        <p style="margin-top:12px;padding:12px;background:var(--amber-50);border-radius:8px;border-left:3px solid var(--amber-500);">
          ⚠️ Add your Gmail address as a <strong>test user</strong> in the OAuth consent screen, otherwise Google will block the sign-in.
        </p>
      </div>
    `;
    document.getElementById('modalOverlay').classList.add('active');
  },

  // ─── MODAL ─────────────────────────────────────────────
  closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
  },

  // ─── TOAST NOTIFICATIONS ───────────────────────────────
  toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type]}</div>
      <div class="toast-message">${this.escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('exit');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  // ─── UTILITIES ─────────────────────────────────────────
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  timeAgo(dateStr) {
    if (!dateStr) return 'never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
};

// ─── BOOT ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
