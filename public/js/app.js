/* ═══════════════════════════════════════════════════════════
   MAILFORGE — Revenue Intelligence System (v3)
   ═══════════════════════════════════════════════════════════ */
const App = {
  state: {
    currentPage: 'dashboard', campaigns: [], contacts: [], templates: [],
    selectedContacts: new Set(), uploadedImage: null, currentFolder: '',
    blocks: [], blockIdCounter: 0, draggedBlockType: null, draggedBlockId: null,
    currentTemplateFilter: '', sidebarCollapsed: false, notifications: []
  },

  async init() {
    this.setupRouter();
    this.checkAuthStatus();
    await this.loadDashboard();
    this.startScraperStatusPoll();
    // Restore sidebar state
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
      this.state.sidebarCollapsed = true;
      document.getElementById('appLayout').classList.add('sidebar-collapsed');
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') { this.toast('Google account connected!', 'success'); window.history.replaceState({}, '', '/'); }
    else if (params.get('auth') === 'error') { this.toast('Auth failed: ' + (params.get('message') || ''), 'error'); window.history.replaceState({}, '', '/'); }
    document.addEventListener('focusin', (e) => { const tb = document.getElementById('richTextToolbar'); if (tb && e.target.classList.contains('block-editable')) tb.style.display = 'flex'; });
    document.addEventListener('focusout', () => { setTimeout(() => { const tb = document.getElementById('richTextToolbar'); if (tb && !document.activeElement?.classList?.contains('block-editable') && !document.activeElement?.closest?.('.rich-text-toolbar')) tb.style.display = 'none'; }, 200); });
    // Close notification panel on outside click
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('notifPanel');
      if (panel && !panel.contains(e.target) && !e.target.closest('#navNotifications')) panel.remove();
    });
  },

  setupRouter() {
    const handleRoute = () => { this.navigateTo(window.location.hash.replace('#', '') || 'dashboard'); };
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  },
  navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const tp = document.getElementById(`page-${page}`), tn = document.getElementById(`nav-${page}`);
    if (tp) { tp.classList.add('active'); this.state.currentPage = page; }
    if (tn) tn.classList.add('active');
    switch (page) {
      case 'dashboard': this.loadDashboard(); break;
      case 'analytics': this.loadAnalytics(); break;
      case 'contacts': this.loadContacts(); this.loadFolders(); break;
      case 'composer': this.loadTemplates(); this.loadCampaignSelects(); break;
      case 'templates': this.loadTemplateGallery(); break;
      case 'crm': this.loadPipeline(); break;
      case 'abtesting': this.loadABTests(); break;
      case 'intelligence': this.loadIntelligence(); break;
      case 'automations': if (this.loadAutomations) this.loadAutomations(); break;
      case 'history': this.loadHistory(); break;
      case 'sheets': this.loadSyncSheetId(); break;
      case 'settings': this.loadSettings(); this.loadSettingsSubTabs(); break;
      
      // New Enterprise Pages
      case 'scoring': if (this.loadScoring) this.loadScoring(); break;
      case 'segments': if (this.loadSegments) this.loadSegments(); break;
      case 'analyst': if (this.loadAnalystSuggestions) this.loadAnalystSuggestions(); break;
      case 'products': if (this.loadProducts) this.loadProducts(); break;
      case 'recommendations': if (this.loadRecommendations) this.loadRecommendations(); break;
      case 'coupons': if (this.loadCoupons) this.loadCoupons(); break;
      case 'loyalty': if (this.loadLoyalty) this.loadLoyalty(); break;
      case 'wallet': if (this.loadWallet) this.loadWallet(); break;
      case 'users': if (this.loadUsers) this.loadUsers(); break;
      case 'accounts': if (this.loadAccounts) this.loadAccounts(); break;
      case 'custom-objects': if (this.loadCustomObjects) this.loadCustomObjects(); break;
    }
  },

  async api(url, opts = {}) {
    try {
      if (!opts.method || opts.method === 'GET') {
        opts.cache = 'no-store';
      }
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...opts.headers }, ...opts });
      return await res.json();
    } catch (err) { return { success: false, error: err.message }; }
  },

  // ─── SIDEBAR TOGGLE ────────────────────────────────────
  toggleSidebar() {
    this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
    document.getElementById('appLayout').classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebarCollapsed', this.state.sidebarCollapsed);
  },

  // ─── GLOBAL SEARCH ────────────────────────────────────
  globalSearch(query) {
    if (!query || query.length < 2) return;
    // Navigate to contacts page and apply search
    window.location.hash = '#contacts';
    setTimeout(() => {
      const searchEl = document.getElementById('contactSearch');
      if (searchEl) { searchEl.value = query; this.filterContacts(); }
    }, 200);
  },

  // ─── NOTIFICATIONS ────────────────────────────────────
  showNotifications() {
    let panel = document.getElementById('notifPanel');
    if (panel) { panel.remove(); return; }
    panel = document.createElement('div');
    panel.id = 'notifPanel';
    panel.className = 'notif-panel';
    const notifs = this.state.notifications.length ? this.state.notifications.map(n => `
      <div class="notif-item">
        <span class="material-icons-outlined">${n.icon || 'info'}</span>
        <div class="notif-content">
          <div>${this.esc(n.message)}</div>
          <div class="notif-time">${this.timeAgo(n.time)}</div>
        </div>
      </div>
    `).join('') : '<div class="notif-empty">No notifications yet</div>';
    panel.innerHTML = `<div class="notif-panel-header"><span>Notifications</span><button class="btn btn-ghost btn-sm" onclick="this.closest('.notif-panel').remove()"><span class="material-icons-outlined" style="font-size:18px">close</span></button></div>${notifs}`;
    document.body.appendChild(panel);
  },

  addNotification(message, icon = 'info') {
    this.state.notifications.unshift({ message, icon, time: new Date().toISOString() });
    if (this.state.notifications.length > 20) this.state.notifications.pop();
    const badge = document.getElementById('notifBadge');
    if (badge) { badge.textContent = this.state.notifications.length; badge.style.display = ''; }
  },

  startScraperStatusPoll() {
    setInterval(async () => {
      const res = await this.api('/api/scraper/status');
      // Update sidebar status
      const txt = document.getElementById('scraperStatusText');
      const dot = document.getElementById('scraperStatusDot');
      // Update navbar status
      const navTxt = document.getElementById('navScraperText');
      const navDot = document.getElementById('navScraperDot');
      if (res.success && res.data.running) {
        const msg = res.data.progress || 'Scraping...';
        if (txt) txt.textContent = msg;
        if (dot) dot.className = 'scraper-status-dot running';
        if (navTxt) navTxt.textContent = msg;
        if (navDot) navDot.className = 'scraper-status-dot running';
      } else if (res.success) {
        const msg = res.data.progress?.startsWith('Done') ? res.data.progress : 'Scraper: Idle';
        if (txt) txt.textContent = msg;
        if (dot) dot.className = 'scraper-status-dot idle';
        if (navTxt) navTxt.textContent = msg;
        if (navDot) navDot.className = 'scraper-status-dot idle';
      }
    }, 3000);
  },

  // ─── DASHBOARD ─────────────────────────────────────────
  async loadDashboard() {
    const [campRes, contactRes, classRes] = await Promise.all([this.api('/api/campaigns'), this.api('/api/contacts'), this.api('/api/classify/stats')]);
    if (campRes.success) this.state.campaigns = campRes.data;
    if (contactRes.success) this.state.contacts = contactRes.data;
    const campaigns = this.state.campaigns, contacts = this.state.contacts;
    this.setCounter('stat-campaigns', campaigns.length);
    this.setCounter('stat-contacts', contacts.length);
    this.setCounter('stat-verified', contacts.filter(c => c.status === 'verified').length);
    this.setCounter('stat-sent', contacts.filter(c => c.status === 'sent').length);
    this.updateBadge('badge-contacts', contacts.length);
    // Pipeline value
    const pv = contacts.reduce((s, c) => s + (c.dealValue || 0), 0);
    const pvEl = document.getElementById('pipelineValue'); if (pvEl) pvEl.textContent = '$' + pv.toLocaleString();
    const hlEl = document.getElementById('hotLeadsCount'); if (hlEl) hlEl.textContent = contacts.filter(c => (c.leadScore || 0) >= 60).length;
    // Classification bars
    if (classRes.success) {
      const d = classRes.data, total = d.total || 1;
      ['business','personal','support','spam'].forEach(cat => {
        const bar = document.getElementById('classBar-' + cat);
        const cnt = document.getElementById('classCount-' + cat);
        if (bar) bar.style.width = ((d[cat] || 0) / total * 100) + '%';
        if (cnt) cnt.textContent = d[cat] || 0;
      });
    }
    // Funnel
    const sent = contacts.filter(c => c.status === 'sent').length;
    const opened = contacts.filter(c => c.trackingData?.opened).length;
    const clicked = contacts.filter(c => c.trackingData?.clicked).length;
    const replied = contacts.filter(c => c.trackingData?.replied).length;
    const converted = contacts.filter(c => c.lifecycleStage === 'customer' || c.lifecycleStage === 'retained').length;
    
    const funnelArea = document.getElementById('dashboardFunnelContainer');
    if (funnelArea) {
      funnelArea.innerHTML = `
        <svg class="cf-svg" viewBox="0 0 1000 200" preserveAspectRatio="none">
          <defs>
            <linearGradient id="db-funnel-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#4F46E5" stop-opacity="0.6" />
              <stop offset="100%" stop-color="#4F46E5" stop-opacity="0.1" />
            </linearGradient>
          </defs>
          <path d="M0,20 C150,20 200,80 330,80 C480,80 520,140 660,140 C800,140 850,160 1000,160 L1000,200 L0,200 Z" fill="url(#db-funnel-grad)" />
        </svg>
        <div class="cf-overlay-grid">
          <div class="cf-column active">
             <div class="cf-hover-circle"></div>
             <div class="cf-data"><div class="cf-num">${sent}</div><div class="cf-info"><span class="label">Sent</span><span class="sub">Total Outreach</span></div></div>
          </div>
          <div class="cf-column">
             <div class="cf-hover-circle"></div>
             <div class="cf-data"><div class="cf-num">${opened}</div><div class="cf-info"><span class="label">Opened</span><span class="sub">Captured Interest</span></div></div>
          </div>
          <div class="cf-column">
             <div class="cf-hover-circle"></div>
             <div class="cf-data"><div class="cf-num">${clicked}</div><div class="cf-info"><span class="label">Clicked</span><span class="sub">Engaged</span></div></div>
          </div>
          <div class="cf-column">
             <div class="cf-hover-circle"></div>
             <div class="cf-data"><div class="cf-num">${converted}</div><div class="cf-info"><span class="label">Converted</span><span class="sub">Opportunities</span></div></div>
          </div>
        </div>
        <div class="cf-floating-card">
          <div class="num">${sent > 0 ? Math.round((converted/sent)*100) : 0}%</div>
          <div class="desc"><span>Conversion</span><span class="m">From Sent to Won</span></div>
        </div>
      `;
      // Interactivity
      setTimeout(() => {
         document.querySelectorAll('#dashboardFunnelContainer .cf-column').forEach(col => {
           col.addEventListener('mouseenter', () => {
              document.querySelectorAll('#dashboardFunnelContainer .cf-column').forEach(c => c.classList.remove('active'));
              col.classList.add('active');
           });
         });
      }, 100);
    }
    this.renderCampaignList(campaigns);
    this.loadCampaignSelects();
  },
  setCounter(id, val) { const el = document.querySelector(`#${id} .stat-value`); if (el) el.textContent = val; },
  updateBadge(id, count) { const b = document.getElementById(id); if (b) { b.textContent = count; b.style.display = count > 0 ? '' : 'none'; } },

  renderCampaignList(campaigns) {
    const container = document.getElementById('campaignList');
    const empty = document.getElementById('emptyCampaigns');
    if (!campaigns.length) { container.innerHTML = ''; container.appendChild(empty); empty.style.display = ''; return; }
    empty.style.display = 'none';
    container.innerHTML = campaigns.map(c => `
      <div class="campaign-item">
        <div class="campaign-info">
          <div class="campaign-name">${this.esc(c.name)}</div>
          <div class="campaign-meta">
            ${c.industry ? `<span><span class="material-icons-outlined" style="font-size:14px;vertical-align:middle">business</span> ${this.esc(c.industry)}</span>` : ''}
            <span><span class="material-icons-outlined" style="font-size:14px;vertical-align:middle">email</span> ${c.scrapedCount||0} scraped</span>
            <span><span class="material-icons-outlined" style="font-size:14px;vertical-align:middle">check_circle</span> ${c.verifiedCount||0}</span>
            <span><span class="material-icons-outlined" style="font-size:14px;vertical-align:middle">send</span> ${c.sentCount||0} sent</span>
            <span><span class="material-icons-outlined" style="font-size:14px;vertical-align:middle">schedule</span> ${this.timeAgo(c.lastActivity||c.createdAt)}</span>
          </div>
        </div>
        <div class="campaign-actions">
          <span class="badge badge-${c.status}"><span class="badge-dot"></span>${c.status}</span>
          <button class="btn btn-secondary" onclick="App.selectCampaign('${c.id}')">Open</button>
          <button class="action-btn delete" onclick="App.deleteCampaign('${c.id}')" title="Delete"><span class="material-icons-outlined" style="font-size:18px">delete</span></button>
        </div>
      </div>`).join('');
  },

  showNewCampaignModal() {
    this.showModal('Create New Campaign', `
      <div class="form-group"><label class="form-label">Campaign Name</label><input type="text" class="form-input" id="newCampaignName" placeholder="e.g., Q2 SaaS Outreach" autofocus/></div>
      <div class="form-group"><label class="form-label">Industry Type</label><input type="text" class="form-input" id="newCampaignIndustry" placeholder="e.g., SaaS, Healthcare"/></div>
      <div class="form-group"><label class="form-label">Product / Service</label><input type="text" class="form-input" id="newCampaignProduct" placeholder="e.g., Marketing Automation Tool"/></div>
      <button class="btn btn-primary btn-lg" style="width:100%;justify-content:center;" onclick="App.createCampaign()">Create Campaign</button>
    `);
  },
  async createCampaign() {
    const name = document.getElementById('newCampaignName').value.trim();
    if (!name) return this.toast('Enter a campaign name', 'warning');
    const res = await this.api('/api/campaigns', { method: 'POST', body: JSON.stringify({ name, industry: document.getElementById('newCampaignIndustry').value.trim(), productService: document.getElementById('newCampaignProduct').value.trim() }) });
    if (res.success) { this.toast(`Campaign "${name}" created!`, 'success'); this.closeModal(); await this.loadDashboard(); }
    else this.toast(res.error || 'Failed', 'error');
  },
  async deleteCampaign(id) { if (!confirm('Delete this campaign and all contacts?')) return; await this.api(`/api/campaigns/${id}`, { method: 'DELETE' }); this.toast('Deleted', 'success'); this.loadDashboard(); },
  selectCampaign(id) { window.location.hash = '#scraper'; setTimeout(() => { document.getElementById('scraperCampaignSelect').value = id; }, 100); },
  loadCampaignSelects() {
    ['scraperCampaignSelect','composerCampaignSelect','sheetsCampaignSelect','autonomousCampaignSelect'].forEach(sid => {
      const el = document.getElementById(sid); if (!el) return;
      const cur = el.value;
      el.innerHTML = '<option value="">-- Select a campaign --</option>' + this.state.campaigns.map(c => `<option value="${c.id}">${this.esc(c.name)}</option>`).join('');
      if (cur) el.value = cur;
    });
  },

  // ─── SCRAPE & DISCOVER ─────────────────────────────────
  async startScrapeAndDiscover() {
    const campaignId = document.getElementById('scraperCampaignSelect').value;
    const urlsText = document.getElementById('scraperUrls').value.trim();
    if (!campaignId) return this.toast('Select a campaign', 'warning');
    if (!urlsText) return this.toast('Enter URLs', 'warning');
    const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u);
    const logEl = document.getElementById('scrapeLog');
    document.getElementById('scrapeProgress').style.display = 'flex';
    logEl.innerHTML = ''; this.addLog(logEl, `Starting scrape on ${urls.length} URL(s)...`, 'info');
    document.getElementById('btnStartScrape').disabled = true;
    const res = await this.api('/api/scrape-and-discover', { method: 'POST', body: JSON.stringify({ campaignId, urls }) });
    if (res.success) {
      let lastCount = 0;
      const poll = setInterval(async () => {
        const s = await this.api(`/api/scrape/status/${campaignId}`);
        if (s.success) {
          const ct = s.data.contacts;
          for (let i = lastCount; i < ct.length; i++) this.addLog(logEl, `✓ ${ct[i].email} — ${ct[i].company}`, 'success');
          lastCount = ct.length;
          if (s.data.campaign?.status === 'scraped') { clearInterval(poll); document.getElementById('scrapeProgress').style.display = 'none'; document.getElementById('btnStartScrape').disabled = false; this.addLog(logEl, `\n═══ Complete! Found ${lastCount} email(s) ═══`, 'info'); this.toast(`Found ${lastCount} emails!`, 'success'); this.loadDashboard(); }
        }
      }, 2000);
      setTimeout(() => { clearInterval(poll); document.getElementById('scrapeProgress').style.display = 'none'; document.getElementById('btnStartScrape').disabled = false; }, 120000);
    } else { document.getElementById('scrapeProgress').style.display = 'none'; document.getElementById('btnStartScrape').disabled = false; this.toast(res.error || 'Failed', 'error'); }
  },
  addLog(c, t, type = 'info') { const l = document.createElement('div'); l.className = `log-line ${type}`; l.textContent = `[${new Date().toLocaleTimeString()}] ${t}`; c.appendChild(l); c.scrollTop = c.scrollHeight; },

  // ─── CONTACTS ──────────────────────────────────────────
  async loadContacts() {
    const cid = this.state.currentFolder, status = document.getElementById('contactStatusFilter')?.value || '';
    const classFilter = document.getElementById('contactClassFilter')?.value || '';
    let url = '/api/contacts?';
    if (cid) url += `campaignId=${cid}&`;
    if (status) url += `status=${status}&`;
    if (classFilter) url += `classification=${classFilter}&`;
    const res = await this.api(url);
    if (res.success) { this.state.contacts = res.data; this.renderContacts(res.data); this.updateContactStats(res.data); }
  },
  renderContacts(contacts) {
    const tbody = document.getElementById('contactsTableBody');
    const search = (document.getElementById('contactSearch')?.value || '').toLowerCase();
    let filtered = contacts;
    if (search) filtered = contacts.filter(c => [c.email, c.name, c.company, c.role].some(f => (f || '').toLowerCase().includes(search)));
    if (!filtered.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="9"><div class="table-empty"><p>No contacts found</p></div></td></tr>`; return; }
    tbody.innerHTML = filtered.map(c => {
      const cls = c.classification?.category;
      const clsBadge = cls ? `<span class="class-chip ${cls}">${cls}</span>` : '<span class="text-muted">—</span>';
      const score = c.leadScore || 0;
      const stage = c.lifecycleStage || 'lead';
      return `<tr data-id="${c.id}">
        <td><input type="checkbox" class="contact-checkbox" value="${c.id}" onchange="App.toggleContact('${c.id}')"/></td>
        <td><strong>${this.esc(c.email)}</strong></td>
        <td>${this.esc(c.name||'—')}</td><td>${this.esc(c.company||'—')}</td>
        <td>${clsBadge}</td>
        <td><span class="score-badge" style="--sc:${score}">${score}</span></td>
        <td><span class="stage-chip ${stage}">${stage}</span></td>
        <td><span class="badge badge-${c.status}"><span class="badge-dot"></span>${c.status === 'manual' ? 'Manual' : c.status}</span>
        ${c.verificationDetails?.reason ? `<span class="material-icons-outlined" style="font-size:14px;vertical-align:middle;cursor:help;margin-left:4px" title="${this.esc(c.verificationDetails.reason)}">help_outline</span>` : ''}
        </td>
        <td class="action-cell">
          <button class="action-btn" onclick="App.showEditContactModal('${c.id}')" title="Edit"><span class="material-icons-outlined" style="font-size:18px">edit</span></button>
          <button class="action-btn" onclick="App.openContactDrawer('${c.id}')" title="CRM"><span class="material-icons-outlined" style="font-size:18px">assignment</span></button>
          ${c.status === 'invalid' || c.status === 'manual' ? `<button class="action-btn" onclick="App.manualVerify('${c.id}')"><span class="material-icons-outlined" style="font-size:18px">verified</span></button>` : ''}
          <button class="action-btn delete" onclick="App.deleteContact('${c.id}')"><span class="material-icons-outlined" style="font-size:18px">delete</span></button>
        </td>
      </tr>`;
    }).join('');
  },
  updateContactStats(contacts) {
    document.getElementById('totalCount').textContent = contacts.length;
    document.getElementById('verifiedCount').textContent = contacts.filter(c => c.status === 'verified').length;
    document.getElementById('invalidCount').textContent = contacts.filter(c => c.status === 'invalid').length;
    document.getElementById('pendingCount').textContent = contacts.filter(c => !['verified', 'invalid'].includes(c.status)).length;
  },
  filterContacts() { this.renderContacts(this.state.contacts); },
  toggleContact(id) { this.state.selectedContacts.has(id) ? this.state.selectedContacts.delete(id) : this.state.selectedContacts.add(id); },
  toggleSelectAll() { const chk = document.getElementById('selectAllContacts').checked; document.querySelectorAll('.contact-checkbox').forEach(cb => { cb.checked = chk; chk ? this.state.selectedContacts.add(cb.value) : this.state.selectedContacts.delete(cb.value); }); },

  async loadFolders() {
    const [campRes, allRes] = await Promise.all([this.api('/api/campaigns'), this.api('/api/contacts')]);
    const campaigns = campRes.success ? campRes.data : [], contacts = allRes.success ? allRes.data : [];
    document.getElementById('folderAll').textContent = contacts.length;
    document.getElementById('folderList').innerHTML = campaigns.map(c => {
      const cnt = contacts.filter(ct => ct.campaignId === c.id).length;
      return `<div class="folder-item${this.state.currentFolder === c.id ? ' active' : ''}" onclick="App.selectFolder(this, '${c.id}')"><span class="material-icons-outlined folder-icon" style="font-size:18px">folder_open</span><span class="folder-name">${this.esc(c.name)}</span><span class="folder-count">${cnt}</span></div>`;
    }).join('');
  },
  selectFolder(el, cid) { this.state.currentFolder = cid; document.querySelectorAll('.folder-item').forEach(f => f.classList.remove('active')); el.classList.add('active'); this.loadContacts(); },

  // ─── CLASSIFICATION ────────────────────────────────────
  async classifyAll() {
    const cid = this.state.currentFolder;
    this.toast('Classifying contacts...', 'info');
    const body = cid ? { campaignId: cid } : {};
    const res = await this.api('/api/classify', { method: 'POST', body: JSON.stringify(body) });
    if (res.success) { this.toast(`Classified ${res.total} contacts!`, 'success'); this.loadContacts(); this.loadDashboard(); }
    else this.toast(res.error || 'Failed', 'error');
  },

  // ─── CONTACT MODALS ───────────────────────────────────
  showAddContactModal() {
    this.showModal('Add Contact', `
      <div class="form-group"><label class="form-label">Email *</label><input type="email" class="form-input" id="addContactEmail" placeholder="john@company.com" autofocus/></div>
      <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-input" id="addContactName"/></div>
      <div class="form-group"><label class="form-label">Role</label><input type="text" class="form-input" id="addContactRole"/></div>
      <div class="form-group"><label class="form-label">Company</label><input type="text" class="form-input" id="addContactCompany"/></div>
      <div class="form-group"><label class="form-label">Campaign *</label><select class="form-select" id="addContactCampaign"><option value="">-- Select --</option>${this.state.campaigns.map(c => `<option value="${c.id}">${this.esc(c.name)}</option>`).join('')}</select></div>
      <button class="btn btn-primary btn-lg" style="width:100%;justify-content:center;" onclick="App.addManualContact()">Add Contact</button>
    `);
  },
  async addManualContact() {
    const email = document.getElementById('addContactEmail').value.trim();
    const campaignId = document.getElementById('addContactCampaign').value;
    if (!email) return this.toast('Email required', 'warning');
    if (!campaignId) return this.toast('Select a campaign', 'warning');
    const res = await this.api('/api/contacts', { method: 'POST', body: JSON.stringify({ email, name: document.getElementById('addContactName').value.trim(), role: document.getElementById('addContactRole').value.trim(), company: document.getElementById('addContactCompany').value.trim(), campaignId, status: 'manual' }) });
    if (res.success) { this.toast(`${email} added!`, 'success'); this.closeModal(); this.loadContacts(); this.loadFolders(); }
    else this.toast(res.error || 'Failed', 'error');
  },
  showEditContactModal(id) {
    const c = this.state.contacts.find(ct => ct.id === id); if (!c) return;
    this.showModal('Edit Contact', `
      <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="editEmail" value="${this.esc(c.email)}"/></div>
      <div class="form-group"><label class="form-label">Name</label><input type="text" class="form-input" id="editName" value="${this.esc(c.name||'')}"/></div>
      <div class="form-group"><label class="form-label">Role</label><input type="text" class="form-input" id="editRole" value="${this.esc(c.role||'')}"/></div>
      <div class="form-group"><label class="form-label">Company</label><input type="text" class="form-input" id="editCompany" value="${this.esc(c.company||'')}"/></div>
      <button class="btn btn-primary btn-lg" style="width:100%;justify-content:center;" onclick="App.saveEditContact('${id}')">Save</button>
    `);
  },
  async saveEditContact(id) {
    const res = await this.api(`/api/contacts/${id}`, { method: 'PUT', body: JSON.stringify({ email: document.getElementById('editEmail').value.trim(), name: document.getElementById('editName').value.trim(), role: document.getElementById('editRole').value.trim(), company: document.getElementById('editCompany').value.trim() }) });
    if (res.success) { this.toast('Updated!', 'success'); this.closeModal(); this.loadContacts(); }
  },
  async manualVerify(id) { await this.api(`/api/contacts/${id}/verify-manual`, { method: 'POST' }); this.toast('Verified!', 'success'); this.loadContacts(); },
  async deleteContact(id) { await this.api(`/api/contacts/${id}`, { method: 'DELETE' }); this.toast('Deleted', 'success'); this.loadContacts(); this.loadFolders(); },
  async deleteAllContacts() { const cid = this.state.currentFolder; if (!cid) return this.toast('Select a campaign folder', 'warning'); if (!confirm('Delete ALL?')) return; const res = await this.api(`/api/contacts/all/${cid}`, { method: 'DELETE' }); if (res.success) { this.toast(`Deleted ${res.removed}`, 'success'); this.loadContacts(); this.loadFolders(); this.loadDashboard(); } },

  showCsvUploadModal() {
    this.showModal('Upload CSV', `
      <div class="form-group"><label class="form-label">Campaign *</label><select class="form-select" id="csvCampaign"><option value="">-- Select --</option>${this.state.campaigns.map(c => `<option value="${c.id}">${this.esc(c.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">CSV File</label><input type="file" class="form-input" id="csvFileInput" accept=".csv"/></div>
      <button class="btn btn-primary btn-lg" style="width:100%;justify-content:center;" onclick="App.uploadCsv()">Upload</button>
    `);
  },
  async uploadCsv() {
    const campaignId = document.getElementById('csvCampaign').value;
    const fileInput = document.getElementById('csvFileInput');
    if (!campaignId) return this.toast('Select a campaign', 'warning');
    if (!fileInput.files[0]) return this.toast('Select a file', 'warning');
    const formData = new FormData(); formData.append('csvFile', fileInput.files[0]); formData.append('campaignId', campaignId);
    const res = await (await fetch('/api/contacts/upload-csv', { method: 'POST', body: formData })).json();
    if (res.success) { this.toast(`Uploaded ${res.added} contacts!`, 'success'); this.closeModal(); this.loadContacts(); this.loadFolders(); }
    else this.toast(res.error || 'Failed', 'error');
  },

  // ─── VERIFICATION ──────────────────────────────────────
  async verifyAll() {
    const cid = this.state.currentFolder;
    if (!cid) return this.toast('Select a campaign folder', 'warning');
    const pEl = document.getElementById('verificationProgress'), bar = document.getElementById('verifyProgressBar'), txt = document.getElementById('verifyProgressText');
    pEl.style.display = 'block';
    const res = await this.api('/api/verify', { method: 'POST', body: JSON.stringify({ campaignId: cid }) });
    if (res.success) {
      const total = res.total;
      const poll = setInterval(async () => {
        const s = await this.api(`/api/verify/status/${cid}`);
        if (s.success) { const st = s.data.stats, done = st.verified + st.invalid, pct = total > 0 ? (done/total)*100 : 0; bar.style.width = pct + '%'; txt.textContent = `${done}/${total} — ${st.verified} valid, ${st.invalid} invalid`;
          if (st.pending === 0) { clearInterval(poll); pEl.style.display = 'none'; this.toast(`Done! ${st.verified} valid`, 'success'); this.loadContacts(); this.loadDashboard(); } }
      }, 3000);
      setTimeout(() => { clearInterval(poll); pEl.style.display = 'none'; this.loadContacts(); }, 180000);
    }
  },
  async removeInvalid() { const cid = this.state.currentFolder; if (!cid) return this.toast('Select a folder', 'warning'); if (!confirm('Remove invalid?')) return; const res = await this.api(`/api/contacts/invalid/${cid}`, { method: 'DELETE' }); if (res.success) { this.toast(`Removed ${res.removed}`, 'success'); this.loadContacts(); this.loadFolders(); } },

  // Continued in app2.js (loaded inline below)
};

// Load part 2
const s = document.createElement('script'); s.src = '/js/app2.js'; document.head.appendChild(s);
document.addEventListener('DOMContentLoaded', () => { setTimeout(() => App.init(), 100); });
