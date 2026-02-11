/* ===== Agent Builder — Frontend Logic ===== */

const API = window.location.origin;

const STEPS = [
  { num: 1, label: 'Tools' },
  { num: 2, label: 'Params' },
  { num: 3, label: 'Config' },
  { num: 4, label: 'Deploy' },
  { num: 5, label: 'Chat' },
];

const ICONS = {
  cloud: '\u2601\uFE0F',
  dollar: '\uD83D\uDCB2',
  book: '\uD83D\uDCD6',
  github: '\uD83D\uDC19',
  code: '\uD83D\uDCBB',
  scan: '\uD83D\uDCC4',
  wrench: '\uD83D\uDD27',
};

/* ===== State ===== */
const state = {
  step: 1,
  tools: [],          // catalog from API
  toolDetails: {},    // keyed by tool id
  selected: {},       // tool_id -> { deploy_params: {}, runtime_params: {} }
  agentName: '',
  agentModel: 'gpt-4.1',
  instructions: '',
  deployedAgent: null, // { name, id, version }
  chatHistory: [],     // [{ role, content, toolCalls }]
  previousResponseId: null,
  promptParams: [],          // prompt param definitions for builder
  paramValues: {},           // resolved param values for chat
  chatParamsConfirmed: false, // whether user confirmed params before chat
  filter: 'all',
  healthResults: {},    // tool_id -> { status, message, details, loading }
  toolFormMode: null,   // null | 'add' | 'edit'
  toolFormData: null,   // data for the tool form modal
};

/* ===== Markdown Config ===== */
marked.setOptions({ breaks: true });

/* ===== Init ===== */
(async function init() {
  const params = new URLSearchParams(window.location.search);
  const agentName = params.get('agent');

  if (agentName) {
    // Open in chat-only mode for existing agent
    state.step = 5;
    state.agentName = agentName;
    state.deployedAgent = { name: agentName, id: '', version: 0 };
    renderStep();
    // Fetch agent details
    try {
      const res = await fetch(`${API}/api/agents/${encodeURIComponent(agentName)}`);
      if (res.ok) {
        state.deployedAgent = await res.json();
        renderStep();
      }
    } catch (e) { /* ignore, chat still works */ }
  } else {
    await loadTools();
    renderStep();
  }
})();

async function loadTools() {
  try {
    const res = await fetch(`${API}/api/tools`);
    state.tools = await res.json();
  } catch (e) {
    state.tools = [];
  }
}

/* ===== Render Router ===== */
function renderStep() {
  renderStepIndicator();
  const el = document.getElementById('step-content');

  switch (state.step) {
    case 1: renderToolCatalog(el); break;
    case 2: renderToolParams(el); break;
    case 3: renderAgentConfig(el); break;
    case 4: renderDeploy(el); break;
    case 5: renderChat(el); break;
  }
}

/* ===== Step Indicator ===== */
function renderStepIndicator() {
  const el = document.getElementById('step-indicator');
  let html = '';
  STEPS.forEach((s, i) => {
    const cls = s.num === state.step ? 'active' : s.num < state.step ? 'done' : '';
    html += `<div class="step-item ${cls}">
      <div class="step-num">${s.num < state.step ? '\u2713' : s.num}</div>
      <span>${s.label}</span>
    </div>`;
    if (i < STEPS.length - 1) {
      html += `<div class="step-line ${s.num < state.step ? 'done' : ''}"></div>`;
    }
  });
  el.innerHTML = html;
}

