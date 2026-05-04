/* ═══════════════════════════════════════════════════════════
   MAILFORGE — Part 3: Enterprise Features (Channels, E-Commerce, AI, Enterprise)
   ═══════════════════════════════════════════════════════════ */

Object.assign(App, {
  // ─── SCORING ENGINE ────────────────────────────────────────
  async computeAllScores() {
    this.toast('Computing scores across all contacts...', 'info');
    const res = await this.api('/api/scoring/compute', { method: 'POST', body: JSON.stringify({}) });
    if (res.success) {
      this.toast(`Computed scores for ${res.total} contacts`, 'success');
      this.loadScoring();
    } else {
      this.toast(res.error || 'Failed to compute scores', 'error');
    }
  },

  async loadScoring() {
    const res = await this.api('/api/contacts');
    if (!res.success) return;
    const contacts = res.data;
    
    const statsEl = document.getElementById('scoringStats');
    if (statsEl) {
      const avgScore = contacts.length ? Math.round(contacts.reduce((acc, c) => acc + (c.leadScore || 0), 0) / contacts.length) : 0;
      const hotLeads = contacts.filter(c => (c.leadScore || 0) >= 80).length;
      const warmLeads = contacts.filter(c => (c.leadScore || 0) >= 50 && (c.leadScore || 0) < 80).length;
      const coldLeads = contacts.filter(c => (c.leadScore || 0) < 50).length;
      
      statsEl.innerHTML = `
        <div class="stat-card"><h3>Average Score</h3><div class="stat-val">${avgScore}</div></div>
        <div class="stat-card"><h3>Hot Leads</h3><div class="stat-val" style="color:var(--danger)">${hotLeads}</div></div>
        <div class="stat-card"><h3>Warm Leads</h3><div class="stat-val" style="color:var(--warning)">${warmLeads}</div></div>
        <div class="stat-card"><h3>Cold Leads</h3><div class="stat-val" style="color:var(--text-muted)">${coldLeads}</div></div>
      `;
    }

    const tableEl = document.getElementById('scoringTable');
    if (tableEl) {
      const sorted = [...contacts].sort((a, b) => (b.leadScore || 0) - (a.leadScore || 0)).slice(0, 50);
      if (!sorted.length) {
        tableEl.innerHTML = '<div class="table-empty"><p>No scored contacts</p></div>';
      } else {
        tableEl.innerHTML = `
          <table class="data-table">
            <thead><tr><th>Contact</th><th>Company</th><th>Score</th><th>Stage</th></tr></thead>
            <tbody>
              ${sorted.map(c => `
                <tr>
                  <td><strong>${this.esc(c.email)}</strong></td>
                  <td>${this.esc(c.company || '—')}</td>
                  <td><span class="score-badge" style="--sc:${c.leadScore || 0}">${c.leadScore || 0}</span></td>
                  <td><span class="stage-chip ${c.lifecycleStage || 'lead'}">${c.lifecycleStage || 'lead'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    }
  },

  // ─── AI SEGMENTATION ───────────────────────────────────────
  async loadSegments() {
    const res = await this.api('/api/segments');
    const el = document.getElementById('segmentsList');
    if (!res.success) return;
    if (!res.data.length) {
      el.innerHTML = '<div class="empty-state"><p class="empty-title">No segments yet</p></div>';
      return;
    }
    el.innerHTML = res.data.map(s => `
      <div class="section-card">
        <div class="section-header">
          <h3>${this.esc(s.name)} ${s.isAiGenerated ? '<span class="badge badge-success">AI Generated</span>' : ''}</h3>
          <span class="badge badge-info">${s.memberCount} members</span>
        </div>
        <p>${this.esc(s.description)}</p>
        <div style="margin-top:12px">
          <button class="btn btn-sm btn-danger-outline" onclick="App.deleteSegment('${s.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  },

  async aiSuggestSegments() {
    this.toast('Aura AI is analyzing your contacts...', 'info');
    const res = await this.api('/api/segments/ai-suggest', { method: 'POST' });
    if (res.success && res.data.length > 0) {
      this.toast(`Found ${res.data.length} suggested segments`, 'success');
      // For simplicity, just auto-create the first 3
      const toCreate = res.data.slice(0, 3);
      for (const s of toCreate) {
        await this.api('/api/segments', { method: 'POST', body: JSON.stringify({ ...s, isAiGenerated: true }) });
      }
      this.loadSegments();
    } else {
      this.toast('No new segments to suggest', 'info');
    }
  },

  async deleteSegment(id) {
    if (!confirm('Delete this segment?')) return;
    const res = await this.api(`/api/segments/${id}`, { method: 'DELETE' });
    if (res.success) this.loadSegments();
  },

  showCreateSegmentModal() {
    this.showModal('Create Manual Segment', `
      <div class="form-group"><label class="form-label">Segment Name</label><input type="text" id="segName" class="form-input"></div>
      <div class="form-group"><label class="form-label">Description</label><input type="text" id="segDesc" class="form-input"></div>
      <button class="btn btn-primary" style="width:100%" onclick="App.createManualSegment()">Create Segment</button>
    `);
  },

  async createManualSegment() {
    const name = document.getElementById('segName').value.trim();
    const desc = document.getElementById('segDesc').value.trim();
    if (!name) return this.toast('Name is required', 'warning');
    const res = await this.api('/api/segments', { method: 'POST', body: JSON.stringify({ name, description: desc, isAiGenerated: false }) });
    if (res.success) {
      this.closeModal();
      this.toast('Segment created', 'success');
      this.loadSegments();
    }
  },

  // ─── AI ANALYST ────────────────────────────────────────────
  async loadAnalystSuggestions() {
    const res = await this.api('/api/ai/analyst/suggestions');
    if (res.success) {
      const el = document.getElementById('aiChatSuggestions');
      if (el) el.innerHTML = res.data.slice(0, 4).map(s => `<button class="btn btn-sm btn-secondary" onclick="document.getElementById('aiQueryInput').value='${this.esc(s)}';App.askAnalyst()">${this.esc(s)}</button>`).join('');
    }
  },

  async askAnalyst() {
    const input = document.getElementById('aiQueryInput');
    const query = input.value.trim();
    if (!query) return;
    
    input.value = '';
    const chat = document.getElementById('aiChatMessages');
    
    // Add user message
    chat.innerHTML += `<div class="ai-msg user"><div class="ai-msg-bubble"><p>${this.esc(query)}</p></div><div class="ai-msg-avatar"><span class="material-icons-outlined">person</span></div></div>`;
    chat.scrollTop = chat.scrollHeight;

    // Add loading
    const loadId = 'loading_' + Date.now();
    chat.innerHTML += `<div class="ai-msg bot" id="${loadId}"><div class="ai-msg-avatar"><span class="material-icons-outlined">auto_awesome</span></div><div class="ai-msg-bubble"><p>Thinking...</p></div></div>`;
    chat.scrollTop = chat.scrollHeight;

    const res = await this.api('/api/ai/analyst', { method: 'POST', body: JSON.stringify({ query }) });
    document.getElementById(loadId).remove();

    if (res.success) {
      const d = res.data;
      let extra = '';
      if (d.type === 'table' && d.data) {
        extra = `<table class="data-table" style="margin-top:10px">
          <thead><tr>${Object.keys(d.data[0]).map(k => `<th>${this.esc(k)}</th>`).join('')}</tr></thead>
          <tbody>${d.data.map(row => `<tr>${Object.values(row).map(v => `<td>${this.esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>`;
      }
      chat.innerHTML += `<div class="ai-msg bot"><div class="ai-msg-avatar"><span class="material-icons-outlined">auto_awesome</span></div><div class="ai-msg-bubble"><p>${d.answer}</p>${extra}</div></div>`;
    } else {
      chat.innerHTML += `<div class="ai-msg bot"><div class="ai-msg-avatar" style="background:var(--danger)"><span class="material-icons-outlined">error</span></div><div class="ai-msg-bubble"><p>Sorry, I encountered an error analyzing your data.</p></div></div>`;
    }
    chat.scrollTop = chat.scrollHeight;
  },

  // ─── CHANNELS: WHATSAPP ────────────────────────────────────
  async sendWhatsApp() {
    const to = document.getElementById('waPhone').value.trim();
    const body = document.getElementById('waBody').value.trim();
    if (!to || !body) return this.toast('Phone and body are required', 'warning');
    
    const res = await this.api('/api/channels/whatsapp/send', { method: 'POST', body: JSON.stringify({ to, body, templateName: 'custom' }) });
    if (res.success) {
      this.toast('WhatsApp message queued', 'success');
      document.getElementById('waBody').value = '';
      this.loadWhatsAppMessages();
    } else {
      this.toast(res.error || 'Failed', 'error');
    }
  },

  async loadWhatsAppMessages() {
    const res = await this.api('/api/channels/whatsapp/messages');
    const el = document.getElementById('waMessageList');
    if (!res.success) return;
    if (!res.data.length) {
      el.innerHTML = '<div class="table-empty"><p>No messages sent yet</p></div>';
      return;
    }
    el.innerHTML = res.data.slice().reverse().map(m => `
      <div class="history-item">
        <div class="hi-icon" style="background:#25D366;color:white"><span class="material-icons-outlined">chat</span></div>
        <div class="hi-content">
          <div class="hi-title">To: ${this.esc(m.to)} <span class="badge badge-${m.status}">${m.status}</span></div>
          <div class="hi-desc">${this.esc(m.body)}</div>
        </div>
        <div class="hi-time">${this.timeAgo(m.createdAt)}</div>
      </div>
    `).join('');
  },

  // ─── CHANNELS: PUSH NOTIFICATIONS ──────────────────────────
  async sendWebPush() {
    const title = document.getElementById('pushTitle').value.trim();
    const body = document.getElementById('pushBody').value.trim();
    const url = document.getElementById('pushUrl').value.trim();
    if (!title) return this.toast('Title required', 'warning');
    const res = await this.api('/api/channels/push/web', { method: 'POST', body: JSON.stringify({ title, body, url }) });
    if (res.success) { this.toast(`Web push sent to ${res.data.sent} ${res.data.sent === 1 ? 'recipient' : 'recipients'}`, 'success'); this.loadPushStats(); }
  },

  async sendMobilePush() {
    const title = document.getElementById('pushTitle').value.trim();
    const body = document.getElementById('pushBody').value.trim();
    if (!title) return this.toast('Title required', 'warning');
    const res = await this.api('/api/channels/push/mobile', { method: 'POST', body: JSON.stringify({ title, body }) });
    if (res.success) { this.toast(`Mobile push sent to ${res.data.sent} ${res.data.sent === 1 ? 'recipient' : 'recipients'}`, 'success'); this.loadPushStats(); }
  },

  async loadPushStats() {
    const res = await this.api('/api/channels/stats');
    if (!res.success) return;
    const el = document.getElementById('pushStats');
    if (el) {
      el.innerHTML = `
        <div class="stat-card"><h3>Web Push Sent</h3><div class="stat-val">${res.data.webPush.sent}</div></div>
        <div class="stat-card"><h3>Mobile Push Sent</h3><div class="stat-val">${res.data.mobilePush.sent}</div></div>
      `;
    }
  },

  // ─── CHANNELS: POPUPS ──────────────────────────────────────
  async loadPopups() {
    const res = await this.api('/api/popups');
    const el = document.getElementById('popupsList');
    if (!res.success) return;
    if (!res.data.length) {
      el.innerHTML = '<div class="empty-state"><p class="empty-title">No popups yet</p></div>';
      return;
    }
    el.innerHTML = res.data.map(p => `
      <div class="template-card">
        <div class="tpl-header"><span class="tpl-category">${p.type}</span></div>
        <h4 class="tpl-name">${this.esc(p.name)}</h4>
        <p class="tpl-subject">Trigger: ${p.trigger.type}</p>
        <div class="tpl-footer">
          <span class="tpl-uses">${p.isActive ? '<span style="color:var(--success)">Active</span>' : 'Inactive'}</span>
          <div class="tpl-actions">
            <button class="btn btn-ghost btn-sm" onclick="App.deletePopup('${p.id}')">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  showCreatePopupModal() {
    this.showModal('Create Popup', `
      <div class="form-group"><label class="form-label">Name</label><input type="text" id="popName" class="form-input"></div>
      <div class="form-group"><label class="form-label">Type</label><select id="popType" class="form-select"><option value="modal">Modal</option><option value="slide_in">Slide-In</option><option value="banner">Banner</option></select></div>
      <div class="form-group"><label class="form-label">Trigger</label><select id="popTrigger" class="form-select"><option value="time_delay">Time Delay (5s)</option><option value="exit_intent">Exit Intent</option><option value="scroll">Scroll (50%)</option></select></div>
      <button class="btn btn-primary" style="width:100%" onclick="App.createPopup()">Create</button>
    `);
  },

  async createPopup() {
    const name = document.getElementById('popName').value.trim();
    const type = document.getElementById('popType').value;
    const trigger = document.getElementById('popTrigger').value;
    if (!name) return this.toast('Name required', 'warning');
    const res = await this.api('/api/popups', { method: 'POST', body: JSON.stringify({ name, type, trigger: { type: trigger }, isActive: true }) });
    if (res.success) { this.closeModal(); this.toast('Popup created', 'success'); this.loadPopups(); }
  },

  async deletePopup(id) {
    if (!confirm('Delete?')) return;
    const res = await this.api(`/api/popups/${id}`, { method: 'DELETE' });
    if (res.success) this.loadPopups();
  },

  // ─── E-COMMERCE: PRODUCTS ──────────────────────────────────
  async loadProducts() {
    const res = await this.api('/api/products');
    const el = document.getElementById('productsList');
    if (!res.success) return;
    if (!res.data.length) {
      el.innerHTML = '<div class="empty-state"><p class="empty-title">No products yet</p></div>';
      return;
    }
    el.innerHTML = res.data.map(p => `
      <div class="template-card">
        <h4 class="tpl-name">${this.esc(p.name)}</h4>
        <p class="tpl-subject">$${p.price} · ${this.esc(p.category)}</p>
        <p class="text-muted" style="font-size:0.8rem">SKU: ${this.esc(p.sku)}</p>
        <div class="tpl-footer">
          <span class="tpl-uses">${p.inStock ? '<span style="color:var(--success)">In Stock</span>' : '<span style="color:var(--danger)">Out of Stock</span>'}</span>
          <div class="tpl-actions">
            <button class="btn btn-ghost btn-sm" onclick="App.deleteProduct('${p.id}')">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  showCreateProductModal() {
    this.showModal('Add Product', `
      <div class="form-group"><label class="form-label">Name</label><input type="text" id="prodName" class="form-input"></div>
      <div class="form-group"><label class="form-label">Price</label><input type="number" id="prodPrice" class="form-input" value="0"></div>
      <div class="form-group"><label class="form-label">Category</label><input type="text" id="prodCat" class="form-input"></div>
      <button class="btn btn-primary" style="width:100%" onclick="App.createProduct()">Add Product</button>
    `);
  },

  async createProduct() {
    const name = document.getElementById('prodName').value.trim();
    const price = parseFloat(document.getElementById('prodPrice').value) || 0;
    const category = document.getElementById('prodCat').value.trim();
    if (!name) return this.toast('Name required', 'warning');
    const res = await this.api('/api/products', { method: 'POST', body: JSON.stringify({ name, price, category, inStock: true }) });
    if (res.success) { this.closeModal(); this.toast('Product added', 'success'); this.loadProducts(); }
  },

  async deleteProduct(id) {
    if (!confirm('Delete?')) return;
    const res = await this.api(`/api/products/${id}`, { method: 'DELETE' });
    if (res.success) this.loadProducts();
  },

  // ─── E-COMMERCE: COUPONS ───────────────────────────────────
  async loadRecommendations() {
    const [contactsRes, alertsRes] = await Promise.all([
      this.api('/api/contacts'),
      this.api('/api/stock-alerts')
    ]);

    const select = document.getElementById('recContactSelect');
    if (contactsRes.success && select) {
      const contacts = contactsRes.data || [];
      select.innerHTML = contacts.length
        ? contacts.map(c => `<option value="${c.id}">${this.esc(c.email)}${c.company ? ' - ' + this.esc(c.company) : ''}</option>`).join('')
        : '<option value="">No contacts available</option>';
      if (contacts.length) this.loadRecommendationsForContact(contacts[0].id);
      else {
        const el = document.getElementById('recommendationsList');
        if (el) el.innerHTML = '<div class="empty-state"><p class="empty-title">Add contacts to generate recommendations</p></div>';
      }
    }

    const alertsEl = document.getElementById('stockAlertsList');
    if (alertsRes.success && alertsEl) {
      const alerts = alertsRes.data || [];
      alertsEl.innerHTML = alerts.length
        ? alerts.slice().reverse().map(a => `
          <div class="history-item">
            <div class="hi-icon"><span class="material-icons-outlined">inventory</span></div>
            <div class="hi-content">
              <div class="hi-title">${this.esc(a.email || a.contactId || 'Contact')}</div>
              <div class="hi-desc">Product ${this.esc(a.productId)} - ${this.esc(a.status)}</div>
            </div>
          </div>
        `).join('')
        : '<p class="text-muted">No stock alerts yet</p>';
    }
  },

  async loadRecommendationsForContact(contactId) {
    const el = document.getElementById('recommendationsList');
    if (!el || !contactId) return;
    el.innerHTML = '<div class="table-empty"><p>Generating recommendations...</p></div>';
    const res = await this.api(`/api/products/recommendations/${contactId}`);
    if (!res.success) {
      el.innerHTML = '<div class="table-empty"><p>Could not generate recommendations</p></div>';
      return;
    }
    const products = res.data || [];
    el.innerHTML = products.length
      ? products.map(p => `
        <div class="template-card">
          <div class="tpl-header"><span class="badge badge-primary">${p.recommendationScore || 0}% match</span></div>
          <h4 class="tpl-name">${this.esc(p.name)}</h4>
          <p class="tpl-subject">$${p.price || 0} - ${this.esc(p.category || 'General')}</p>
          <p class="text-muted" style="font-size:0.85rem">${this.esc(p.description || 'Recommended from catalog, contact profile, and engagement score.')}</p>
        </div>
      `).join('')
      : '<div class="empty-state"><p class="empty-title">No in-stock products to recommend</p></div>';
  },

  async loadCoupons() {
    const res = await this.api('/api/coupons');
    const el = document.getElementById('couponsList');
    if (!res.success) return;
    if (!res.data.length) {
      el.innerHTML = '<div class="empty-state"><p class="empty-title">No coupons yet</p></div>';
      return;
    }
    el.innerHTML = res.data.map(c => `
      <div class="template-card">
        <div class="tpl-header"><span class="badge badge-primary">${this.esc(c.code)}</span></div>
        <h4 class="tpl-name">${c.type === 'percentage' ? c.value + '%' : '$' + c.value} off</h4>
        <p class="tpl-subject">Used: ${c.usedCount} ${c.maxUses ? '/ ' + c.maxUses : ''}</p>
        <div class="tpl-footer">
          <span class="tpl-uses">${c.isActive ? '<span style="color:var(--success)">Active</span>' : 'Inactive'}</span>
          <div class="tpl-actions">
            <button class="btn btn-ghost btn-sm" onclick="App.deleteCoupon('${c.id}')">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  showCreateCouponModal() {
    this.showModal('Create Coupon', `
      <div class="form-group"><label class="form-label">Code</label><input type="text" id="cpnCode" class="form-input" placeholder="SUMMER20"></div>
      <div class="form-group"><label class="form-label">Type</label><select id="cpnType" class="form-select"><option value="percentage">Percentage</option><option value="fixed">Fixed Amount</option></select></div>
      <div class="form-group"><label class="form-label">Value</label><input type="number" id="cpnVal" class="form-input" value="10"></div>
      <button class="btn btn-primary" style="width:100%" onclick="App.createCoupon()">Create</button>
    `);
  },

  async createCoupon() {
    const code = document.getElementById('cpnCode').value.trim();
    const type = document.getElementById('cpnType').value;
    const value = parseFloat(document.getElementById('cpnVal').value) || 0;
    if (!code) return this.toast('Code required', 'warning');
    const res = await this.api('/api/coupons', { method: 'POST', body: JSON.stringify({ code, type, value }) });
    if (res.success) { this.closeModal(); this.toast('Coupon created', 'success'); this.loadCoupons(); }
    else this.toast(res.error, 'error');
  },

  async deleteCoupon(id) {
    if (!confirm('Delete?')) return;
    const res = await this.api(`/api/coupons/${id}`, { method: 'DELETE' });
    if (res.success) this.loadCoupons();
  },

  // ─── LOYALTY PROGRAM ───────────────────────────────────────
  async loadLoyalty() {
    const [statsRes, accountsRes, rewardsRes] = await Promise.all([
      this.api('/api/loyalty/stats'),
      this.api('/api/loyalty'),
      this.api('/api/rewards')
    ]);

    if (statsRes.success && document.getElementById('loyaltyStats')) {
      const s = statsRes.data;
      document.getElementById('loyaltyStats').innerHTML = `
        <div class="stat-card"><h3>Total Members</h3><div class="stat-val">${s.totalMembers}</div></div>
        <div class="stat-card"><h3>Active Points</h3><div class="stat-val" style="color:var(--primary)">${s.totalPointsActive}</div></div>
        <div class="stat-card"><h3>Gold Tier</h3><div class="stat-val" style="color:#FFD700">${s.tierDistribution['Gold'] || 0}</div></div>
        <div class="stat-card"><h3>Platinum Tier</h3><div class="stat-val" style="color:#E5E4E2">${s.tierDistribution['Platinum'] || 0}</div></div>
      `;
    }

    if (accountsRes.success && document.getElementById('loyaltyMembers')) {
      const mEl = document.getElementById('loyaltyMembers');
      if (!accountsRes.data.length) mEl.innerHTML = '<p class="text-muted">No loyalty members yet</p>';
      else mEl.innerHTML = `<table class="data-table"><thead><tr><th>Contact ID</th><th>Tier</th><th>Points</th></tr></thead><tbody>
        ${accountsRes.data.slice(0, 10).map(a => `<tr><td><span style="font-size:0.8rem">${a.contactId}</span></td><td><span class="badge" style="background:${a.tierColor};color:#000">${a.tier}</span></td><td>${a.points}</td></tr>`).join('')}
      </tbody></table>`;
    }

    if (rewardsRes.success && document.getElementById('rewardsList')) {
      const rEl = document.getElementById('rewardsList');
      if (!rewardsRes.data.length) rEl.innerHTML = '<p class="text-muted">No rewards configured</p>';
      else rEl.innerHTML = `<div class="template-gallery" style="grid-template-columns:1fr 1fr">
        ${rewardsRes.data.map(r => `<div class="template-card"><h4 class="tpl-name">${this.esc(r.name)}</h4><p class="tpl-subject"><span class="material-icons-outlined" style="font-size:14px;vertical-align:middle;color:var(--primary)">stars</span> ${r.pointsCost} pts</p><div class="tpl-footer"><button class="btn btn-sm btn-ghost" onclick="App.deleteReward('${r.id}')">Delete</button></div></div>`).join('')}
      </div>`;
    }
  },

  showCreateRewardModal() {
    this.showModal('Create Reward', `
      <div class="form-group"><label class="form-label">Name</label><input type="text" id="rewName" class="form-input"></div>
      <div class="form-group"><label class="form-label">Points Cost</label><input type="number" id="rewPoints" class="form-input" value="100"></div>
      <button class="btn btn-primary" style="width:100%" onclick="App.createReward()">Create</button>
    `);
  },

  async createReward() {
    const name = document.getElementById('rewName').value.trim();
    const pointsCost = parseInt(document.getElementById('rewPoints').value) || 0;
    if (!name) return this.toast('Name required', 'warning');
    const res = await this.api('/api/rewards', { method: 'POST', body: JSON.stringify({ name, pointsCost }) });
    if (res.success) { this.closeModal(); this.toast('Reward created', 'success'); this.loadLoyalty(); }
  },

  async deleteReward(id) {
    if (!confirm('Delete?')) return;
    const res = await this.api(`/api/rewards/${id}`, { method: 'DELETE' });
    if (res.success) this.loadLoyalty();
  },

  // ─── MOBILE WALLET ─────────────────────────────────────────
  async loadWallet() {
    const [statsRes, passesRes] = await Promise.all([
      this.api('/api/wallet/stats'),
      this.api('/api/wallet/passes')
    ]);

    if (statsRes.success && document.getElementById('walletStats')) {
      const s = statsRes.data;
      document.getElementById('walletStats').innerHTML = `
        <div class="stat-card"><h3>Total Passes</h3><div class="stat-val">${s.total}</div></div>
        <div class="stat-card"><h3>Active</h3><div class="stat-val" style="color:var(--success)">${s.active}</div></div>
        <div class="stat-card"><h3>Redeemed</h3><div class="stat-val" style="color:var(--primary)">${s.redeemed}</div></div>
        <div class="stat-card"><h3>Loyalty Cards</h3><div class="stat-val">${s.byType.loyalty}</div></div>
      `;
    }

    if (passesRes.success && document.getElementById('walletPasses')) {
      const pEl = document.getElementById('walletPasses');
      if (!passesRes.data.length) pEl.innerHTML = '<div class="empty-state"><p class="empty-title">No passes yet</p></div>';
      else pEl.innerHTML = passesRes.data.map(p => `
        <div class="template-card" style="background:${p.style.bgColor};color:${p.style.textColor}">
          <div class="tpl-header"><span class="badge" style="background:rgba(0,0,0,0.2);color:inherit">${p.type}</span></div>
          <h4 class="tpl-name" style="color:inherit">${this.esc(p.title)}</h4>
          <p class="tpl-subject" style="color:rgba(255,255,255,0.8)">${this.esc(p.barcode)}</p>
          <div class="tpl-footer" style="margin-top:16px;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px">
            <span class="tpl-uses" style="color:inherit">${p.isRedeemed ? 'Redeemed' : 'Active'}</span>
            <div class="tpl-actions">
              ${!p.isRedeemed ? `<button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:inherit" onclick="App.redeemPass('${p.id}')">Redeem</button>` : ''}
              <button class="btn btn-sm" style="background:transparent;border:1px solid rgba(255,255,255,0.4);color:inherit" onclick="App.deletePass('${p.id}')">Delete</button>
            </div>
          </div>
        </div>
      `).join('');
    }
  },

  showCreatePassModal() {
    this.showModal('Create Wallet Pass', `
      <div class="form-group"><label class="form-label">Type</label><select id="passType" class="form-select"><option value="loyalty">Loyalty Card</option><option value="coupon">Coupon</option><option value="ticket">Event Ticket</option></select></div>
      <div class="form-group"><label class="form-label">Title</label><input type="text" id="passTitle" class="form-input"></div>
      <div class="form-group"><label class="form-label">Contact ID (optional)</label><input type="text" id="passContact" class="form-input"></div>
      <button class="btn btn-primary" style="width:100%" onclick="App.createPass()">Create</button>
    `);
  },

  async createPass() {
    const type = document.getElementById('passType').value;
    const title = document.getElementById('passTitle').value.trim();
    const contactId = document.getElementById('passContact').value.trim() || null;
    if (!title) return this.toast('Title required', 'warning');
    const res = await this.api('/api/wallet/passes', { method: 'POST', body: JSON.stringify({ type, title, contactId }) });
    if (res.success) { this.closeModal(); this.toast('Pass created', 'success'); this.loadWallet(); }
  },

  async redeemPass(id) {
    if (!confirm('Mark as redeemed?')) return;
    const res = await this.api(`/api/wallet/passes/${id}/redeem`, { method: 'POST' });
    if (res.success) this.loadWallet();
  },

  async deletePass(id) {
    if (!confirm('Delete pass?')) return;
    const res = await this.api(`/api/wallet/passes/${id}`, { method: 'DELETE' });
    if (res.success) this.loadWallet();
  },

  // ─── ENTERPRISE: USERS & ACCOUNTS ──────────────────────────
  async loadUsers() {
    const [usersRes, seatsRes] = await Promise.all([this.api('/api/users'), this.api('/api/users/seats')]);
    
    if (seatsRes.success && document.getElementById('seatInfo')) {
      const s = seatsRes.data;
      document.getElementById('seatInfo').innerHTML = `
        <div class="stat-card"><h3>Total Seats</h3><div class="stat-val">${s.total}</div></div>
        <div class="stat-card"><h3>Used Seats</h3><div class="stat-val" style="color:var(--primary)">${s.used}</div></div>
        <div class="stat-card"><h3>Available</h3><div class="stat-val" style="color:var(--success)">${s.available}</div></div>
      `;
    }

    if (usersRes.success && document.getElementById('usersList')) {
      const uEl = document.getElementById('usersList');
      if (!usersRes.data.length) uEl.innerHTML = '<div class="table-empty"><p>No users</p></div>';
      else uEl.innerHTML = `<table class="data-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead><tbody>
        ${usersRes.data.map(u => `<tr>
          <td><strong>${this.esc(u.name)}</strong><br><span style="font-size:0.8rem;color:var(--text-muted)">${this.esc(u.email)}</span></td>
          <td><span class="badge" style="background:#f1f5f9;color:#334155">${u.role}</span></td>
          <td>${u.isActive ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>'}</td>
          <td>${u.lastLogin ? this.timeAgo(u.lastLogin) : 'Never'}</td>
          <td>${u.role !== 'owner' ? `<button class="btn btn-sm btn-ghost" onclick="App.deleteUser('${u.id}')">Remove</button>` : ''}</td>
        </tr>`).join('')}
      </tbody></table>`;
    }
  },

  showInviteUserModal() {
    this.showModal('Invite User', `
      <div class="form-group"><label class="form-label">Name</label><input type="text" id="invName" class="form-input"></div>
      <div class="form-group"><label class="form-label">Email</label><input type="email" id="invEmail" class="form-input"></div>
      <div class="form-group"><label class="form-label">Role</label><select id="invRole" class="form-select"><option value="admin">Admin</option><option value="editor" selected>Editor</option><option value="viewer">Viewer</option></select></div>
      <button class="btn btn-primary" style="width:100%" onclick="App.inviteUser()">Send Invite</button>
    `);
  },

  async inviteUser() {
    const name = document.getElementById('invName').value.trim();
    const email = document.getElementById('invEmail').value.trim();
    const role = document.getElementById('invRole').value;
    if (!name || !email) return this.toast('Name and email required', 'warning');
    const res = await this.api('/api/users', { method: 'POST', body: JSON.stringify({ name, email, role }) });
    if (res.success) { this.closeModal(); this.toast('User invited', 'success'); this.loadUsers(); }
    else this.toast(res.error, 'error');
  },

  async deleteUser(id) {
    if (!confirm('Remove user?')) return;
    const res = await this.api(`/api/users/${id}`, { method: 'DELETE' });
    if (res.success) this.loadUsers();
    else this.toast(res.error, 'error');
  },

  async loadAccounts() {
    const res = await this.api('/api/accounts');
    const el = document.getElementById('accountsList');
    if (!res.success) return;
    if (!res.data.length) { el.innerHTML = '<div class="empty-state"><p>No accounts</p></div>'; return; }
    el.innerHTML = res.data.map(a => `
      <div class="template-card" style="border-left:4px solid ${a.color}">
        <div class="tpl-header"><span class="badge ${a.isMaster ? 'badge-primary' : 'badge-secondary'}">${a.isMaster ? 'Master' : 'Sub-Account'}</span></div>
        <h4 class="tpl-name">${this.esc(a.name)}</h4>
        <p class="tpl-subject">${this.esc(a.domain || 'No domain')}</p>
        <div class="tpl-footer">
          <span class="tpl-uses">${a.stats.contacts} contacts</span>
          <div class="tpl-actions">
            ${!a.isMaster ? `<button class="btn btn-sm btn-ghost" onclick="App.deleteAccount('${a.id}')">Delete</button>` : ''}
          </div>
        </div>
      </div>
    `).join('');
  },

  showCreateAccountModal() {
    this.showModal('Create Sub-Account', `
      <div class="form-group"><label class="form-label">Account Name</label><input type="text" id="accName" class="form-input"></div>
      <div class="form-group"><label class="form-label">Domain</label><input type="text" id="accDomain" class="form-input"></div>
      <div class="form-group"><label class="form-label">Brand Color</label><input type="color" id="accColor" class="form-input" value="#3B82F6" style="height:40px;padding:4px"></div>
      <button class="btn btn-primary" style="width:100%" onclick="App.createAccount()">Create Account</button>
    `);
  },

  async createAccount() {
    const name = document.getElementById('accName').value.trim();
    const domain = document.getElementById('accDomain').value.trim();
    const color = document.getElementById('accColor').value;
    if (!name) return this.toast('Name required', 'warning');
    const res = await this.api('/api/accounts', { method: 'POST', body: JSON.stringify({ name, domain, color }) });
    if (res.success) { this.closeModal(); this.toast('Account created', 'success'); this.loadAccounts(); }
  },

  async deleteAccount(id) {
    if (!confirm('Delete account?')) return;
    const res = await this.api(`/api/accounts/${id}`, { method: 'DELETE' });
    if (res.success) this.loadAccounts();
    else this.toast(res.error, 'error');
  },

  // ─── ENTERPRISE: INTEGRATIONS & CUSTOM OBJECTS ───────────
  async loadIntegrations() {
    const res = await this.api('/api/integrations');
    const el = document.getElementById('integrationsList');
    if (!res.success) return;
    if (!res.data.length) { el.innerHTML = '<div class="empty-state"><p>No integrations</p></div>'; return; }
    el.innerHTML = res.data.map(i => `
      <div class="template-card">
        <div class="tpl-header"><span class="badge" style="background:#1E293B;color:#fff">${i.type.toUpperCase()}</span></div>
        <h4 class="tpl-name">${this.esc(i.name)}</h4>
        <p class="tpl-subject">Status: ${i.status}</p>
        <p class="text-muted" style="font-size:0.8rem">Last sync: ${i.lastSync ? this.timeAgo(i.lastSync) : 'Never'}</p>
        <div class="tpl-footer">
          <button class="btn btn-sm btn-primary" onclick="App.syncIntegration('${i.id}')">Sync Now</button>
          <div class="tpl-actions">
            <button class="btn btn-sm btn-ghost" onclick="App.deleteIntegration('${i.id}')">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  showCreateIntegrationModal() {
    this.showModal('Add Integration', `
      <div class="form-group"><label class="form-label">Name</label><input type="text" id="intName" class="form-input" placeholder="e.g. Salesforce CRM"></div>
      <div class="form-group"><label class="form-label">Type</label><select id="intType" class="form-select"><option value="api">REST API</option><option value="sftp">SFTP Sync</option><option value="webhook">Webhook</option></select></div>
      <button class="btn btn-primary" style="width:100%" onclick="App.createIntegration()">Add</button>
    `);
  },

  async createIntegration() {
    const name = document.getElementById('intName').value.trim();
    const type = document.getElementById('intType').value;
    if (!name) return this.toast('Name required', 'warning');
    const res = await this.api('/api/integrations', { method: 'POST', body: JSON.stringify({ name, type }) });
    if (res.success) { this.closeModal(); this.toast('Integration added', 'success'); this.loadIntegrations(); }
  },

  async syncIntegration(id) {
    this.toast('Syncing...', 'info');
    const res = await this.api(`/api/integrations/${id}/sync`, { method: 'POST' });
    if (res.success) { this.toast('Sync complete', 'success'); this.loadIntegrations(); }
    else this.toast(res.error, 'error');
  },

  async deleteIntegration(id) {
    if (!confirm('Delete?')) return;
    const res = await this.api(`/api/integrations/${id}`, { method: 'DELETE' });
    if (res.success) this.loadIntegrations();
  },

  async loadCustomObjects() {
    const res = await this.api('/api/custom-objects');
    const el = document.getElementById('customObjectsList');
    if (!res.success) return;
    if (!res.data.length) { el.innerHTML = '<div class="empty-state"><p>No custom objects</p></div>'; return; }
    el.innerHTML = res.data.map(o => `
      <div class="template-card">
        <h4 class="tpl-name">${this.esc(o.name)}</h4>
        <p class="tpl-subject">${o.records.length} records</p>
        <div class="tpl-footer">
          <span class="tpl-uses">Schema: ${o.fields.length} fields</span>
          <div class="tpl-actions">
            <button class="btn btn-sm btn-ghost" onclick="App.deleteCustomObject('${o.id}')">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  showCreateCustomObjectModal() {
    this.showModal('Create Custom Object', `
      <div class="form-group"><label class="form-label">Object Name</label><input type="text" id="coName" class="form-input" placeholder="e.g. Store Locations"></div>
      <button class="btn btn-primary" style="width:100%" onclick="App.createCustomObject()">Create</button>
    `);
  },

  async createCustomObject() {
    const name = document.getElementById('coName').value.trim();
    if (!name) return this.toast('Name required', 'warning');
    const res = await this.api('/api/custom-objects', { method: 'POST', body: JSON.stringify({ name, fields: ['id', 'name'] }) });
    if (res.success) { this.closeModal(); this.toast('Object created', 'success'); this.loadCustomObjects(); }
  },

  async deleteCustomObject(id) {
    if (!confirm('Delete?')) return;
    const res = await this.api(`/api/custom-objects/${id}`, { method: 'DELETE' });
    if (res.success) this.loadCustomObjects();
  },

  // ─── ENTERPRISE: SSO & DEDICATED IP ────────────────────────
  async loadSSOConfig() {
    const res = await this.api('/api/sso');
    if (res.success && res.data) {
      const d = res.data;
      if (document.getElementById('ssoProvider')) document.getElementById('ssoProvider').value = d.provider || 'custom';
      if (document.getElementById('ssoEntityId')) document.getElementById('ssoEntityId').value = d.entityId || '';
      if (document.getElementById('ssoLoginUrl')) document.getElementById('ssoLoginUrl').value = d.ssoUrl || '';
      if (document.getElementById('ssoCert')) document.getElementById('ssoCert').value = d.certificate || '';
      if (document.getElementById('ssoDomains')) document.getElementById('ssoDomains').value = (d.allowedDomains || []).join(', ');
      if (document.getElementById('ssoDefaultRole')) document.getElementById('ssoDefaultRole').value = d.defaultRole || 'viewer';
    }
  },

  async saveSSOConfig() {
    const d = {
      provider: document.getElementById('ssoProvider').value,
      entityId: document.getElementById('ssoEntityId').value,
      ssoUrl: document.getElementById('ssoLoginUrl').value,
      certificate: document.getElementById('ssoCert').value,
      allowedDomains: document.getElementById('ssoDomains').value.split(',').map(s=>s.trim()).filter(Boolean),
      defaultRole: document.getElementById('ssoDefaultRole').value,
      enabled: true
    };
    const res = await this.api('/api/sso', { method: 'POST', body: JSON.stringify(d) });
    if (res.success) this.toast('SSO Configuration saved', 'success');
  },

  async loadDedicatedIp() {
    const res = await this.api('/api/dedicated-ip');
    if (res.success && document.getElementById('dedicatedIpInfo')) {
      const d = res.data;
      document.getElementById('dedicatedIpInfo').innerHTML = `
        <div style="padding:16px;background:#f8fafc;border-radius:8px">
          <p><strong>IP Address:</strong> ${d.ip || 'Not assigned'}</p>
          <p><strong>Reputation:</strong> <span class="badge ${d.reputation==='good'?'badge-success':d.reputation==='bad'?'badge-danger':'badge-primary'}">${d.reputation}</span></p>
          <p><strong>Daily Limit:</strong> ${d.dailyLimit}</p>
        </div>
      `;
      document.getElementById('ipWarmupProgress').innerHTML = `
        <p>Warmup Progress: ${d.warmupProgress}%</p>
        <div class="hbar-bg" style="height:12px;margin-top:8px"><div class="hbar-fill" style="width:${d.warmupProgress}%;background:var(--primary)"></div></div>
        <p class="text-muted" style="margin-top:8px;font-size:0.8rem">Sending gradually increases to build reputation.</p>
      `;
    }
  }
});
