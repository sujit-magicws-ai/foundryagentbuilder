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
  filter: 'all',
};

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
    <h2 style="margin-bottom:16px">Select Tools</h2>
    <div class="filter-bar">
      ${types.map(t => `<button class="chip ${state.filter === t ? 'selected' : ''}"
        onclick="setFilter('${t}')">${t === 'all' ? 'All' : t.toUpperCase()}</button>`).join('')}
    </div>
    <div class="card-grid">
      ${filtered.map(t => {
        const sel = state.selected[t.id] ? 'selected' : '';
        const badgeCls = t.type === 'openapi' ? 'badge-api' : t.type === 'mcp' ? 'badge-mcp' : 'badge-builtin';
        return `<div class="card tool-card ${sel}" onclick="toggleTool('${t.id}')">
          <div class="tool-check">\u2713</div>
          <div class="tool-header">
            <div class="tool-icon">${ICONS[t.icon] || '\uD83D\uDD27'}</div>
            <h3>${esc(t.name)}</h3>
            <span class="badge ${badgeCls}">${t.type}</span>
          </div>
          <p>${esc(t.description)}</p>
        </div>`;
      }).join('')}
    </div>
    <div class="actions-bar">
      <span style="color:var(--text-secondary);font-size:.85rem">${Object.keys(state.selected).length} tool(s) selected</span>
      <button class="btn btn-primary" onclick="goToStep(2)"
        ${Object.keys(state.selected).length === 0 ? 'disabled' : ''}>Next: Configure Parameters</button>
    </div>`;
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

/* ===== Step 2: Tool Parameters ===== */
async function renderToolParams(el) {
  const toolIds = Object.keys(state.selected);

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
        <textarea id="agent-instructions" rows="6"
          placeholder="You are a helpful assistant..."
          onchange="state.instructions=this.value">${esc(state.instructions)}</textarea>
      </div>
    </div>

    <div class="card">
      <h4 style="margin-bottom:12px">Summary</h4>
      <div class="summary-row"><span class="summary-label">Tools</span><span class="summary-value">${toolNames.join(', ')}</span></div>
      <div class="summary-row"><span class="summary-label">Model</span><span class="summary-value">${esc(state.agentModel)}</span></div>
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
function renderChat(el) {
  const agent = state.deployedAgent || {};

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

function renderChatMessage(msg) {
  let html = `<div class="chat-bubble ${msg.role}">`;
  if (msg.toolCalls && msg.toolCalls.length > 0) {
    html += `<div style="margin-bottom:6px">${msg.toolCalls.map(t => `<span class="chat-tool-badge">${esc(t)}</span>`).join('')}</div>`;
  }
  html += esc(msg.content);
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
  // Go back to step 1 with current config preserved
  state.step = 1;
  state.deployedAgent = null;
  state.chatHistory = [];
  state.previousResponseId = null;
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
  if (n === 2 && Object.keys(state.selected).length === 0) return;
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