/* ===== Step 1: Tool Catalog ===== */
function renderToolCatalog(el) {
  const types = ['all', ...new Set(state.tools.map(t => t.type))];
  const filtered = state.filter === 'all' ? state.tools : state.tools.filter(t => t.type === state.filter);

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2>Select Tools</h2>
      <button class="btn btn-primary btn-sm" onclick="openToolForm('add')">+ Add Custom Tool</button>
    </div>
    <div class="filter-bar">
      ${types.map(t => `<button class="chip ${state.filter === t ? 'selected' : ''}"
        onclick="setFilter('${t}')">${t === 'all' ? 'All' : t.toUpperCase()}</button>`).join('')}
    </div>
    <div class="card-grid">
      ${filtered.map(t => {
        const sel = state.selected[t.id] ? 'selected' : '';
        const badgeCls = t.type === 'openapi' ? 'badge-api' : t.type === 'mcp' ? 'badge-mcp' : 'badge-builtin';
        const isCustom = t.source === 'custom';
        const health = state.healthResults[t.id];
        return `<div class="card tool-card ${sel}">
          <div class="tool-check" onclick="toggleTool('${t.id}')">\u2713</div>
          <div class="tool-card-body" onclick="toggleTool('${t.id}')">
            <div class="tool-header">
              <div class="tool-icon">${ICONS[t.icon] || '\uD83D\uDD27'}</div>
              <h3>${esc(t.name)}</h3>
              <span class="badge ${badgeCls}">${t.type}</span>
              ${!isCustom ? '<span class="tool-lock" title="Built-in tool">\uD83D\uDD12</span>' : ''}
            </div>
            <p>${esc(t.description)}</p>
          </div>
          <div class="tool-card-footer">
            <div class="tool-health-area" id="health-${t.id}">
              ${health ? renderHealthBadge(health) : ''}
            </div>
            <div class="tool-card-actions">
              <button class="btn btn-secondary btn-xs" onclick="event.stopPropagation();testTool('${t.id}')" title="Test connectivity">Test</button>
              ${isCustom ? `<button class="btn btn-secondary btn-xs" onclick="event.stopPropagation();openToolForm('edit','${t.id}')" title="Edit tool">Edit</button>
              <button class="btn btn-danger btn-xs" onclick="event.stopPropagation();showDeleteToolModal('${t.id}')" title="Delete tool">Del</button>` : ''}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="actions-bar">
      <span style="color:var(--text-secondary);font-size:.85rem">${Object.keys(state.selected).length} tool(s) selected</span>
      <button class="btn btn-primary" onclick="goToStep(2)">${Object.keys(state.selected).length === 0 ? 'Skip Tools \u2192' : 'Next: Configure Parameters'}</button>
    </div>`;
}

function renderHealthBadge(health) {
  if (health.loading) {
    return '<span class="health-badge health-loading"><span class="spinner" style="width:12px;height:12px;border-width:2px"></span> Testing...</span>';
  }
  if (health.status === 'healthy') {
    const time = health.details?.response_time_ms ? ` (${health.details.response_time_ms}ms)` : '';
    return `<span class="health-badge health-ok" title="${esc(health.message)}">&#10003; Healthy${time}</span>`;
  }
  return `<span class="health-badge health-err" title="${esc(health.message)}">&#10007; ${esc(health.message)}</span>`;
}

function setFilter(f) {
  state.filter = f;
  renderStep();
}

function toggleTool(id) {
  if (state.selected[id]) {
    delete state.selected[id];
  } else {
    state.selected[id] = { deploy_params: {}, runtime_params: {} };
  }
  renderStep();
}

/* ===== Health Check ===== */
async function testTool(toolId) {
  state.healthResults[toolId] = { loading: true };
  const area = document.getElementById(`health-${toolId}`);
  if (area) area.innerHTML = renderHealthBadge(state.healthResults[toolId]);

  try {
    const res = await fetch(`${API}/api/tools/${encodeURIComponent(toolId)}/health`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
    state.healthResults[toolId] = await res.json();
  } catch (err) {
    state.healthResults[toolId] = { status: 'unhealthy', message: err.message, details: {} };
  }

  const area2 = document.getElementById(`health-${toolId}`);
  if (area2) area2.innerHTML = renderHealthBadge(state.healthResults[toolId]);
}

/* ===== Tool CRUD ===== */
function openToolForm(mode, toolId) {
  state.toolFormMode = mode;
  if (mode === 'edit' && toolId) {
    const tool = state.tools.find(t => t.id === toolId);
    state.toolFormData = tool ? { ...tool } : null;
  } else {
    state.toolFormData = {
      id: '', name: '', description: '', type: 'openapi', category: '',
      icon: 'wrench', deploy_params: {}, runtime_params: {},
    };
  }
  renderToolFormModal();
}

function renderToolFormModal() {
  const d = state.toolFormData;
  if (!d) return;
  const isEdit = state.toolFormMode === 'edit';
  const title = isEdit ? 'Edit Tool' : 'Add Custom Tool';

  // For edit mode, deploy_params/runtime_params are the full catalog dicts
  // For add mode, build a simplified structure
  let deploySection = '';
  if (d.type === 'openapi' && !isEdit) {
    deploySection = `
      <div class="form-group">
        <label for="tf-spec-url">OpenAPI Spec URL *</label>
        <div style="display:flex;gap:8px">
          <input type="text" id="tf-spec-url" placeholder="https://api.example.com/openapi.json"
            value="${esc(d._specUrl || '')}" style="flex:1"
            onchange="state.toolFormData._specUrl=this.value">
          <button class="btn btn-secondary btn-sm" type="button" onclick="fetchAndValidateSpec()">Fetch &amp; Validate</button>
        </div>
        <div id="tf-spec-result"></div>
      </div>
      <div class="form-group">
        <label for="tf-auth">Authentication</label>
        <select id="tf-auth" onchange="state.toolFormData._authType=this.value">
          <option value="anonymous">anonymous</option>
          <option value="project_connection">project_connection</option>
          <option value="managed_identity">managed_identity</option>
        </select>
      </div>`;
  } else if (d.type === 'mcp' && !isEdit) {
    deploySection = `
      <div class="form-group">
        <label for="tf-server-url">MCP Server URL *</label>
        <input type="text" id="tf-server-url" placeholder="https://example.com/api/mcp"
          value="${esc(d._serverUrl || '')}"
          onchange="state.toolFormData._serverUrl=this.value">
        <div class="hint">For GitMCP repos, use: https://gitmcp.io/owner/repo</div>
      </div>
      <div class="form-group">
        <label for="tf-approval">Require approval</label>
        <select id="tf-approval" onchange="state.toolFormData._approval=this.value">
          <option value="never">never</option>
          <option value="always">always</option>
        </select>
      </div>`;
  }

  const modal = document.getElementById('tool-modal-backdrop');
  modal.innerHTML = `
    <div class="modal" style="max-width:560px">
      <h3>${title}</h3>
      <div class="tool-form">
        ${!isEdit ? `<div class="form-group">
          <label>Type *</label>
          <div class="chip-group">
            <button type="button" class="chip ${d.type === 'openapi' ? 'selected' : ''}" onclick="setToolFormType('openapi')">OpenAPI</button>
            <button type="button" class="chip ${d.type === 'mcp' ? 'selected' : ''}" onclick="setToolFormType('mcp')">MCP</button>
          </div>
        </div>` : ''}
        <div class="form-group">
          <label for="tf-id">ID *</label>
          <input type="text" id="tf-id" value="${esc(d.id)}" placeholder="my-tool-name"
            pattern="^[a-z0-9-]+$" maxlength="50" ${isEdit ? 'disabled' : ''}
            onchange="state.toolFormData.id=this.value">
          ${!isEdit ? '<div class="hint">Lowercase letters, numbers, and hyphens only</div>' : ''}
        </div>
        <div class="form-group">
          <label for="tf-name">Name *</label>
          <input type="text" id="tf-name" value="${esc(d.name)}" placeholder="My Tool"
            maxlength="100" onchange="state.toolFormData.name=this.value">
        </div>
        <div class="form-group">
          <label for="tf-desc">Description *</label>
          <textarea id="tf-desc" rows="2" placeholder="What does this tool do?"
            onchange="state.toolFormData.description=this.value">${esc(d.description)}</textarea>
        </div>
        <div class="form-group">
          <label for="tf-category">Category *</label>
          <input type="text" id="tf-category" value="${esc(d.category)}" placeholder="e.g. utilities, knowledge"
            onchange="state.toolFormData.category=this.value">
        </div>
        <div class="form-group">
          <label for="tf-icon">Icon</label>
          <select id="tf-icon" onchange="state.toolFormData.icon=this.value">
            ${Object.keys(ICONS).map(k => `<option value="${k}" ${d.icon === k ? 'selected' : ''}>${ICONS[k]} ${k}</option>`).join('')}
          </select>
        </div>
        ${deploySection}
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary btn-sm" onclick="closeToolModal()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="saveToolForm()">${isEdit ? 'Save Changes' : 'Add Tool'}</button>
      </div>
    </div>`;
  modal.style.display = 'flex';
}

function setToolFormType(type) {
  if (state.toolFormData) {
    state.toolFormData.type = type;
    renderToolFormModal();
  }
}

function closeToolModal() {
  document.getElementById('tool-modal-backdrop').style.display = 'none';
  state.toolFormMode = null;
  state.toolFormData = null;
}

async function fetchAndValidateSpec() {
  const url = document.getElementById('tf-spec-url')?.value?.trim();
  const result = document.getElementById('tf-spec-result');
  if (!url) { result.innerHTML = '<span class="health-badge health-err">Enter a URL first</span>'; return; }

  result.innerHTML = '<span class="health-badge health-loading"><span class="spinner" style="width:12px;height:12px;border-width:2px"></span> Fetching...</span>';

  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const spec = await res.json();
    const ver = spec.openapi || 'unknown';
    const title = spec.info?.title || '';
    const paths = spec.paths || {};
    const ops = Object.values(paths).flatMap(p => Object.entries(p)
      .filter(([m]) => ['get','post','put','patch','delete'].includes(m))
      .map(([, d]) => d.operationId || 'unnamed'));
    result.innerHTML = `<span class="health-badge health-ok">&#10003; Valid (${ver}) — ${ops.length} operation(s): ${esc(title)}</span>`;
    // Store for later
    state.toolFormData._specUrl = url;
    state.toolFormData._operations = ops;
  } catch (err) {
    result.innerHTML = `<span class="health-badge health-err">&#10007; ${esc(err.message)}</span>`;
  }
}

async function saveToolForm() {
  const d = state.toolFormData;
  if (!d) return;

  // Read latest values from inputs
  d.id = document.getElementById('tf-id')?.value?.trim() || d.id;
  d.name = document.getElementById('tf-name')?.value?.trim() || d.name;
  d.description = document.getElementById('tf-desc')?.value?.trim() || d.description;
  d.category = document.getElementById('tf-category')?.value?.trim() || d.category;
  d.icon = document.getElementById('tf-icon')?.value || d.icon;

  // Validate
  if (!d.id || !d.name || !d.description || !d.category) {
    alert('Please fill in all required fields.'); return;
  }
  if (!/^[a-z0-9-]+$/.test(d.id)) {
    alert('ID must contain only lowercase letters, numbers, and hyphens.'); return;
  }

  // Build deploy_params based on type
  if (state.toolFormMode === 'add') {
    if (d.type === 'openapi') {
      const specUrl = d._specUrl || document.getElementById('tf-spec-url')?.value?.trim() || '';
      const authType = document.getElementById('tf-auth')?.value || 'anonymous';
      const ops = d._operations || [];
      if (!specUrl) { alert('Spec URL is required for OpenAPI tools.'); return; }
      d.deploy_params = {
        spec_url: { label: 'OpenAPI Spec URL', type: 'string', default: specUrl, required: true },
        operations: { label: 'Operations to include', type: 'multi_select', options: ops, default: ops, required: true },
        auth_type: { label: 'Authentication', type: 'select', options: ['anonymous', 'project_connection', 'managed_identity'], default: authType, required: true },
        project_connection_id: { label: 'Project Connection', type: 'connection_picker', default: '', required: false, show_if: { auth_type: 'project_connection' } },
      };
    } else if (d.type === 'mcp') {
      const serverUrl = d._serverUrl || document.getElementById('tf-server-url')?.value?.trim() || '';
      const approval = document.getElementById('tf-approval')?.value || 'never';
      if (!serverUrl) { alert('Server URL is required for MCP tools.'); return; }
      d.deploy_params = {
        server_url: { label: 'MCP Server URL', type: 'string', default: serverUrl, required: true },
        require_approval: { label: 'Require approval for tool calls', type: 'select', options: ['never', 'always'], default: approval, required: true },
        allowed_tools: { label: 'Restrict to specific tools (comma-separated, blank = all)', type: 'string', default: '', required: false },
      };
    }
    d.runtime_params = {};
  }

  // Clean internal fields
  const payload = { ...d };
  delete payload._specUrl; delete payload._serverUrl; delete payload._authType;
  delete payload._approval; delete payload._operations; delete payload.source;

  try {
    let res;
    if (state.toolFormMode === 'edit') {
      const { id, type, ...updates } = payload;
      res = await fetch(`${API}/api/tools/${encodeURIComponent(d.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } else {
      res = await fetch(`${API}/api/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    closeToolModal();
    await loadTools();
    renderStep();
  } catch (err) {
    alert(`Failed to save tool: ${err.message}`);
  }
}

function showDeleteToolModal(toolId) {
  const tool = state.tools.find(t => t.id === toolId);
  const modal = document.getElementById('tool-modal-backdrop');
  modal.innerHTML = `
    <div class="modal">
      <h3>Delete Tool</h3>
      <p>Are you sure you want to delete <strong>${esc(tool?.name || toolId)}</strong> from the catalog?</p>
      <div class="modal-actions">
        <button class="btn btn-secondary btn-sm" onclick="closeToolModal()">Cancel</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteTool('${toolId}')">Delete</button>
      </div>
    </div>`;
  modal.style.display = 'flex';
}

async function confirmDeleteTool(toolId) {
  try {
    const res = await fetch(`${API}/api/tools/${encodeURIComponent(toolId)}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const err = await res.json();
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
    // Remove from selected if it was selected
    delete state.selected[toolId];
    delete state.toolDetails[toolId];
    delete state.healthResults[toolId];
    closeToolModal();
    await loadTools();
    renderStep();
  } catch (err) {
    alert(`Failed to delete tool: ${err.message}`);
  }
}

/* ===== Step 2: Tool Parameters ===== */
async function renderToolParams(el) {
  const toolIds = Object.keys(state.selected);

  if (toolIds.length === 0) {
    el.innerHTML = `
      <h2 style="margin-bottom:16px">Configure Tool Parameters</h2>
      <div class="empty-state" style="padding:40px">
        <p>No tools selected &mdash; this agent will use only its model and instructions.</p>
      </div>
      <div class="actions-bar">
        <button class="btn btn-secondary" onclick="goToStep(1)">Back</button>
        <button class="btn btn-primary" onclick="goToStep(3)">Next: Agent Config</button>
      </div>`;
    return;
  }

  // Fetch details for tools we haven't loaded yet
  const toFetch = toolIds.filter(id => !state.toolDetails[id]);
  if (toFetch.length > 0) {
    el.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><p>Loading tool parameters...</p></div>';
    await Promise.all(toFetch.map(async id => {
      const res = await fetch(`${API}/api/tools/${id}`);
      state.toolDetails[id] = await res.json();
    }));
  }

  let html = '<h2 style="margin-bottom:16px">Configure Tool Parameters</h2>';

  for (const id of toolIds) {
    const detail = state.toolDetails[id];
    const dpKeys = Object.keys(detail.deploy_params || {});
    const rpKeys = Object.keys(detail.runtime_params || {});

    html += `<div class="param-section">
      <h4>${ICONS[detail.icon] || ''} ${esc(detail.name)}</h4>`;

    if (dpKeys.length > 0) {
      html += '<p style="font-size:.8rem;color:var(--text-secondary);margin-bottom:12px">Deploy Configuration</p>';
      for (const key of dpKeys) {
        html += renderParamField(id, 'deploy_params', key, detail.deploy_params[key]);
      }
    }

    if (rpKeys.length > 0) {
      html += '<p style="font-size:.8rem;color:var(--text-secondary);margin-bottom:12px;margin-top:16px">Runtime Preferences</p>';
      for (const key of rpKeys) {
        html += renderParamField(id, 'runtime_params', key, detail.runtime_params[key]);
      }
    }

    if (dpKeys.length === 0 && rpKeys.length === 0) {
      html += '<p style="font-size:.85rem;color:var(--text-secondary)">No parameters to configure.</p>';
    }

    html += '</div>';
  }

  html += `<div class="actions-bar">
    <button class="btn btn-secondary" onclick="goToStep(1)">Back</button>
    <button class="btn btn-primary" onclick="goToStep(3)">Next: Agent Config</button>
  </div>`;

  el.innerHTML = html;
  handleShowIf();
}

function renderParamField(toolId, section, key, param) {
  const stored = state.selected[toolId]?.[section]?.[key];
  const value = stored !== undefined ? stored : (param.default ?? '');
  const inputId = `param-${toolId}-${section}-${key}`;
  const req = param.required ? ' *' : '';

  // Determine show_if visibility
  let showIfAttr = '';
  if (param.show_if) {
    const [condKey, condVal] = Object.entries(param.show_if)[0];
    showIfAttr = ` data-showif-tool="${toolId}" data-showif-section="${section}" data-showif-key="${condKey}" data-showif-value="${condVal}"`;
  }

  let html = `<div class="form-group" id="fg-${inputId}"${showIfAttr}>
    <label for="${inputId}">${esc(param.label)}${req}</label>`;

  if (param.description) {
    html += `<div class="hint">${esc(param.description)}</div>`;
  }

  if (param.type === 'select') {
    html += `<select id="${inputId}" onchange="setParam('${toolId}','${section}','${key}',this.value)">
      ${(param.options || []).map(o => `<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`).join('')}
    </select>`;
  } else if (param.type === 'multi_select') {
    const selected = Array.isArray(value) ? value : [];
    html += `<div class="chip-group">
      ${(param.options || []).map(o => `<button type="button" class="chip ${selected.includes(o) ? 'selected' : ''}"
        onclick="toggleMultiParam('${toolId}','${section}','${key}','${o}')">${o}</button>`).join('')}
    </div>`;
  } else if (param.type === 'password') {
    html += `<input type="password" id="${inputId}" value="${esc(value)}"
      placeholder="${esc(param.placeholder || '')}"
      onchange="setParam('${toolId}','${section}','${key}',this.value)">`;
  } else if (param.type === 'connection_picker') {
    html += `<input type="text" id="${inputId}" value="${esc(value)}"
      placeholder="Connection ID (Phase 4)"
      onchange="setParam('${toolId}','${section}','${key}',this.value)">`;
  } else {
    html += `<input type="text" id="${inputId}" value="${esc(value)}"
      placeholder="${esc(param.placeholder || '')}"
      onchange="setParam('${toolId}','${section}','${key}',this.value)">`;
  }

  html += '</div>';
  return html;
}

function setParam(toolId, section, key, value) {
  if (!state.selected[toolId]) state.selected[toolId] = { deploy_params: {}, runtime_params: {} };
  state.selected[toolId][section][key] = value;
  handleShowIf();
}

function toggleMultiParam(toolId, section, key, option) {
  if (!state.selected[toolId]) state.selected[toolId] = { deploy_params: {}, runtime_params: {} };
  const current = state.selected[toolId][section][key];
  let arr = Array.isArray(current) ? [...current] : [];

  if (arr.includes(option)) {
    arr = arr.filter(x => x !== option);
  } else {
    arr.push(option);
  }
  state.selected[toolId][section][key] = arr;
  renderStep();
}

function handleShowIf() {
  document.querySelectorAll('[data-showif-key]').forEach(el => {
    const toolId = el.dataset.showifTool;
    const section = el.dataset.showifSection;
    const condKey = el.dataset.showifKey;
    const condVal = el.dataset.showifValue;

    const currentVal = state.selected[toolId]?.[section]?.[condKey]
      ?? state.toolDetails[toolId]?.[section]?.[condKey]?.default
      ?? '';

    el.style.display = currentVal === condVal ? '' : 'none';
  });
}

/* ===== Step 3: Agent Config ===== */
function renderAgentConfig(el) {
  const toolNames = Object.keys(state.selected).map(id => {
    const d = state.toolDetails[id] || state.tools.find(t => t.id === id) || {};
    return d.name || id;
  });
  const activeParams = state.promptParams.filter(p => p.key.trim());

  el.innerHTML = `
    <h2 style="margin-bottom:16px">Agent Configuration</h2>
    <div class="card" style="margin-bottom:16px">
      <div class="form-group">
        <label for="agent-name">Agent Name *</label>
        <input type="text" id="agent-name" value="${esc(state.agentName)}"
          placeholder="e.g. my-weather-bot" maxlength="100"
          onchange="state.agentName=this.value">
      </div>
      <div class="form-group">
        <label for="agent-model">Model</label>
        <select id="agent-model" onchange="state.agentModel=this.value">
          ${['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini'].map(m =>
            `<option value="${m}" ${m === state.agentModel ? 'selected' : ''}>${m}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="agent-instructions">Instructions *</label>
        <div class="hint">Parameter values are passed as context with each chat message.</div>
        <textarea id="agent-instructions" rows="6"
          placeholder="You are a helpful assistant..."
          onchange="state.instructions=this.value">${esc(state.instructions)}</textarea>
      </div>
    </div>

    ${renderPromptParamsBuilder()}

    <div class="card">
      <h4 style="margin-bottom:12px">Summary</h4>
      <div class="summary-row"><span class="summary-label">Tools</span><span class="summary-value">${toolNames.length > 0 ? toolNames.join(', ') : 'None'}</span></div>
      <div class="summary-row"><span class="summary-label">Model</span><span class="summary-value">${esc(state.agentModel)}</span></div>
      ${activeParams.length > 0
        ? `<div class="summary-row"><span class="summary-label">Prompt Params</span><span class="summary-value">${activeParams.map(p => p.key).join(', ')}</span></div>`
        : ''}
      ${Object.keys(state.selected).map(id => {
        const params = { ...state.selected[id].deploy_params, ...state.selected[id].runtime_params };
        const paramStr = Object.entries(params).filter(([,v]) => v && (!Array.isArray(v) || v.length > 0))
          .map(([k,v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ');
        if (!paramStr) return '';
        const name = (state.toolDetails[id] || {}).name || id;
        return `<div class="summary-row"><span class="summary-label">${esc(name)}</span><span class="summary-value" style="font-size:.82rem">${esc(paramStr)}</span></div>`;
      }).join('')}
    </div>

    <div class="actions-bar">
      <button class="btn btn-secondary" onclick="goToStep(2)">Back</button>
      <button class="btn btn-primary" onclick="goToStep(4)" id="deploy-btn"
        ${!state.agentName || !state.instructions ? 'disabled' : ''}>Deploy Agent</button>
    </div>`;

  // Re-check on input
  const nameEl = document.getElementById('agent-name');
  const instrEl = document.getElementById('agent-instructions');
  const deployBtn = document.getElementById('deploy-btn');

  function checkReady() {
    state.agentName = nameEl.value;
    state.instructions = instrEl.value;
    deployBtn.disabled = !nameEl.value.trim() || !instrEl.value.trim();
  }
  nameEl.addEventListener('input', checkReady);
  instrEl.addEventListener('input', checkReady);
}

/* ===== Prompt Parameters Builder ===== */
function renderPromptParamsBuilder() {
  let html = `<div class="card" style="margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <h4>Prompt Parameters</h4>
      <button class="btn btn-secondary btn-sm" onclick="addPromptParam()">+ Add Parameter</button>
    </div>
    <p class="hint" style="margin-bottom:12px">Define parameters that users fill in before chatting. Values are sent as context with each message.</p>`;

  if (state.promptParams.length === 0) {
    html += '<p style="font-size:.85rem;color:var(--text-secondary);text-align:center;padding:12px 0">No parameters defined.</p>';
  }

  state.promptParams.forEach((p, i) => {
    const showOptions = p.type === 'select' || p.type === 'multi_select';
    html += `<div class="prompt-param-row">
      <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:8px">
        <div class="form-group" style="flex:1;margin-bottom:0">
          <label>Key *</label>
          <input type="text" value="${esc(p.key)}" placeholder="e.g. purpose"
            onchange="setPromptParam(${i},'key',this.value)">
        </div>
        <div class="form-group" style="flex:1;margin-bottom:0">
          <label>Label</label>
          <input type="text" value="${esc(p.label)}" placeholder="Display label"
            onchange="setPromptParam(${i},'label',this.value)">
        </div>
        <div class="form-group" style="width:130px;margin-bottom:0">
          <label>Type</label>
          <select onchange="setPromptParam(${i},'type',this.value)">
            <option value="string" ${p.type === 'string' ? 'selected' : ''}>string</option>
            <option value="select" ${p.type === 'select' ? 'selected' : ''}>select</option>
            <option value="multi_select" ${p.type === 'multi_select' ? 'selected' : ''}>multi_select</option>
          </select>
        </div>
        <button class="btn btn-danger btn-xs" style="margin-bottom:2px;height:38px"
          onclick="removePromptParam(${i})">&times;</button>
      </div>
      ${showOptions ? `<div style="display:flex;gap:8px;margin-bottom:8px">
        <div class="form-group" style="flex:1;margin-bottom:0">
          <label>Options (comma-separated) *</label>
          <input type="text" value="${esc((p.options || []).join(', '))}"
            placeholder="option1, option2, option3"
            onchange="setPromptParamOptions(${i},this.value)">
        </div>
        <div class="form-group" style="flex:1;margin-bottom:0">
          <label>Default</label>
          <input type="text" value="${esc(p.default)}" placeholder="Default value"
            onchange="setPromptParam(${i},'default',this.value)">
        </div>
      </div>` : `<div style="display:flex;gap:8px;margin-bottom:8px">
        <div class="form-group" style="flex:1;margin-bottom:0">
          <label>Default</label>
          <input type="text" value="${esc(p.default)}" placeholder="Default value"
            onchange="setPromptParam(${i},'default',this.value)">
        </div>
      </div>`}
      <div style="display:flex;gap:8px;align-items:flex-end">
        <div class="form-group" style="flex:1;margin-bottom:0">
          <label>Description</label>
          <input type="text" value="${esc(p.description)}" placeholder="Optional description"
            onchange="setPromptParam(${i},'description',this.value)">
        </div>
        <div class="form-group" style="flex:1;margin-bottom:0">
          <label>Placeholder</label>
          <input type="text" value="${esc(p.placeholder)}" placeholder="Input hint text"
            onchange="setPromptParam(${i},'placeholder',this.value)">
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:.85rem;margin-bottom:2px;white-space:nowrap;height:38px">
          <input type="checkbox" ${p.required ? 'checked' : ''}
            onchange="setPromptParam(${i},'required',this.checked)"> Required
        </label>
      </div>
    </div>`;
  });

  html += '</div>';
  return html;
}

function addPromptParam() {
  state.promptParams.push({
    key: '', label: '', type: 'string', options: [],
    default: '', required: false, description: '', placeholder: ''
  });
  renderStep();
}

function removePromptParam(index) {
  state.promptParams.splice(index, 1);
  renderStep();
}

function setPromptParam(index, field, value) {
  if (state.promptParams[index]) {
    state.promptParams[index][field] = value;
    if (field === 'type') renderStep();
  }
}

function setPromptParamOptions(index, value) {
  if (state.promptParams[index]) {
    state.promptParams[index].options = value.split(',').map(s => s.trim()).filter(Boolean);
  }
}

/* ===== Step 4: Deploy ===== */
async function renderDeploy(el) {
  el.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><p>Deploying agent to Azure AI Foundry...</p></div>';

  const payload = {
    name: state.agentName.trim(),
    model: state.agentModel,
    instructions: state.instructions.trim(),
    tools: Object.entries(state.selected).map(([tool_id, params]) => {
      // Merge defaults from catalog for params not explicitly set
      const detail = state.toolDetails[tool_id];
      const deployFilled = { ...params.deploy_params };
      const runtimeFilled = { ...params.runtime_params };

      if (detail) {
        for (const [k, v] of Object.entries(detail.deploy_params || {})) {
          if (deployFilled[k] === undefined && v.default !== undefined) {
            deployFilled[k] = v.default;
          }
        }
        for (const [k, v] of Object.entries(detail.runtime_params || {})) {
          if (runtimeFilled[k] === undefined && v.default !== undefined) {
            runtimeFilled[k] = v.default;
          }
        }
      }

      return { tool_id, deploy_params: deployFilled, runtime_params: runtimeFilled };
    }),
    prompt_params: state.promptParams.filter(p => p.key.trim()),
  };

  try {
    const res = await fetch(`${API}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    state.deployedAgent = await res.json();
    state.chatHistory = [];
    state.previousResponseId = null;
    state.step = 5;
    renderStep();
  } catch (err) {
    el.innerHTML = `
      <div class="empty-state">
        <h3>Deployment Failed</h3>
        <p>${esc(err.message)}</p>
        <button class="btn btn-secondary" style="margin-top:16px" onclick="goToStep(3)">Back to Config</button>
      </div>`;
  }
}

/* ===== Step 5: Chat ===== */
function getActivePromptParams() {
  if (state.promptParams.length > 0) return state.promptParams;
  return state.deployedAgent?.prompt_params || [];
}

function renderChat(el) {
  const agent = state.deployedAgent || {};
  const params = getActivePromptParams();

  // Show param form before chat if agent has prompt params and not yet confirmed
  if (params.length > 0 && !state.chatParamsConfirmed) {
    renderChatParamForm(el, agent, params);
    return;
  }

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <h2 style="margin-bottom:2px">${esc(agent.name || state.agentName)}</h2>
        <span style="font-size:.82rem;color:var(--text-secondary)">
          ${agent.version ? `v${agent.version} \u00b7 ` : ''}${agent.id ? agent.id.substring(0, 12) + '...' : ''}
        </span>
      </div>
      <span class="badge badge-builtin">Deployed</span>
    </div>

    ${renderParamSummaryBar()}

    <div class="chat-container">
      <div class="chat-messages" id="chat-messages">
        ${state.chatHistory.length === 0
          ? '<div class="empty-state" style="padding:40px"><p>Send a message to start chatting with your agent.</p></div>'
          : state.chatHistory.map(renderChatMessage).join('')}
      </div>
      <div class="chat-input-bar">
        <input type="text" id="chat-input" placeholder="Type a message..."
          onkeydown="if(event.key==='Enter')sendChat()">
        <button class="btn btn-primary" onclick="sendChat()" id="chat-send-btn">Send</button>
      </div>
    </div>

    <div class="chat-actions">
      <button class="btn btn-secondary btn-sm" onclick="updateAgent()">Update Agent</button>
      <button class="btn btn-danger btn-sm" onclick="showDeleteModal()">Delete Agent</button>
      <a href="builder.html" class="btn btn-secondary btn-sm">New Agent</a>
    </div>`;

  // Scroll to bottom
  const msgEl = document.getElementById('chat-messages');
  msgEl.scrollTop = msgEl.scrollHeight;

  // Focus input
  document.getElementById('chat-input').focus();
}

function renderChatParamForm(el, agent, params) {
  // Initialize paramValues with defaults
  for (const p of params) {
    if (state.paramValues[p.key] === undefined) {
      state.paramValues[p.key] = p.default || '';
    }
  }

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <h2 style="margin-bottom:2px">${esc(agent.name || state.agentName)}</h2>
        <span style="font-size:.82rem;color:var(--text-secondary)">
          ${agent.version ? `v${agent.version} \u00b7 ` : ''}${agent.id ? agent.id.substring(0, 12) + '...' : ''}
        </span>
      </div>
      <span class="badge badge-builtin">Deployed</span>
    </div>
    <div class="card" style="max-width:600px;margin:0 auto">
      <h4 style="margin-bottom:16px">Configure Agent Parameters</h4>
      <p class="hint" style="margin-bottom:16px">Set the parameter values before starting the conversation.</p>`;

  for (const p of params) {
    const val = state.paramValues[p.key] || '';
    const req = p.required ? ' *' : '';
    const label = p.label || p.key;

    html += '<div class="form-group">';
    html += `<label>${esc(label)}${req}</label>`;
    if (p.description) {
      html += `<div class="hint">${esc(p.description)}</div>`;
    }

    if (p.type === 'select' && p.options?.length > 0) {
      html += `<select onchange="state.paramValues['${p.key}']=this.value">
        ${p.options.map(o => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}
      </select>`;
    } else if (p.type === 'multi_select' && p.options?.length > 0) {
      const selected = val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
      html += `<div class="chip-group">
        ${p.options.map(o => `<button type="button" class="chip ${selected.includes(o) ? 'selected' : ''}"
          onclick="toggleChatParam('${p.key}','${o}')">${esc(o)}</button>`).join('')}
      </div>`;
    } else {
      html += `<input type="text" value="${esc(val)}"
        placeholder="${esc(p.placeholder || '')}"
        onchange="state.paramValues['${p.key}']=this.value">`;
    }

    html += '</div>';
  }

  html += `
      <button class="btn btn-primary" style="width:100%;margin-top:8px" onclick="confirmChatParams()">Start Chat</button>
    </div>`;

  el.innerHTML = html;
}

function toggleChatParam(key, option) {
  let val = state.paramValues[key] || '';
  let arr = val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
  if (arr.includes(option)) {
    arr = arr.filter(x => x !== option);
  } else {
    arr.push(option);
  }
  state.paramValues[key] = arr.join(', ');
  renderStep();
}

function confirmChatParams() {
  const params = getActivePromptParams();
  for (const p of params) {
    if (p.required && !state.paramValues[p.key]?.trim()) {
      alert(`"${p.label || p.key}" is required.`);
      return;
    }
  }
  state.chatParamsConfirmed = true;

  // Inject a context message showing the active parameters
  const lines = params
    .map(p => {
      const val = state.paramValues[p.key] || p.default || '';
      if (!val) return null;
      return `**${p.label || p.key}:** ${val}`;
    })
    .filter(Boolean);
  if (lines.length > 0) {
    state.chatHistory.push({
      role: 'context',
      content: 'Agent parameters set:\n' + lines.join('\n'),
    });
  }

  renderStep();
}

function editChatParams() {
  state.chatParamsConfirmed = false;
  renderStep();
}

function renderParamSummaryBar() {
  const params = getActivePromptParams();
  const activeValues = params
    .map(p => {
      const val = state.paramValues[p.key] || p.default || '';
      if (!val) return null;
      return `<span class="param-chip">${esc(p.label || p.key)}: <strong>${esc(val)}</strong></span>`;
    })
    .filter(Boolean);

  if (activeValues.length === 0) return '';

  return `<div class="param-summary-bar" id="param-summary-bar">
    <div class="param-summary-content">
      <span class="param-summary-label">Parameters:</span>
      <div class="param-summary-chips">${activeValues.join('')}</div>
    </div>
    <button class="btn btn-secondary btn-xs" onclick="editChatParams()">Edit</button>
  </div>`;
}

function renderChatMessage(msg) {
  if (msg.role === 'context') {
    return `<div class="chat-bubble context">${DOMPurify.sanitize(marked.parse(msg.content || ''))}</div>`;
  }
  let html = `<div class="chat-bubble ${msg.role}">`;
  if (msg.toolCalls && msg.toolCalls.length > 0) {
    html += `<div style="margin-bottom:6px">${msg.toolCalls.map(t => `<span class="chat-tool-badge">${esc(t)}</span>`).join('')}</div>`;
  }
  if (msg.role === 'assistant') {
    html += DOMPurify.sanitize(marked.parse(msg.content || ''));
  } else {
    html += esc(msg.content);
  }
  html += '</div>';
  return html;
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const btn = document.getElementById('chat-send-btn');
  const message = input.value.trim();
  if (!message) return;

  // Add user message
  state.chatHistory.push({ role: 'user', content: message });
  input.value = '';
  btn.disabled = true;
  renderChatMessages();

  // Show typing indicator
  const msgEl = document.getElementById('chat-messages');
  const typing = document.createElement('div');
  typing.className = 'chat-bubble assistant';
  typing.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div>';
  msgEl.appendChild(typing);
  msgEl.scrollTop = msgEl.scrollHeight;

  try {
    const res = await fetch(`${API}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_name: state.deployedAgent?.name || state.agentName,
        message,
        previous_response_id: state.previousResponseId,
        param_values: state.paramValues,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    state.previousResponseId = data.response_id;
    state.chatHistory.push({
      role: 'assistant',
      content: data.text,
      toolCalls: data.tool_calls,
    });
  } catch (err) {
    state.chatHistory.push({
      role: 'assistant',
      content: `Error: ${err.message}`,
      toolCalls: [],
    });
  }

  btn.disabled = false;
  renderChatMessages();
  document.getElementById('chat-input').focus();
}

function renderChatMessages() {
  const msgEl = document.getElementById('chat-messages');
  if (!msgEl) return;
  msgEl.innerHTML = state.chatHistory.map(renderChatMessage).join('');
  msgEl.scrollTop = msgEl.scrollHeight;
}

/* ===== Agent Actions ===== */
function updateAgent() {
  // Preserve prompt params from deployed agent if builder is empty
  if (state.deployedAgent?.prompt_params?.length > 0 && state.promptParams.length === 0) {
    state.promptParams = state.deployedAgent.prompt_params.map(p => ({...p}));
  }
  // Go back to step 1 with current config preserved
  state.step = 1;
  state.deployedAgent = null;
  state.chatHistory = [];
  state.previousResponseId = null;
  state.chatParamsConfirmed = false;
  state.paramValues = {};
  renderStep();
}

function showDeleteModal() {
  document.getElementById('modal-agent-name').textContent = state.deployedAgent?.name || state.agentName;
  document.getElementById('modal-backdrop').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-backdrop').style.display = 'none';
}

async function confirmDelete() {
  const name = state.deployedAgent?.name || state.agentName;
  const btn = document.getElementById('modal-confirm-btn');
  btn.disabled = true;
  btn.textContent = 'Deleting...';

  try {
    const res = await fetch(`${API}/api/agents/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const err = await res.json();
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
    window.location.href = 'index.html';
  } catch (err) {
    alert(`Failed to delete: ${err.message}`);
    btn.disabled = false;
    btn.textContent = 'Delete';
    closeModal();
  }
}

/* ===== Navigation ===== */
function goToStep(n) {
  // Validation before advancing
  if (n === 4) {
    state.agentName = document.getElementById('agent-name')?.value?.trim() || state.agentName;
    state.instructions = document.getElementById('agent-instructions')?.value?.trim() || state.instructions;
    if (!state.agentName || !state.instructions) return;
  }

  state.step = n;
  renderStep();
  window.scrollTo(0, 0);
}

/* ===== Utility ===== */
function esc(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}
