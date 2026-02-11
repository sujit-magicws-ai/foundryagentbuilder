# API Changes: No-Skill Agents & Prompt Parameters

**Base URL:** `https://foundryskill-platform.azurewebsites.net`

**Live Frontend (reference):** https://foundryskill-platform.azurewebsites.net/builder.html

---

## Summary

Two changes to the Agent Builder API:

1. **Agents without tools** — `tools` is now optional (defaults to `[]`)
2. **Prompt parameters** — agents can define template variables that are resolved at chat time via `param_values`

---

## Schema: PromptParam

New object used in agent create/response:

```json
{
  "key": "purpose",
  "label": "Purpose of email",
  "type": "string",
  "options": [],
  "default": "",
  "required": true,
  "description": "What is this email about?",
  "placeholder": "e.g., Follow up on project proposal"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | yes | Unique identifier, used as the key in `param_values` dict at chat time |
| `label` | string | no | Display label for the UI (falls back to `key`) |
| `type` | string | no | `"string"` (default), `"select"`, or `"multi_select"` |
| `options` | string[] | no | Choices for `select` / `multi_select` types |
| `default` | string | no | Pre-filled default value |
| `required` | boolean | no | Whether the user must provide a value before chat |
| `description` | string | no | Help text shown below the label |
| `placeholder` | string | no | Input placeholder hint |

---

## Changed Endpoints

### 1. `POST /api/agents` — Deploy Agent

**What changed:**
- `tools` is now **optional** (defaults to `[]`) — agents can be deployed with zero tools
- New field `prompt_params` (optional, defaults to `[]`)

**Request body:**

```json
{
  "name": "email-composer",
  "model": "gpt-4.1",
  "instructions": "You are an email composer. Write well-structured emails based on the user's request and the provided parameters (purpose, style, tone).",
  "tools": [],
  "prompt_params": [
    {
      "key": "purpose",
      "label": "Purpose of email",
      "type": "string",
      "required": true,
      "description": "What is this email about?",
      "placeholder": "e.g., Follow up on project proposal"
    },
    {
      "key": "style",
      "label": "Writing style",
      "type": "select",
      "options": ["formal", "casual", "friendly"],
      "default": "formal",
      "required": true
    },
    {
      "key": "tone",
      "label": "Tone",
      "type": "select",
      "options": ["professional", "warm", "urgent"],
      "default": "professional"
    }
  ]
}
```

**Response (200):**

```json
{
  "name": "email-composer",
  "id": "email-composer:1",
  "version": 1,
  "description": "Deployed via Agent Builder Platform",
  "prompt_params": [
    { "key": "purpose", "label": "Purpose of email", "type": "string", "options": [], "default": "", "required": true, "description": "What is this email about?", "placeholder": "e.g., Follow up on project proposal" },
    { "key": "style", "label": "Writing style", "type": "select", "options": ["formal", "casual", "friendly"], "default": "formal", "required": true, "description": "", "placeholder": "" },
    { "key": "tone", "label": "Tone", "type": "select", "options": ["professional", "warm", "urgent"], "default": "professional", "required": false, "description": "", "placeholder": "" }
  ]
}
```

**Backward compatibility:** Existing requests with `"tools": [...]` and no `prompt_params` continue to work unchanged.

---

### 2. `GET /api/agents` — List Agents

**What changed:** Each agent in the response now includes `prompt_params`.

**Response (200):**

```json
[
  {
    "name": "email-composer",
    "id": "email-composer:1",
    "version": 1,
    "description": "Deployed via Agent Builder Platform",
    "prompt_params": [
      { "key": "purpose", "label": "Purpose of email", "type": "string", ... },
      { "key": "style", "label": "Writing style", "type": "select", ... }
    ]
  },
  {
    "name": "weather-bot",
    "id": "weather-bot:3",
    "version": 3,
    "description": "Deployed via Agent Builder Platform",
    "prompt_params": []
  }
]
```

**UI hint:** Use `prompt_params.length` to show a badge (e.g., "3 params") or conditionally render a parameter form.

---

### 3. `GET /api/agents/{name}` — Get Agent

**What changed:** Response now includes `prompt_params` (same shape as list).

---

### 4. `POST /api/chat` — Send Message

**What changed:** New optional field `param_values`.

**Request body:**

```json
{
  "agent_name": "email-composer",
  "message": "Write me a follow-up email",
  "previous_response_id": null,
  "param_values": {
    "purpose": "Follow up on Q4 project proposal",
    "style": "formal",
    "tone": "professional"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agent_name` | string | yes | Name of the deployed agent |
| `message` | string | yes | User's message |
| `previous_response_id` | string \| null | no | For multi-turn conversations |
| `param_values` | object | no | Key-value pairs matching the agent's `prompt_params` keys. Defaults to `{}` |

**Response (200):** Unchanged.

```json
{
  "text": "Subject: Follow-Up on Q4 Project Proposal\n\nDear ...",
  "response_id": "resp_abc123...",
  "tool_calls": []
}
```

**How it works:** When `param_values` is non-empty, the server prepends an "Agent Parameters" context block to the user message before sending to the model. The agent's stored instructions are **not modified** — parameter values are injected as context alongside the user message. There is no `{{placeholder}}` template substitution.

**Backward compatibility:** Omitting `param_values` or sending `{}` behaves exactly as before.

---

## Recommended Frontend Flow

### Agent Creation
1. Allow creating agents with **zero tools** (skip tool selection)
2. Add a **prompt parameters builder** where users define `key`, `label`, `type`, `options`, `default`, `required`, etc.
3. Instructions can reference parameter names for clarity, but there is no template substitution — values are passed as context with each chat message
4. Send `prompt_params` array in the deploy request

### Agent List / Detail
1. Read `prompt_params` from the agent response
2. Optionally show param count badge on agent cards

### Chat — Parameter Form & Visual Feedback
1. If `agent.prompt_params.length > 0`, show a **parameter form** before the first message
2. Pre-fill defaults from each param's `default` value
3. Validate `required` params before allowing chat to start
4. Send `param_values` dict with each `POST /api/chat` request
5. **Parameter Summary Bar** — After params are confirmed, show a persistent bar above the chat displaying active values as chips (e.g., `Purpose: Follow up` | `Style: formal`). Include an **Edit** button that lets the user go back and change params without redeploying.
6. **Context Bubble** — When params are confirmed, inject a visual-only "context" message as the first entry in the chat history (not sent to the API) showing "Agent parameters set:" with all key-value pairs. This gives the user a clear record of the active configuration in the conversation thread.

**Reference implementation:** https://foundryskill-platform.azurewebsites.net/builder.html — deploy an agent with prompt params and open it in chat to see both the summary bar and context bubble in action.

---

## `DELETE /api/agents/{name}`

No API contract change. Prompt params are cleaned up server-side automatically.

---

## Quick Test (curl)

```bash
# Deploy a no-tools agent with params
curl -X POST https://foundryskill-platform.azurewebsites.net/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-email-agent",
    "model": "gpt-4.1",
    "instructions": "You are an email composer. Write emails based on the user request and provided parameters.",
    "prompt_params": [
      {"key": "purpose", "label": "Purpose", "type": "string", "required": true},
      {"key": "style", "label": "Style", "type": "select", "options": ["formal","casual"], "default": "formal"}
    ]
  }'

# Chat with params
curl -X POST https://foundryskill-platform.azurewebsites.net/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "agent_name": "test-email-agent",
    "message": "Write a short thank-you note",
    "param_values": {"purpose": "Thank a colleague", "style": "casual"}
  }'

# Cleanup
curl -X DELETE https://foundryskill-platform.azurewebsites.net/api/agents/test-email-agent
```
