/* ═══════════════════════════════════════════════════════════
   MAILFORGE — Part 2: New Features (Analytics, Templates, CRM, A/B, AI)
   ═══════════════════════════════════════════════════════════ */

// ─── ANALYTICS ───────────────────────────────────────────
Object.assign(App, {
  async loadAnalytics() {
    const [overRes, domRes, tlRes] = await Promise.all([this.api('/api/analytics/overview'), this.api('/api/analytics/domains'), this.api('/api/analytics/timeline')]);
    
    // Default placeholders
    const el = (id, v) => { const e = document.getElementById(id); if (e) e.innerHTML = v; };
    if (overRes.success) {
      const d = overRes.data || {};
      el('bentoTotalRecipients', d.totalContacts || 0);
      el('bentoActiveEng', Math.floor((d.totalContacts || 0) * 0.15)); // Simulated active engagement
      el('bentoCtrVal', '12%');
      
      // Update Deep Dive mock data
      const tbody = document.getElementById('deepDiveTableBody');
      if (tbody) {
        tbody.innerHTML = [
           {em: 'ceo@startup.com', ac: 'Clicked Pricing', t: '2 hr ago', ctr: '15%'},
           {em: 'founder@tech.io', ac: 'Opened', t: '5 hr ago', ctr: '8%'},
           {em: 'vp@enterprise.net', ac: 'Replied', t: '1 day ago', ctr: '25%'}
        ].map(r => `<tr><td><strong>${r.em}</strong></td><td><span class="chip">${r.ac}</span></td><td><div class="hbar-bg"><div class="hbar-fill" style="width:40%;background:var(--primary)"></div></div></td><td>${r.ctr}</td></tr>`).join('');
      }

      // Draw Funnel
      const funnelArea = document.getElementById('caseFunnelArea');
      if (funnelArea) {
        // SVG Area
        funnelArea.innerHTML = `
          <svg class="cf-svg" viewBox="0 0 1000 200" preserveAspectRatio="none">
            <defs>
              <linearGradient id="funnel-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#4F46E5" stop-opacity="0.6" />
                <stop offset="100%" stop-color="#4F46E5" stop-opacity="0.1" />
              </linearGradient>
            </defs>
            <path d="M0,20 C150,20 200,80 330,80 C480,80 520,140 660,140 C800,140 850,160 1000,160 L1000,200 L0,200 Z" />
          </svg>
          <div class="cf-overlay-grid">
            <div class="cf-column">
               <div class="cf-hover-circle"></div>
               <div class="cf-data"><div class="cf-num">105</div><div class="cf-info"><span class="label">Case Created</span><span class="sub">Avg time: 2 hours</span></div></div>
            </div>
            <div class="cf-column active">
               <div class="cf-hover-circle"></div>
               <div class="cf-data"><div class="cf-num">93</div><div class="cf-info"><span class="label">Assigned</span><span class="sub">Avg time: 2 hours</span></div></div>
            </div>
            <div class="cf-column">
               <div class="cf-hover-circle"></div>
               <div class="cf-data"><div class="cf-num">62</div><div class="cf-info"><span class="label">Reviewed</span><span class="sub">Avg time: 2 hours</span></div></div>
            </div>
          </div>
          <div class="cf-floating-card">
            <div class="num">12%</div>
            <div class="desc"><span>Conversion rate</span><span class="m">for the past 7 days</span></div>
          </div>
        `;
        
        // Add interactivity
        setTimeout(() => {
           document.querySelectorAll('.cf-column').forEach(col => {
             col.addEventListener('mouseenter', () => {
                document.querySelectorAll('.cf-column').forEach(c => c.classList.remove('active'));
                col.classList.add('active');
             });
           });
        }, 100);
      }
      
      // Draw Wavy Lines Map
      const wavyLines = document.getElementById('wavyLineChartContainer');
      if (wavyLines) {
         wavyLines.innerHTML = `
         <svg viewBox="0 0 800 220" style="width:100%;height:100%;overflow:visible;">
            <!-- Grid Lines -->
            <line x1="0" y1="50" x2="800" y2="50" stroke="#f1f5f9" stroke-width="1" />
            <line x1="0" y1="100" x2="800" y2="100" stroke="#f1f5f9" stroke-width="1" />
            <line x1="0" y1="150" x2="800" y2="150" stroke="#f1f5f9" stroke-width="1" />
            
            <!-- Orange Wavy Line -->
            <path d="M 0,180 C 100,160 150,80 250,110 C 350,140 400,60 500,40 C 600,20 650,140 750,120 L 800,90" fill="none" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
            <circle cx="250" cy="110" r="5" fill="white" stroke="#F59E0B" stroke-width="2"/>
            <circle cx="500" cy="40" r="5" fill="white" stroke="#F59E0B" stroke-width="2"/>
            
            <!-- Purple Wavy Line -->
            <path d="M 0,100 C 100,60 150,180 250,140 C 350,100 400,150 500,130 C 600,110 650,40 750,60 L 800,80" fill="none" stroke="#4F46E5" stroke-width="3" stroke-linecap="round"/>
            <circle cx="250" cy="140" r="5" fill="white" stroke="#4F46E5" stroke-width="2"/>
            <circle cx="750" cy="60" r="5" fill="white" stroke="#4F46E5" stroke-width="2"/>
         </svg>`;
      }
      
      // Draw AB test bars
      const abTest = document.getElementById('abTestBars');
      if (abTest) {
        abTest.innerHTML = `
          <div class="bar-row"><span>V1</span><div class="bar-bg"><div style="width:70%;background:var(--primary)"></div></div></div>
          <div class="bar-row"><span>V2</span><div class="bar-bg"><div style="width:40%;background:var(--accent)"></div></div></div>
        `;
      }
      
      // Vertical Bars
      const vb = document.getElementById('verticalGroupedBars');
      if (vb) {
         vb.innerHTML = [70,40,90,50,60,30,80].map(h => `<div style="flex:1;display:flex;gap:2px;align-items:flex-end;">
            <div style="flex:1;height:${h}%;background:var(--primary);border-radius:3px;"></div>
            <div style="flex:1;height:${h*0.4}%;background:var(--accent);border-radius:3px;"></div>
         </div>`).join('');
      }
    }
  },
  filterByDomain(domain) { window.location.hash = '#contacts'; setTimeout(() => { document.getElementById('contactSearch').value = domain; this.filterContacts(); }, 200); },

  // ─── TEMPLATE GALLERY ─────────────────────────────────
  async loadTemplateGallery() {
    let url = '/api/templates';
    if (this.state.currentTemplateFilter) url += `?category=${this.state.currentTemplateFilter}`;
    const res = await this.api(url);
    const gallery = document.getElementById('templateGallery');
    if (!res.success || !res.data.length) { gallery.innerHTML = '<div class="empty-state"><p class="empty-title">No templates found</p></div>'; return; }
    gallery.innerHTML = res.data.map(t => `
      <div class="template-card">
        <div class="tpl-header"><span class="tpl-category">${t.category || 'custom'}</span>${t.isDefault ? '<span class="tpl-default">Built-in</span>' : ''}</div>
        <h4 class="tpl-name">${this.esc(t.name)}</h4>
        <p class="tpl-subject">${this.esc(t.subject || 'No subject')}</p>
        <div class="tpl-preview">${(t.body || '').replace(/<[^>]*>/g, '').substring(0, 120)}...</div>
        <div class="tpl-footer">
          <span class="tpl-uses">${t.useCount || 0} uses</span>
          <div class="tpl-actions">
            <button class="btn btn-primary btn-sm" onclick="App.useTemplate('${t.id}')">Use</button>
            <button class="btn btn-ghost btn-sm" onclick="App.duplicateTemplate('${t.id}')">Duplicate</button>
            ${!t.isDefault ? `<button class="btn btn-ghost btn-sm" onclick="App.deleteTemplateFromGallery('${t.id}')">Delete</button>` : ''}
          </div>
        </div>
      </div>`).join('');
  },
  filterTemplates(el, category) {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active')); el.classList.add('active');
    this.state.currentTemplateFilter = category; this.loadTemplateGallery();
  },
  async useTemplate(id) { window.location.hash = '#composer'; setTimeout(() => { document.getElementById('templateSelect').value = id; this.loadTemplate(); }, 200); },
  async duplicateTemplate(id) { const res = await this.api(`/api/templates/${id}/duplicate`, { method: 'POST' }); if (res.success) { this.toast('Duplicated!', 'success'); this.loadTemplateGallery(); } },
  async deleteTemplateFromGallery(id) { if (!confirm('Delete?')) return; await this.api(`/api/templates/${id}`, { method: 'DELETE' }); this.toast('Deleted', 'success'); this.loadTemplateGallery(); },

  // ─── CRM PIPELINE ─────────────────────────────────────
  async loadPipeline() {
    const res = await this.api('/api/crm/pipeline');
    const board = document.getElementById('pipelineBoard');
    if (!res.success) return;
    const stages = ['lead','prospect','qualified','opportunity','customer','retained','churned'];
    const labels = { lead:'Lead', prospect:'Prospect', qualified:'Qualified', opportunity:'Opportunity', customer:'Customer', retained:'Retained', churned:'Churned' };
    const colors = { lead:'#94A3B8', prospect:'#3B82F6', qualified:'#8B5CF6', opportunity:'#F59E0B', customer:'#10B981', retained:'#059669', churned:'#EF4444' };
    board.innerHTML = stages.map(s => {
      const d = res.data[s] || { contacts: [], count: 0, totalValue: 0 };
      return `<div class="pipeline-col" data-stage="${s}">
        <div class="pipeline-header" style="--sc:${colors[s]}"><span class="pipeline-label">${labels[s]}</span><span class="pipeline-count">${d.count}</span></div>
        <div class="pipeline-cards" ondragover="event.preventDefault()" ondrop="App.dropOnStage(event,'${s}')">
          ${d.contacts.map(c => `<div class="pipeline-card" draggable="true" ondragstart="App.dragContact(event,'${c.id}')" onclick="App.openContactDrawer('${c.id}')">
            <div class="pc-name">${this.esc(c.name || c.email)}</div>
            <div class="pc-company">${this.esc(c.company || '')}</div>
            <div class="pc-meta"><span class="score-badge" style="--sc:${c.leadScore}">${c.leadScore}</span>${c.dealValue ? `<span class="pc-deal">$${c.dealValue}</span>` : ''}</div>
          </div>`).join('')}
        </div>
      </div>`;
    }).join('');
  },
  dragContact(e, id) { e.dataTransfer.setData('text/plain', id); },
  async dropOnStage(e, stage) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    await this.api(`/api/contacts/${id}/stage`, { method: 'PUT', body: JSON.stringify({ stage }) });
    this.toast(`Moved to ${stage}`, 'success'); this.loadPipeline();
  },
  async scoreAllLeads() {
    this.toast('Scoring...', 'info');
    const res = await this.api('/api/crm/score', { method: 'POST', body: JSON.stringify({}) });
    if (res.success) { this.toast(res.message, 'success'); this.loadPipeline(); }
  },
  async openContactDrawer(id) {
    const c = this.state.contacts.find(ct => ct.id === id) || (await this.api(`/api/contacts?`)).data?.find(ct => ct.id === id);
    if (!c) { const r = await this.api('/api/contacts'); if (r.success) { const found = r.data.find(ct => ct.id === id); if (found) return this._renderDrawer(found); } return; }
    this._renderDrawer(c);
  },
  async _renderDrawer(c) {
    const drawer = document.getElementById('contactDrawer');
    document.getElementById('drawerTitle').textContent = c.name || c.email;
    const notesRes = await this.api(`/api/crm/notes/${c.id}`);
    const notes = notesRes.success ? notesRes.data : [];
    document.getElementById('drawerBody').innerHTML = `
      <div class="drawer-section"><h4>Contact Info</h4><p><span class="material-icons-outlined" style="font-size:16px;vertical-align:middle">email</span> ${this.esc(c.email)}</p><p><span class="material-icons-outlined" style="font-size:16px;vertical-align:middle">business</span> ${this.esc(c.company || '—')} · ${this.esc(c.role || '—')}</p>
      <p>Score: <strong>${c.leadScore || 0}</strong> · Stage: <span class="stage-chip ${c.lifecycleStage||'lead'}">${c.lifecycleStage||'lead'}</span></p></div>
      <div class="drawer-section"><h4>Change Stage</h4><select class="form-select" onchange="App.changeStage('${c.id}', this.value)">
        ${['lead','prospect','qualified','opportunity','customer','retained','churned'].map(s => `<option value="${s}" ${s === (c.lifecycleStage||'lead') ? 'selected' : ''}>${s}</option>`).join('')}
      </select></div>
      <div class="drawer-section"><h4>Deal Value ($)</h4><div class="template-row"><input type="number" class="form-input" id="dealVal" value="${c.dealValue || 0}"/><button class="btn btn-sm btn-primary" onclick="App.setDealValue('${c.id}')">Set</button></div></div>
      <div class="drawer-section"><h4>Notes</h4>
        <div class="template-row"><input type="text" class="form-input" id="noteInput" placeholder="Add a note..."/><button class="btn btn-sm btn-primary" onclick="App.addNote('${c.id}')">Add</button></div>
        <div class="notes-list">${notes.map(n => `<div class="note-item"><p>${this.esc(n.content)}</p><span class="note-time">${this.timeAgo(n.createdAt)}</span></div>`).join('') || '<p class="text-muted">No notes yet</p>'}</div>
      </div>
      <div class="drawer-section"><h4><span class="material-icons-outlined" style="font-size:16px;vertical-align:middle">fingerprint</span> Digital Twin</h4><button class="btn btn-sm btn-secondary" onclick="App.viewTwinFromDrawer('${c.id}')">View Digital Twin →</button></div>`;
    drawer.style.display = 'block';
  },
  closeDrawer() { document.getElementById('contactDrawer').style.display = 'none'; },
  async changeStage(id, stage) { await this.api(`/api/contacts/${id}/stage`, { method: 'PUT', body: JSON.stringify({ stage }) }); this.toast('Stage updated', 'success'); },
  async setDealValue(id) { const v = parseInt(document.getElementById('dealVal').value) || 0; await this.api(`/api/contacts/${id}`, { method: 'PUT', body: JSON.stringify({ dealValue: v }) }); this.toast('Deal value set', 'success'); },
  async addNote(id) { const content = document.getElementById('noteInput').value.trim(); if (!content) return; await this.api('/api/crm/notes', { method: 'POST', body: JSON.stringify({ contactId: id, content }) }); this.openContactDrawer(id); },
  viewTwinFromDrawer(id) { window.location.hash = '#intelligence'; setTimeout(() => { const sel = document.getElementById('twinContactSelect'); if (sel) { sel.value = id; this.loadDigitalTwin(); } }, 300); },

  // ─── A/B TESTING ───────────────────────────────────────
  async loadABTests() {
    const res = await this.api('/api/ab-tests');
    const list = document.getElementById('abTestList');
    if (!res.success || !res.data.length) { list.innerHTML = '<div class="empty-state"><p class="empty-title">No A/B tests yet</p><p class="empty-text">Create your first experiment</p></div>'; return; }
    list.innerHTML = await Promise.all(res.data.map(async t => {
      const detRes = await this.api(`/api/ab-test/${t.id}`);
      const det = detRes.success ? detRes.data : t;
      const metrics = det.variantMetrics || [];
      return `<div class="section-card ab-test-card">
        <div class="section-header"><h3>${this.esc(t.name)}</h3><span class="badge badge-${t.status}">${t.status}</span></div>
        <div class="ab-variants">${metrics.map(v => `
          <div class="ab-variant ${det.suggestedWinner?.winnerId === v.id ? 'winner' : ''}">
            <h4>${this.esc(v.name)}</h4><p class="ab-subject">${this.esc(v.subject)}</p>
            <div class="ab-metrics">
              <div class="ab-metric"><span class="ab-val">${v.openRate}%</span><span class="ab-lbl">Open Rate</span></div>
              <div class="ab-metric"><span class="ab-val">${v.ctr}%</span><span class="ab-lbl">CTR</span></div>
              <div class="ab-metric"><span class="ab-val">${v.sent}</span><span class="ab-lbl">Sent</span></div>
            </div>
          </div>`).join('')}</div>
        ${det.suggestedWinner ? `<div class="ab-winner">🏆 Winner: <strong>${this.esc(det.suggestedWinner.winnerName)}</strong> (${det.suggestedWinner.significance.confidence}% confidence)</div>` : ''}
        <div class="btn-group"><button class="btn btn-danger-outline btn-sm" onclick="App.deleteABTest('${t.id}')">Delete</button></div>
      </div>`;
    })).then(r => r.join(''));
  },
  showCreateABTestModal() {
    this.showModal('Create A/B Test', `
      <div class="form-group"><label class="form-label">Test Name</label><input type="text" class="form-input" id="abTestName" placeholder="Subject Line Test"/></div>
      <div class="form-group"><label class="form-label">Campaign</label><select class="form-select" id="abTestCampaign"><option value="">-- Select --</option>${this.state.campaigns.map(c => `<option value="${c.id}">${this.esc(c.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Variant A — Subject</label><input type="text" class="form-input" id="abSubjectA" placeholder="Subject A"/></div>
      <div class="form-group"><label class="form-label">Variant B — Subject</label><input type="text" class="form-input" id="abSubjectB" placeholder="Subject B"/></div>
      <button class="btn btn-primary btn-lg" style="width:100%;justify-content:center;" onclick="App.createABTest()">Create Test</button>
    `);
  },
  async createABTest() {
    const name = document.getElementById('abTestName').value.trim();
    const campaignId = document.getElementById('abTestCampaign').value;
    if (!campaignId) return this.toast('Select a campaign', 'warning');
    const variants = [
      { name: 'Variant A', subject: document.getElementById('abSubjectA').value, body: '' },
      { name: 'Variant B', subject: document.getElementById('abSubjectB').value, body: '' }
    ];
    const res = await this.api('/api/ab-test', { method: 'POST', body: JSON.stringify({ campaignId, name, variants }) });
    if (res.success) { this.toast('A/B test created!', 'success'); this.closeModal(); this.loadABTests(); }
    else this.toast(res.error || 'Failed', 'error');
  },
  async deleteABTest(id) { if (!confirm('Delete?')) return; await this.api(`/api/ab-test/${id}`, { method: 'DELETE' }); this.loadABTests(); },

  // ─── INTELLIGENCE ──────────────────────────────────────
  async loadIntelligence() {
    // Populate contact select
    const res = await this.api('/api/contacts');
    const sel = document.getElementById('twinContactSelect');
    if (res.success && sel) { sel.innerHTML = '<option value="">-- Select a contact --</option>' + res.data.slice(0, 100).map(c => `<option value="${c.id}">${this.esc(c.email)} (${this.esc(c.company||'')})</option>`).join(''); }
    // Leaderboard
    const lbRes = await this.api('/api/crm/leaderboard');
    const lb = document.getElementById('intentLeaderboard');
    if (lbRes.success && lb) {
      lb.innerHTML = lbRes.data.slice(0, 10).map((c, i) => `
        <div class="lb-row"><span class="lb-rank">#${i+1}</span><div class="lb-info"><strong>${this.esc(c.name || c.email)}</strong><span>${this.esc(c.company||'')}</span></div><span class="score-badge" style="--sc:${c.leadScore}">${c.leadScore}</span><span class="stage-chip ${c.lifecycleStage}">${c.lifecycleStage}</span></div>
      `).join('') || '<p class="text-muted">Score contacts first</p>';
    }
    // Send time grid
    const stg = document.getElementById('sendTimeGrid');
    if (stg) {
      const hours = ['6am','7am','8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm','8pm'];
      stg.innerHTML = `<div class="st-header">Best send windows based on engagement:</div><div class="time-slots">${hours.map(h => `<div class="time-slot ${['9am','10am','11am','2pm','3pm'].includes(h) ? 'hot' : ''}">${h}</div>`).join('')}</div><p class="form-hint" style="margin-top:8px;"><span class="material-icons-outlined" style="font-size:14px;vertical-align:middle;color:var(--danger)">local_fire_department</span> Hot slots highlighted based on typical B2B open patterns</p>`;
    }
  },
  async loadDigitalTwin() {
    const id = document.getElementById('twinContactSelect').value;
    const view = document.getElementById('digitalTwinView');
    if (!id) { view.innerHTML = '<div class="twin-empty"><p>Select a contact</p></div>'; return; }
    const res = await this.api(`/api/digital-twin/${id}`);
    if (!res.success) return;
    const t = res.data;
    view.innerHTML = `
      <div class="twin-grid">
        <div class="twin-card"><h4><span class="material-icons-outlined" style="font-size:16px;vertical-align:middle">person</span> Profile</h4><p><strong>${this.esc(t.name||t.email)}</strong></p><p>${this.esc(t.company||'')}</p><p>Intent: <strong>${t.intentScore}</strong> · Lead: <strong>${t.leadScore||0}</strong></p></div>
        <div class="twin-card"><h4><span class="material-icons-outlined" style="font-size:16px;vertical-align:middle">schedule</span> Best Time</h4><p>Hour: <strong>${t.preferredHourLabel}</strong></p><p>Day: <strong>${t.preferredDay}</strong></p><p>UTC: <strong>${t.optimalSendTime}</strong></p><p>TZ offset: <strong>${t.estimatedTimezone >= 0 ? '+' : ''}${t.estimatedTimezone}h</strong></p></div>
        <div class="twin-card"><h4><span class="material-icons-outlined" style="font-size:16px;vertical-align:middle">insights</span> Behavior</h4><p>Interactions: <strong>${t.totalInteractions}</strong></p><p>Velocity: <strong>${t.engagementVelocity}</strong></p><p>Preferences: <strong>${t.contentPreferences.join(', ')}</strong></p></div>
        <div class="twin-card"><h4><span class="material-icons-outlined" style="font-size:16px;vertical-align:middle">cell_tower</span> Channels</h4>${t.recommendedChannels.map(ch => `<span class="channel-chip">${ch}</span>`).join('')}<p style="margin-top:8px">Tone: <strong>${t.recommendedTone}</strong></p></div>
        <div class="twin-card wide"><h4><span class="material-icons-outlined" style="font-size:16px;vertical-align:middle">auto_graph</span> Prediction</h4><p>${this.esc(t.predictedNextAction)}</p></div>
      </div>`;
  },

  // ─── AI COPYWRITER ─────────────────────────────────────
  async aiCopywrite() {
    const stage = document.getElementById('aiCopyStage').value;
    const tone = document.getElementById('aiCopyTone').value;
    const res = await this.api('/api/ai/copywrite', { method: 'POST', body: JSON.stringify({ stage, tone }) });
    const el = document.getElementById('aiCopyResult');
    if (res.success) {
      el.style.display = 'block';
      el.innerHTML = `<div class="ai-body">${this.esc(res.data.body).replace(/\n/g, '<br>')}</div>
        <div class="ai-subjects"><strong>Subject lines:</strong><ul>${res.data.subjectLines.map(s => `<li onclick="document.getElementById('emailSubject').value='${this.esc(s)}'" style="cursor:pointer">${this.esc(s)}</li>`).join('')}</ul></div>
        <div class="ai-ctas"><strong>CTAs:</strong> ${res.data.ctas.join(' · ')}</div>
        <button class="btn btn-sm btn-primary" onclick="App.useAICopy()">Use This Copy</button>`;
      this._aiCopyBody = res.data.body;
    }
  },
  useAICopy() {
    if (!this._aiCopyBody) return;
    this.state.blocks = [{ id: 'block_' + (++this.state.blockIdCounter), type: 'text', content: this._aiCopyBody.replace(/\n/g, '<br>') }];
    this.renderBlocks(); this.toast('Copy applied!', 'success');
  },
  async generateSubjectLines() {
    const res = await this.api('/api/ai/subject-lines');
    const el = document.getElementById('subjectSuggestions');
    if (res.success) {
      el.style.display = 'block';
      el.innerHTML = res.data.map(s => `<div class="suggestion-chip" onclick="document.getElementById('emailSubject').value='${this.esc(s)}';this.parentElement.style.display='none'">${this.esc(s)}</div>`).join('');
    }
  },
  async generateEmailFromPrompt() {
    const promptText = document.getElementById('aiEmailPrompt').value.trim();
    if (!promptText) return this.toast('Enter a prompt', 'warning');
    this.toast('Generating email from prompt...', 'info');
    const res = await this.api('/api/ai/copywrite', { method: 'POST', body: JSON.stringify({ tone: promptText, stage: 'lead' }) });
    if (res.success) {
      this.state.blocks = [{ id: 'block_' + (++this.state.blockIdCounter), type: 'text', content: res.data.body.replace(/\n/g, '<br>') }];
      this.renderBlocks();
      this.toast('Email generated!', 'success');
    } else {
      this.toast('Failed to generate', 'error');
    }
  },

  // ─── COMPOSER (preserved from v2) ─────────────────────
  dragBlockStart(e, type) { this.state.draggedBlockType = type; e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', type); },
  dragBlockOver(e) { e.preventDefault(); document.getElementById('builderCanvas').classList.add('dragover'); },
  dragBlockLeave() { document.getElementById('builderCanvas').classList.remove('dragover'); },
  dropBlock(e) { e.preventDefault(); document.getElementById('builderCanvas').classList.remove('dragover'); const type = this.state.draggedBlockType || e.dataTransfer.getData('text/plain'); if (type && !type.startsWith('ct_')) this.addBlock(type); this.state.draggedBlockType = null; },
  addBlock(type) {
    const id = 'block_' + (++this.state.blockIdCounter);
    let block = { id, type };
    switch (type) {
      case 'heading': block.content = 'Your Heading'; block.level = 'h2'; break;
      case 'text': block.content = 'Write your content here. Use {{name}} and {{company}}.'; break;
      case 'image': block.src = ''; block.alt = 'Image'; break;
      case 'button': block.text = 'Click Here'; block.url = 'https://'; block.color = '#4F46E5'; break;
      case 'link': block.text = 'Click here'; block.url = 'https://'; break;
      case 'svg': block.code = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'; break;
      case 'html': block.code = '<div style="padding:10px;background:#f1f5f9;border-radius:8px;">Custom HTML</div>'; break;
      case 'divider': break;
      case 'spacer': block.height = 20; break;
    }
    this.state.blocks.push(block); this.renderBlocks();
  },
  removeBlock(id) { this.state.blocks = this.state.blocks.filter(b => b.id !== id); this.renderBlocks(); },
  moveBlock(id, dir) { const idx = this.state.blocks.findIndex(b => b.id === id); const ni = idx + dir; if (ni < 0 || ni >= this.state.blocks.length) return; [this.state.blocks[idx], this.state.blocks[ni]] = [this.state.blocks[ni], this.state.blocks[idx]]; this.renderBlocks(); },
  renderBlocks() {
    const canvas = document.getElementById('builderCanvas');
    const empty = document.getElementById('canvasEmpty');
    const toolbar = document.getElementById('richTextToolbar');
    if (!this.state.blocks.length) { canvas.innerHTML = ''; if (toolbar) canvas.appendChild(toolbar); canvas.appendChild(empty); empty.style.display = ''; return; }
    if (empty) empty.style.display = 'none';
    let html = toolbar ? toolbar.outerHTML : '';
    html += this.state.blocks.map(b => {
      let content = '';
      switch (b.type) {
        case 'heading': content = `<${b.level||'h2'} contenteditable="true" class="block-editable" oninput="App.updateBlockContent('${b.id}','content',this.innerHTML)">${b.content}</${b.level||'h2'}>`; break;
        case 'text': content = `<div contenteditable="true" class="block-editable block-text" oninput="App.updateBlockContent('${b.id}','content',this.innerHTML)">${b.content}</div>`; break;
        case 'image': content = b.src ? `<div class="block-image-preview"><img src="${b.src}" alt="${b.alt||'Image'}" style="max-width:100%;border-radius:8px;"/><button class="remove-img-btn" onclick="App.removeBlockImage('${b.id}')"><span class="material-icons-outlined" style="font-size:14px">close</span></button></div>` : `<div class="block-image-placeholder" id="imgPlaceholder_${b.id}" ondragover="event.preventDefault();this.classList.add('drag-hover')" ondragleave="this.classList.remove('drag-hover')" ondrop="App.handleBlockImageDrop(event,'${b.id}')" onclick="App.pickBlockImage('${b.id}')"><span class="material-icons-outlined" style="font-size:36px">add_photo_alternate</span><p style="margin:8px 0 0;font-weight:600">Drop image, paste, or click to upload</p><p class="img-upload-hint">Supports JPG, PNG, GIF, WebP</p><input type="file" id="imgInput_${b.id}" accept="image/*" style="display:none" onchange="App.handleBlockImageFile(event,'${b.id}')"/></div>`; break;
        case 'button': content = `<div style="text-align:center;padding:8px 0;"><a href="${b.url}" style="display:inline-block;padding:12px 32px;background:${b.color};color:white;border-radius:8px;text-decoration:none;font-weight:600;" contenteditable="true" oninput="App.updateBlockContent('${b.id}','text',this.innerText)">${this.esc(b.text)}</a><br><input type="text" class="form-input" style="margin-top:8px;font-size:0.78rem;" value="${this.esc(b.url)}" onchange="App.updateBlockContent('${b.id}','url',this.value)"/></div>`; break;
        case 'link': content = `<div><a href="${b.url}" contenteditable="true" style="color:#4F46E5;text-decoration:underline;" oninput="App.updateBlockContent('${b.id}','text',this.innerText)">${this.esc(b.text)}</a><input type="text" class="form-input" style="margin-top:6px;font-size:0.78rem;" value="${this.esc(b.url)}" onchange="App.updateBlockContent('${b.id}','url',this.value)"/></div>`; break;
        case 'svg': content = `<div class="svg-preview">${b.code}</div><textarea class="form-textarea block-code-editor" rows="3" oninput="App.updateBlockContent('${b.id}','code',this.value)">${this.esc(b.code)}</textarea>`; break;
        case 'html': content = `<div class="html-preview">${b.code}</div><textarea class="form-textarea block-code-editor" rows="4" oninput="App.updateBlockContent('${b.id}','code',this.value)">${this.esc(b.code)}</textarea>`; break;
        case 'divider': content = '<hr style="border:none;border-top:2px solid #E2E8F0;margin:8px 0;"/>'; break;
        case 'spacer': content = `<div style="height:${b.height||20}px;background:repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(0,0,0,0.03) 5px,rgba(0,0,0,0.03) 10px);border-radius:4px;"></div>`; break;
      }
      return `<div class="email-block" data-block-id="${b.id}"><div class="block-controls"><span class="block-type-label">${b.type}</span><div class="block-actions"><button class="block-btn" onclick="App.moveBlock('${b.id}',-1)">↑</button><button class="block-btn" onclick="App.moveBlock('${b.id}',1)">↓</button><button class="block-btn delete" onclick="App.removeBlock('${b.id}')">✕</button></div></div><div class="block-content">${content}</div></div>`;
    }).join('');
    canvas.innerHTML = html; this.compileBlocksToHtml();
  },
  updateBlockContent(id, field, value) { const b = this.state.blocks.find(b => b.id === id); if (b) { b[field] = value; this.compileBlocksToHtml(); } },
  pickBlockImage(id) { document.getElementById('imgInput_' + id)?.click(); },
  removeBlockImage(id) { const b = this.state.blocks.find(b => b.id === id); if (b) { b.src = ''; this.renderBlocks(); } },
  async handleBlockImageFile(e, id) {
    const file = e.target.files?.[0]; if (!file) return;
    await this._uploadBlockImage(file, id);
  },
  async handleBlockImageDrop(e, id) {
    e.preventDefault();
    const placeholder = document.getElementById('imgPlaceholder_' + id);
    if (placeholder) placeholder.classList.remove('drag-hover');
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await this._uploadBlockImage(file, id);
    } else {
      // Try URL from dataTransfer
      const url = e.dataTransfer.getData('text/plain');
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        const b = this.state.blocks.find(b => b.id === id); if (b) { b.src = url; this.renderBlocks(); }
      }
    }
  },
  async _uploadBlockImage(file, id) {
    this.toast('Uploading image...', 'info');
    const formData = new FormData(); formData.append('image', file);
    try {
      const res = await (await fetch('/api/upload', { method: 'POST', body: formData })).json();
      if (res.success && res.url) {
        const b = this.state.blocks.find(b => b.id === id);
        if (b) { b.src = res.url; this.renderBlocks(); this.toast('Image uploaded!', 'success'); }
      } else {
        // Fallback to data URL if upload fails
        const reader = new FileReader();
        reader.onload = (ev) => { const b = this.state.blocks.find(b => b.id === id); if (b) { b.src = ev.target.result; this.renderBlocks(); } };
        reader.readAsDataURL(file);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = (ev) => { const b = this.state.blocks.find(b => b.id === id); if (b) { b.src = ev.target.result; this.renderBlocks(); } };
      reader.readAsDataURL(file);
    }
  },
  _initComposerPasteHandler() {
    const canvas = document.getElementById('builderCanvas');
    if (canvas && !canvas._pasteHandlerBound) {
      canvas._pasteHandlerBound = true;
      document.addEventListener('paste', (e) => {
        if (this.state.currentPage !== 'composer') return;
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            // Find first empty image block, or create one
            let imgBlock = this.state.blocks.find(b => b.type === 'image' && !b.src);
            if (!imgBlock) { this.addBlock('image'); imgBlock = this.state.blocks[this.state.blocks.length - 1]; }
            this._uploadBlockImage(file, imgBlock.id);
            break;
          }
        }
      });
    }
  },
  insertVariableAtCursor(v) { const f = document.querySelector('.block-editable:focus'); if (f) document.execCommand('insertText', false, `{{${v}}}`); else this.toast('Click a text block first', 'info'); },
  insertLink() { const url = prompt('Enter URL:'); if (url) document.execCommand('createLink', false, url); },
  compileBlocksToHtml() {
    const html = this.state.blocks.map(b => {
      switch (b.type) {
        case 'heading': return `<${b.level||'h2'} style="margin:0 0 12px;color:#0F172A;">${b.content}</${b.level||'h2'}>`;
        case 'text': return `<div style="margin:0 0 16px;line-height:1.7;color:#334155;">${b.content}</div>`;
        case 'image': return b.src ? `<img src="${b.src}" style="max-width:100%;border-radius:8px;margin:12px 0;"/>` : '';
        case 'button': return `<div style="text-align:center;margin:16px 0;"><a href="${b.url}" style="display:inline-block;padding:14px 36px;background:${b.color};color:white;border-radius:8px;text-decoration:none;font-weight:600;">${b.text}</a></div>`;
        case 'link': return `<div style="margin:8px 0;"><a href="${b.url}" style="color:#4F46E5;">${b.text}</a></div>`;
        case 'svg': return b.code || '';
        case 'html': return b.code || '';
        case 'divider': return '<hr style="border:none;border-top:2px solid #E2E8F0;margin:16px 0;"/>';
        case 'spacer': return `<div style="height:${b.height||20}px;"></div>`;
        default: return '';
      }
    }).join('');
    document.getElementById('emailBody').value = html;
  },
  async loadComposerRecipients() {
    this._initComposerPasteHandler();
    const cid = document.getElementById('composerCampaignSelect').value, box = document.getElementById('recipientsBox');
    if (!cid) { box.innerHTML = '<span class="recipients-placeholder">Select a campaign</span>'; return; }
    const res = await this.api(`/api/contacts?campaignId=${cid}&status=verified`);
    if (res.success && res.data.length) box.innerHTML = res.data.map(c => `<span class="recipient-chip">${this.esc(c.email)}</span>`).join('');
    else box.innerHTML = '<span class="recipients-placeholder">No verified contacts</span>';
  },
  previewEmail() {
    const subject = document.getElementById('emailSubject').value || 'No Subject', body = document.getElementById('emailBody').value;
    document.getElementById('emailPreview').innerHTML = `<div class="preview-subject">${this.esc(subject.replace(/\{\{name\}\}/gi,'John').replace(/\{\{company\}\}/gi,'Acme Corp'))}</div><div class="preview-body">${body.replace(/\{\{name\}\}/gi,'<strong>John</strong>').replace(/\{\{company\}\}/gi,'<strong>Acme Corp</strong>')}</div>`;
  },
  async sendTestEmail() {
    const testEmail = document.getElementById('testEmailInput').value.trim();
    const subject = document.getElementById('emailSubject').value;
    const body = document.getElementById('emailBody').value;
    if (!testEmail || !subject || !body.trim()) return this.toast('Fill in all fields', 'warning');
    this.toast(`Sending test to ${testEmail}...`, 'info');
    const formData = new FormData(); formData.append('testEmail', testEmail); formData.append('subject', subject); formData.append('body', body);
    const res = await (await fetch('/api/send/test', { method: 'POST', body: formData })).json();
    if (res.success) this.toast(res.message, 'success'); else this.toast(res.error || 'Failed', 'error');
  },
  async sendCampaign() {
    const cid = document.getElementById('composerCampaignSelect').value, subject = document.getElementById('emailSubject').value, body = document.getElementById('emailBody').value;
    if (!cid || !subject || !body.trim()) return this.toast('Fill in all fields', 'warning');
    if (!confirm('Send to all verified contacts?')) return;
    const formData = new FormData(); formData.append('campaignId', cid); formData.append('subject', subject); formData.append('body', body);
    document.getElementById('sendingSection').style.display = 'block';
    const res = await (await fetch('/api/send', { method: 'POST', body: formData })).json();
    if (res.success && res.total > 0) {
      this.toast(`Sending to ${res.total}...`, 'info');
      const poll = setInterval(async () => {
        const s = await this.api(`/api/send/status/${cid}`);
        if (s.success) { const st = s.data.stats, pct = st.total > 0 ? ((st.sent+st.failed)/st.total)*100 : 0;
          document.getElementById('sendProgressBar').style.width = pct + '%'; document.getElementById('sentSuccessCount').textContent = st.sent;
          document.getElementById('sentFailedCount').textContent = st.failed; document.getElementById('sentRemainingCount').textContent = st.pending;
          if (st.pending === 0) { clearInterval(poll); this.toast(`Done! ${st.sent} sent`, 'success'); this.loadDashboard(); } }
      }, 4000);
    } else this.toast(res.message || res.error || 'No contacts', 'warning');
  },

  // ─── TEMPLATES ─────────────────────────────────────────
  async loadTemplates() {
    const res = await this.api('/api/templates');
    if (res.success) { this.state.templates = res.data; const sel = document.getElementById('templateSelect'); if (sel) { const v = sel.value; sel.innerHTML = '<option value="">-- Start from scratch --</option>' + res.data.map(t => `<option value="${t.id}">${this.esc(t.name)}</option>`).join(''); if (v) sel.value = v; } }
  },
  loadTemplate() {
    const tid = document.getElementById('templateSelect').value, btn = document.getElementById('btnDeleteTemplate');
    if (!tid) { document.getElementById('emailSubject').value = ''; this.state.blocks = []; this.renderBlocks(); btn.style.display = 'none'; return; }
    const t = this.state.templates.find(t => t.id === tid);
    if (t) { document.getElementById('emailSubject').value = t.subject || ''; this.state.blocks = [{ id: 'block_' + (++this.state.blockIdCounter), type: 'text', content: t.body || '' }]; this.renderBlocks(); btn.style.display = ''; this.api(`/api/templates/${tid}/use`, { method: 'POST' }); this.toast(`Template "${t.name}" loaded`, 'success'); }
  },
  showSaveTemplateModal() {
    if (!document.getElementById('emailBody').value.trim()) return this.toast('Build an email first', 'warning');
    this.showModal('Save Template', `<div class="form-group"><label class="form-label">Name</label><input type="text" class="form-input" id="templateName" autofocus/></div><div class="form-group"><label class="form-label">Category</label><select class="form-select" id="templateCategory"><option value="custom">Custom</option><option value="outreach">Outreach</option><option value="followup">Follow-up</option><option value="nurture">Nurture</option><option value="conversion">Conversion</option><option value="retention">Retention</option></select></div><button class="btn btn-primary btn-lg" style="width:100%;justify-content:center;" onclick="App.saveTemplate()">Save</button>`);
  },
  async saveTemplate() {
    const name = document.getElementById('templateName').value.trim(); if (!name) return this.toast('Enter a name', 'warning');
    const res = await this.api('/api/templates', { method: 'POST', body: JSON.stringify({ name, subject: document.getElementById('emailSubject').value, body: document.getElementById('emailBody').value, category: document.getElementById('templateCategory').value }) });
    if (res.success) { this.toast('Saved!', 'success'); this.closeModal(); this.loadTemplates(); }
  },
  async deleteCurrentTemplate() { const tid = document.getElementById('templateSelect').value; if (!tid || !confirm('Delete?')) return; await this.api(`/api/templates/${tid}`, { method: 'DELETE' }); this.toast('Deleted', 'success'); document.getElementById('btnDeleteTemplate').style.display = 'none'; this.loadTemplates(); },

  // ─── HISTORY ───────────────────────────────────────────
  async loadHistory() {
    const res = await this.api('/api/history?limit=500'), tbody = document.getElementById('historyTableBody');
    if (!res.success || !res.data.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="5"><div class="table-empty"><p>No history yet</p></div></td></tr>'; return; }
    tbody.innerHTML = res.data.map(h => `<tr><td>${new Date(h.timestamp).toLocaleString()}</td><td><strong>${this.esc(h.email)}</strong></td><td>${this.esc(h.subject||'—')}</td><td>${this.esc(h.campaignName||'—')}</td><td><span class="badge badge-${h.status}"><span class="badge-dot"></span>${h.status}</span></td></tr>`).join('');
  },

  // ─── IMAGE ─────────────────────────────────────────────
  handleDragOver(e) { e.preventDefault(); document.getElementById('imageDropzone').classList.add('dragover'); },
  handleDragLeave() { document.getElementById('imageDropzone').classList.remove('dragover'); },
  handleDrop(e) { e.preventDefault(); document.getElementById('imageDropzone').classList.remove('dragover'); if (e.dataTransfer.files[0]) this.showImagePreview(e.dataTransfer.files[0]); },
  handleImageSelect(e) { if (e.target.files[0]) this.showImagePreview(e.target.files[0]); },
  showImagePreview(file) { const r = new FileReader(); r.onload = (e) => { document.getElementById('dropzoneContent').style.display = 'none'; document.getElementById('dropzonePreview').style.display = 'block'; document.getElementById('imagePreviewImg').src = e.target.result; }; r.readAsDataURL(file); const dt = new DataTransfer(); dt.items.add(file); document.getElementById('imageInput').files = dt.files; },
  removeImage() { document.getElementById('dropzoneContent').style.display = ''; document.getElementById('dropzonePreview').style.display = 'none'; document.getElementById('imageInput').value = ''; },

  // ─── SHEETS ────────────────────────────────────────────
  async connectGoogle() { const res = await this.api('/api/auth/google'); if (res.success && res.url) window.open(res.url, '_blank', 'width=500,height=600'); else this.toast('Failed', 'error'); },
  async exportToSheets() { const cid = document.getElementById('sheetsCampaignSelect').value, sid = document.getElementById('sheetsId').value.trim(); if (!cid||!sid) return this.toast('Fill both fields', 'warning'); const res = await this.api('/api/sheets/export', { method: 'POST', body: JSON.stringify({ campaignId: cid, sheetId: sid }) }); if (res.success) this.toast('Exported!', 'success'); else this.toast(res.error, 'error'); },
  async importFromSheets() { const cid = document.getElementById('sheetsCampaignSelect').value, sid = document.getElementById('sheetsId').value.trim(); if (!cid||!sid) return this.toast('Fill both fields', 'warning'); const res = await this.api('/api/sheets/import', { method: 'POST', body: JSON.stringify({ campaignId: cid, sheetId: sid }) }); if (res.success) this.toast(`Imported ${res.data.length}`, 'success'); },
  async loadSyncSheetId() { const res = await this.api('/api/settings'); if (res.success) { const el = document.getElementById('syncSheetId'); if (el) el.value = res.data.syncSheetId || ''; } },
  async saveSyncSheetId() { const sid = document.getElementById('syncSheetId').value.trim(); if (!sid) return; await this.api('/api/settings', { method: 'POST', body: JSON.stringify({ syncSheetId: sid }) }); const res = await this.api('/api/sync', { method: 'POST' }); this.toast(res.success ? 'Synced!' : res.error, res.success ? 'success' : 'error'); },

  // ─── AUTH & SETTINGS ──────────────────────────────────
  async checkAuthStatus() {
    const res = await this.api('/api/auth/status');
    const el = document.getElementById('authStatus');
    const navIcon = document.getElementById('navGoogleIcon');
    const navLabel = document.getElementById('navGoogleLabel');
    const navStatus = document.getElementById('navGoogleStatus');
    if (res.success && res.authenticated) {
      if (el) el.innerHTML = '<div class="auth-dot connected"></div><span class="nav-text">Google: Connected</span>';
      const ct = document.getElementById('connectionTitle'); if (ct) ct.textContent = 'Connected';
      // Update navbar
      if (navIcon) navIcon.textContent = 'cloud_done';
      if (navLabel) navLabel.textContent = 'Connected';
      if (navStatus) navStatus.classList.add('connected');
    }
  },
  async loadSettings() {
    const res = await this.api('/api/settings');
    if (res.success && res.data) { const s = res.data; ['clientId','clientSecret','gmailUser','hunterKey','senderName'].forEach(k => { const el = document.getElementById('setting' + k.charAt(0).toUpperCase() + k.slice(1)); if (el) el.value = s[k] || ''; }); document.getElementById('settingDelay').value = s.emailDelay || 4; }
  },
  async saveSettings() {
    const s = { clientId: document.getElementById('settingClientId').value, clientSecret: document.getElementById('settingClientSecret').value, gmailUser: document.getElementById('settingGmailUser').value, hunterKey: document.getElementById('settingHunterKey').value, senderName: document.getElementById('settingSenderName').value, emailDelay: parseInt(document.getElementById('settingDelay').value) || 4 };
    const res = await this.api('/api/settings', { method: 'POST', body: JSON.stringify(s) });
    this.toast(res.success ? 'Saved!' : 'Failed', res.success ? 'success' : 'error');
  },

  // ─── SETTINGS TAB SWITCHING ─────────────────────────────
  switchSettingsTab(el, tabId) {
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.settings-tab-content').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    const tabContent = document.getElementById('settingsTab-' + tabId);
    if (tabContent) tabContent.classList.add('active');
    // Load data for the tab
    switch (tabId) {
      case 'channels': this.loadWhatsAppMessages(); this.loadPushStats(); this.loadPopups(); break;
      case 'integrations': this.loadIntegrations(); break;
      case 'sso': this.loadSSOConfig(); break;
      case 'dedicated-ip': this.loadDedicatedIp(); break;
    }
  },
  loadSettingsSubTabs() {
    // Pre-load the currently active tab's data
    const activeTab = document.querySelector('.settings-tab.active');
    if (activeTab) {
      const tabName = activeTab.textContent.trim().toLowerCase();
      if (tabName.includes('channel')) { this.loadWhatsAppMessages(); this.loadPushStats(); this.loadPopups(); }
      else if (tabName.includes('integration')) { this.loadIntegrations(); }
      else if (tabName.includes('sso')) { this.loadSSOConfig(); }
      else if (tabName.includes('dedicated')) { this.loadDedicatedIp(); }
    }
  },

  // ─── MODAL & TOAST ─────────────────────────────────────
  showModal(title, bodyHtml) { document.getElementById('modalTitle').textContent = title; document.getElementById('modalBody').innerHTML = bodyHtml; document.getElementById('modalOverlay').classList.add('active'); },
  closeModal() { document.getElementById('modalOverlay').classList.remove('active'); },
  toast(message, type = 'info') {
    const c = document.getElementById('toastContainer');
    const icons = { success: 'check', error: 'close', warning: 'warning', info: 'info' };
    const t = document.createElement('div'); t.className = `toast ${type}`;
    t.innerHTML = `<div class="toast-icon"><span class="material-icons-outlined" style="font-size:14px">${icons[type]}</span></div><div class="toast-message">${this.esc(message)}</div>`;
    c.appendChild(t); setTimeout(() => { t.classList.add('exit'); setTimeout(() => t.remove(), 300); }, 4000);
  },
  // ─── AUTONOMOUS DISCOVERY & SCRAPER ────────────────────
  toggleScraperMode(mode) {
    document.getElementById('tabScraperManual').className = mode === 'manual' ? 'btn btn-primary' : 'btn btn-secondary';
    document.getElementById('tabScraperAuto').className = mode === 'auto' ? 'btn btn-primary' : 'btn btn-secondary';
    document.getElementById('scraperModeManual').style.display = mode === 'manual' ? 'block' : 'none';
    document.getElementById('scraperModeAuto').style.display = mode === 'auto' ? 'block' : 'none';
  },
  async startAutonomousDiscovery() {
    const cid = document.getElementById('autonomousCampaignSelect').value;
    const industry = document.getElementById('autoIndustry').value.trim();
    const role = document.getElementById('autoRole').value.trim();
    const product = document.getElementById('autoProduct').value.trim();
    const prompt = document.getElementById('autoPrompt')?.value?.trim() || '';

    if (!cid || !industry || !role) return this.toast('Select campaign, industry, and role', 'warning');
    
    document.getElementById('scrapeProgress').style.display = 'flex';
    this.toast('Starting Autonomous Discovery Engine...', 'info');
    this.addNotification('Autonomous Discovery started for ' + industry, 'rocket_launch');
    
    // Auto polling
    const pollId = setInterval(() => { this.loadScraperStatus(); }, 2000);
    this.state.isScraping = true;
    
    try {
      const res = await this.api('/api/scrape/autonomous', {
        method: 'POST',
        body: JSON.stringify({ campaignId: cid, industry, role, product, prompt })
      });
      if (res.success) {
        this.toast('Discovery sequence initiated. See logs below.', 'success');
      } else {
        this.toast(res.error || 'Failed to start', 'error');
        clearInterval(pollId); this.state.isScraping = false;
      }
    } catch (err) {
      clearInterval(pollId); this.state.isScraping = false;
    }
  },

  // ─── AUTOMATIONS BUILDER (Visual Workflow) ──────────────
  async loadAutomations() {
    const res = await this.api('/api/automations');
    const list = document.getElementById('automationsList');
    // Hide editor when loading list
    const editor = document.getElementById('wfEditorLayout');
    if (editor) editor.style.display = 'none';
    const banner = document.getElementById('wfUnpublishedBanner');
    if (banner) banner.style.display = 'none';
    ['wfBtnGraph','wfBtnPreview','wfBtnSave'].forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });
    const createBtn = document.getElementById('wfBtnCreate'); if(createBtn) createBtn.style.display = '';
    const badge = document.getElementById('wfDraftBadge'); if(badge) badge.style.display = 'none';
    const title = document.getElementById('wfProcessTitle'); 
    document.querySelector('.wf-process-title').textContent = 'Process';

    if (!res.success || !res.data.length) {
      list.innerHTML = '<div class="empty-state"><p class="empty-title">No Workflows</p><p class="empty-text">Create your first automation workflow</p></div>';
      list.style.display = 'grid';
      return;
    }
    this.state.automations = res.data;
    list.style.display = 'grid';
    list.innerHTML = res.data.map(a => `
      <div class="template-card" style="cursor:pointer;" onclick="App.openAutomation('${a.id}')">
         <div class="tpl-header"><span class="tpl-category">${a.triggerType.replace(/_/g,' ')}</span></div>
         <h4 class="tpl-name">${this.esc(a.name)}</h4>
         <div class="tpl-footer">
           <span class="tpl-uses" style="color:${a.isActive ? 'var(--success)' : 'var(--text-muted)'}">${a.isActive ? '● Active' : '○ Draft'}</span>
           <div class="tpl-actions">
             <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();App.deleteAutomation('${a.id}')">Delete</button>
           </div>
         </div>
      </div>
    `).join('');
  },

  async deleteAutomation(id) {
    if (!confirm('Delete this workflow?')) return;
    await this.api(`/api/automations/${id}`, { method: 'DELETE' });
    this.loadAutomations();
  },

  showNewAutomationModal() {
    this.showModal('Create Visual Workflow', `
      <div style="margin-bottom:24px;text-align:center;">
        <div style="display:inline-flex;padding:16px;border-radius:50%;background:var(--primary-light);color:var(--primary);margin-bottom:16px;"><span class="material-icons-outlined" style="font-size:32px;">account_tree</span></div>
        <p style="color:var(--text-secondary);font-size:0.9rem;">Automate outreach with visual multi-step sequences.</p>
      </div>
      <div class="form-group"><label class="form-label">Workflow Name <span style="color:var(--danger)">*</span></label><input type="text" class="form-input" id="newAutoName" placeholder="e.g. VIP Nurture Sequence"/></div>
      <div class="form-group" style="margin-top:16px;"><label class="form-label">Entry Trigger</label>
        <select class="form-select" id="newAutoTrigger">
          <option value="email_opened">Email Opened</option><option value="email_clicked">Email Clicked</option>
          <option value="intent_score_increase">Intent Score > 80</option><option value="contact_created">New Contact Created</option>
        </select>
      </div>
      <button class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:24px;" onclick="App.createAutomation()">Launch Builder</button>
    `);
  },

  async createAutomation() {
    const name = document.getElementById('newAutoName').value;
    const trigger = document.getElementById('newAutoTrigger').value;
    if (!name) return this.toast('Name is required', 'warning');
    const newAuto = { name, triggerType: trigger, rules: [], actions: [{ type: 'change_stage', stage: 'qualified' }] };
    const res = await this.api('/api/automations', { method: 'POST', body: JSON.stringify(newAuto) });
    if (res.success) { this.toast('Created!', 'success'); this.closeModal(); this.loadAutomations(); this.openAutomation(res.data.id); }
  },

  openAutomation(id) {
    const auto = (this.state.automations || []).find(a => a.id === id);
    if (!auto) return;
    this.state.currentAutomation = auto;
    this.state.selectedNodeIdx = null;
    this._wfOpenMenu = null;
    // Show editor, hide list
    document.getElementById('automationsList').style.display = 'none';
    document.getElementById('wfEditorLayout').style.display = 'grid';
    document.getElementById('wfUnpublishedBanner').style.display = auto.isActive ? 'none' : 'flex';
    ['wfBtnGraph','wfBtnPreview','wfBtnSave'].forEach(id => { const el = document.getElementById(id); if(el) el.style.display = ''; });
    document.getElementById('wfBtnCreate').style.display = 'none';
    document.querySelector('.wf-process-title').textContent = auto.name;
    const badge = document.getElementById('wfDraftBadge');
    badge.style.display = '';
    badge.textContent = auto.isActive ? 'Active' : 'Draft';
    badge.style.background = auto.isActive ? '#D1FAE5' : '#FEF3C7';
    badge.style.color = auto.isActive ? '#065F46' : '#92400E';
    this.renderWfCanvas();
  },

  closeAutomationBuilder() {
    this.state.currentAutomation = null;
    document.getElementById('wfEditorLayout').style.display = 'none';
    document.getElementById('automationsList').style.display = 'grid';
    document.getElementById('wfUnpublishedBanner').style.display = 'none';
    ['wfBtnGraph','wfBtnPreview','wfBtnSave'].forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });
    document.getElementById('wfBtnCreate').style.display = '';
    document.getElementById('wfDraftBadge').style.display = 'none';
    document.querySelector('.wf-process-title').textContent = 'Process';
  },

  renderWfCanvas() {
    const auto = this.state.currentAutomation;
    const canvas = document.getElementById('wfCanvas');
    if (!auto || !canvas) return;
    let html = '';
    // Trigger node
    html += this._wfNode('trigger', 'bolt', 'Trigger', auto.triggerType.replace(/_/g,' '), -1);
    html += this._wfConnector(0);
    // Rules/conditions
    (auto.rules || []).forEach((r, i) => {
      html += this._wfNode('condition', 'call_split', 'If / Else', `${r.field} ${r.operator} ${r.value}`, i, 'rule');
      html += this._wfConnector(i + 1);
    });
    // Actions
    const rLen = (auto.rules || []).length;
    (auto.actions || []).forEach((a, i) => {
      const label = a.type === 'send_template' ? 'Send Email Template' : `Change Stage → ${a.stage || 'qualified'}`;
      html += this._wfNode('action', 'flash_on', 'Do This', label, rLen + i, 'action');
      html += this._wfConnector(rLen + i + 1);
    });
    // End node
    html += `<div class="wf-node" onclick="App.selectWfNode(-2)"><div class="wf-node-header end"><span class="material-icons-outlined">flag</span> END</div><div class="wf-node-body"><div class="wf-node-label">Workflow Complete</div></div></div>`;
    canvas.innerHTML = html;
    // Close any open menu on outside click
    setTimeout(() => { document.querySelectorAll('.wf-add-menu').forEach(m => { if (this._wfOpenMenu === null) m.remove(); }); }, 0);
  },

  _wfNode(type, icon, title, desc, idx, dataType) {
    const sel = this.state.selectedNodeIdx === idx ? ' selected' : '';
    return `<div class="wf-node${sel}" onclick="App.selectWfNode(${idx})" data-type="${dataType||type}">
      <div class="wf-node-header ${type}"><span class="material-icons-outlined">${icon}</span> ${title}</div>
      <div class="wf-node-body"><div class="wf-node-label">${desc}</div></div>
    </div>`;
  },

  _wfConnector(insertIdx) {
    return `<div class="wf-connector">
      <div class="wf-connector-line"></div>
      <div class="wf-add-btn" onclick="event.stopPropagation();App.toggleWfMenu(this,${insertIdx})">+</div>
      <div class="wf-connector-line"></div>
    </div>`;
  },

  toggleWfMenu(btn, insertIdx) {
    const existing = btn.parentElement.querySelector('.wf-add-menu');
    if (existing) { existing.remove(); this._wfOpenMenu = null; return; }
    document.querySelectorAll('.wf-add-menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'wf-add-menu';
    menu.innerHTML = `
      <div class="wf-add-menu-item" onclick="App.addWfStep(${insertIdx},'action')"><span class="material-icons-outlined" style="color:var(--success)">flash_on</span> New Action</div>
      <div class="wf-add-menu-item" onclick="App.addWfStep(${insertIdx},'condition')"><span class="material-icons-outlined" style="color:var(--warning)">call_split</span> If / Else</div>
      <div class="wf-add-menu-item" onclick="App.addWfStep(${insertIdx},'end')"><span class="material-icons-outlined" style="color:var(--text-muted)">flag</span> End</div>
    `;
    btn.parentElement.appendChild(menu);
    this._wfOpenMenu = insertIdx;
    setTimeout(() => document.addEventListener('click', function h() { menu.remove(); document.removeEventListener('click', h); }, { once: true }), 10);
  },

  addWfStep(insertIdx, type) {
    const auto = this.state.currentAutomation; if (!auto) return;
    if (type === 'action') {
      auto.actions = auto.actions || [];
      auto.actions.push({ type: 'change_stage', stage: 'opportunity' });
    } else if (type === 'condition') {
      auto.rules = auto.rules || [];
      auto.rules.push({ field: 'leadScore', operator: '>', value: '50' });
    }
    this._wfOpenMenu = null;
    this.renderWfCanvas();
  },

  selectWfNode(idx) {
    this.state.selectedNodeIdx = idx;
    this.renderWfCanvas();
    const auto = this.state.currentAutomation; if (!auto) return;
    const panel = document.getElementById('wfPanelBody');
    if (idx === -1) {
      panel.innerHTML = `<h4 style="margin-bottom:12px">Trigger Settings</h4>
        <div class="form-group"><label class="form-label">Trigger Event</label>
        <select class="form-select" id="wfTriggerType" onchange="App.updateWfTrigger(this.value)">
          <option value="email_opened" ${auto.triggerType==='email_opened'?'selected':''}>Email Opened</option>
          <option value="email_clicked" ${auto.triggerType==='email_clicked'?'selected':''}>Email Clicked</option>
          <option value="intent_score_increase" ${auto.triggerType==='intent_score_increase'?'selected':''}>Intent Score > 80</option>
          <option value="contact_created" ${auto.triggerType==='contact_created'?'selected':''}>New Contact Created</option>
        </select></div>`;
    } else if (idx === -2) {
      panel.innerHTML = '<h4>End Node</h4><p class="text-muted">This marks the end of the workflow. No further actions will be taken.</p>';
    } else {
      const rLen = (auto.rules||[]).length;
      if (idx < rLen) {
        const r = auto.rules[idx];
        panel.innerHTML = `<h4 style="margin-bottom:12px">Condition</h4>
          <div class="form-group"><label class="form-label">Field</label><input type="text" class="form-input" value="${this.esc(r.field)}" onchange="App.updateWfRule(${idx},'field',this.value)"/></div>
          <div class="form-group"><label class="form-label">Operator</label><select class="form-select" onchange="App.updateWfRule(${idx},'operator',this.value)">
            <option value=">" ${r.operator==='>'?'selected':''}>Greater than</option><option value="<" ${r.operator==='<'?'selected':''}>Less than</option><option value="=" ${r.operator==='='?'selected':''}>Equals</option>
          </select></div>
          <div class="form-group"><label class="form-label">Value</label><input type="text" class="form-input" value="${this.esc(r.value)}" onchange="App.updateWfRule(${idx},'value',this.value)"/></div>`;
      } else {
        const aIdx = idx - rLen;
        const a = auto.actions[aIdx];
        if (!a) { panel.innerHTML = '<p class="text-muted">Select a node</p>'; return; }
        panel.innerHTML = `<h4 style="margin-bottom:12px">Action</h4>
          <div class="form-group"><label class="form-label">Type</label>
          <select class="form-select" onchange="App.updateWfAction(${aIdx},'type',this.value);App.selectWfNode(${idx})">
            <option value="change_stage" ${a.type==='change_stage'?'selected':''}>Change Stage</option>
            <option value="send_template" ${a.type==='send_template'?'selected':''}>Send Template</option>
          </select></div>
          ${a.type==='change_stage' ? `<div class="form-group"><label class="form-label">Stage</label>
            <select class="form-select" onchange="App.updateWfAction(${aIdx},'stage',this.value)">
              ${['lead','prospect','qualified','opportunity','customer','retained'].map(s=>`<option value="${s}" ${a.stage===s?'selected':''}>${s}</option>`).join('')}
            </select></div>` : `<div class="form-group"><label class="form-label">Template ID</label>
            <input type="text" class="form-input" value="${this.esc(a.templateId||'')}" onchange="App.updateWfAction(${aIdx},'templateId',this.value)"/></div>`}`;
      }
    }
  },

  updateWfTrigger(val) { if (this.state.currentAutomation) { this.state.currentAutomation.triggerType = val; this.renderWfCanvas(); } },
  updateWfRule(idx, field, val) { if (this.state.currentAutomation?.rules?.[idx]) { this.state.currentAutomation.rules[idx][field] = val; this.renderWfCanvas(); } },
  updateWfAction(idx, field, val) { if (this.state.currentAutomation?.actions?.[idx]) { this.state.currentAutomation.actions[idx][field] = val; this.renderWfCanvas(); } },
  closeWfPanel() { this.state.selectedNodeIdx = null; this.renderWfCanvas(); document.getElementById('wfPanelBody').innerHTML = '<p class="text-muted">Select a node to edit its properties</p>'; },
  wfZoom(dir) { const c = document.getElementById('wfCanvas'); const s = parseFloat(c.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || 1); c.style.transform = `scale(${Math.min(2,Math.max(0.5,s+dir*0.1))})`; },
  refreshWorkflow() { this.renderWfCanvas(); this.toast('Refreshed', 'info'); },
  deleteSelectedNode() {
    const auto = this.state.currentAutomation; if (!auto || this.state.selectedNodeIdx === null) return this.toast('Select a node first','warning');
    const idx = this.state.selectedNodeIdx;
    if (idx === -1 || idx === -2) return this.toast('Cannot delete trigger/end','warning');
    const rLen = (auto.rules||[]).length;
    if (idx < rLen) { auto.rules.splice(idx,1); } else { auto.actions.splice(idx-rLen,1); }
    this.state.selectedNodeIdx = null; this.renderWfCanvas(); this.toast('Node deleted','success');
  },
  previewWorkflow() { this.toast('Preview mode coming soon', 'info'); },
  async publishWorkflow() {
    const auto = this.state.currentAutomation; if (!auto) return;
    auto.isActive = true;
    const res = await this.api('/api/automations/' + auto.id, { method: 'PUT', body: JSON.stringify(auto) });
    if (res.success) { this.toast('Published!','success'); document.getElementById('wfUnpublishedBanner').style.display = 'none';
      const badge = document.getElementById('wfDraftBadge'); badge.textContent = 'Active'; badge.style.background = '#D1FAE5'; badge.style.color = '#065F46'; }
  },
  async saveCurrentAutomation() {
    const auto = this.state.currentAutomation; if (!auto) return;
    const res = await this.api('/api/automations/' + auto.id, { method: 'PUT', body: JSON.stringify(auto) });
    if (res.success) this.toast('Workflow saved', 'success');
  },

  esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },
  timeAgo(d) { if (!d) return 'never'; const m = Math.floor((Date.now()-new Date(d).getTime())/60000); if (m<1) return 'just now'; if (m<60) return m+'m ago'; const h = Math.floor(m/60); if (h<24) return h+'h ago'; return Math.floor(h/24)+'d ago'; }
});
