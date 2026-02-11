# Changes: No-Skill Agents & Prompt Parameters

## Overview

Two changes to the Agent Builder Platform:

1. **Agents without skills (tools)** - An agent may have zero tools attached
2. **Agent prompt parameters/placeholders** - Agents can define template variables in their instructions that are resolved at chat time

---

## Change 1: Agents Without Skills

### What

Currently the builder wizard assumes every agent needs at least one skill. With this change, an agent can be created with **zero tools** - it operates purely on its model + instructions.

### Example

An **Email Composer** agent needs no external tools. It takes user input (purpose, tone, style, length) and generates an email purely from its instructions and the model's capabilities.

### Impact

#### UI (Prototype)

| Area | Current Behaviour | New Behaviour |
|------|------------------|---------------|
| Step 1 (Skills) | Required step, must assign at least 1 skill | **Optional** - allow "Skip" or "No skills needed" option |
| Step 2 (Configure) | Shows assigned skills as chips | Show "No skills assigned" message if empty |
| Step 3 (Review) | Shows skill detail cards | Show "No tools" or omit skills section |
| Step 4 (Deploy) | Sends tools array in deploy payload | Send empty `tools: []` or omit tools |
| Step 5 (Chat) | Playground assumes tool-capable agent | No change needed - chat works regardless |
| Agent List | Shows tool count badge | Show "0 tools" or "No tools" badge |
| Validation | May block deploy without skills | Remove skill requirement from validation |

#### API

| Endpoint | Change |
|----------|--------|
| `POST /api/agents/deploy` | Accept empty `tools` array (currently may require at least 1) |
| `GET /api/agents` | Agent list should display correctly with 0 tools |

#### Data Model

No schema change needed. The `tools` array in `PromptAgentDefinition` already accepts an empty list.

```python
# Already valid
PromptAgentDefinition(
    model="gpt-4.1",
    instructions="You are an email composer...",
    tools=[]  # Valid - no tools
)
```

#### Azure Foundry

- `create_version()` with `tools=[]` is valid - Azure accepts agents without tools
- Portal playground works fine with no-tool agents

---

## Change 2: Agent Prompt Parameters / Placeholders

### What

Agents can define **template variables** (placeholders) in their instructions. These are filled in by the user at chat time, allowing a single agent definition to be reused for different contexts.

### Example

An Email Composer agent with these placeholders:

| Parameter | Label | Type | Options | Default |
|-----------|-------|------|---------|---------|
| `purpose` | Purpose of email | string | - | - |
| `style` | Writing style | select | formal, casual, friendly | formal |
| `tone` | Tone | select | professional, warm, urgent | professional |
| `length` | Length | select | short, medium, long | medium |

Instructions template:
```
You are an email composer. Write an email for the following purpose: {{purpose}}.

Style: {{style}}
Tone: {{tone}}
Target length: {{length}}

Compose a well-structured email based on these parameters.
```

At chat time, the user fills in these values, and the resolved instructions are sent to the model.

### Impact

#### Data Model

New field `prompt_params` on the agent definition:

```python
# New schema
{
    "agent_name": "email-composer",
    "model": "gpt-4.1",
    "instructions": "Write an email for: {{purpose}}.\nStyle: {{style}}\nTone: {{tone}}\nLength: {{length}}",
    "tools": [],
    "prompt_params": [
        {
            "key": "purpose",
            "label": "Purpose of email",
            "type": "string",          # string | select | multi_select
            "options": [],             # for select/multi_select types
            "default": "",
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
            "required": true,
            "description": "",
            "placeholder": ""
        },
        {
            "key": "tone",
            "label": "Tone",
            "type": "select",
            "options": ["professional", "warm", "urgent"],
            "default": "professional",
            "required": true,
            "description": "",
            "placeholder": ""
        },
        {
            "key": "length",
            "label": "Length",
            "type": "select",
            "options": ["short", "medium", "long"],
            "default": "medium",
            "required": false,
            "description": "",
            "placeholder": ""
        }
    ]
}
```

#### UI (Prototype)

| Area | Change |
|------|--------|
| **Step 2 (Configure)** | Add a **Prompt Parameters** section with the same parameter builder used in skill forms (add/remove rows with key, label, type, options, default, required, description, placeholder) |
| **Step 2 (Configure)** | Instructions textarea should support `{{placeholder}}` syntax with visual hints or auto-complete |
| **Step 3 (Review)** | Show prompt parameters in the review summary alongside instructions |
| **Step 5 (Chat)** | Before the first message, show a **parameter form** where the user fills in all prompt_params. Pre-fill defaults. Validate required fields. |
| **Step 5 (Chat)** | Resolve `{{placeholder}}` in instructions with user-provided values before sending to the model |
| **Agent List** | Optionally show parameter count badge (e.g., "4 params") |

#### Builder Wizard - Step 2 Changes

New section in Configure step:

```
+---------------------------------------------------+
| Prompt Parameters                                   |
| Define template variables for the agent's prompt.   |
| Use {{key}} syntax in instructions.                 |
|                                                     |
| [+ Add Parameter]                                   |
|                                                     |
| Key: [purpose    ] Label: [Purpose of email   ]    |
| Type: [string ▾] Required: [x]                     |
| Description: [What is this email about?        ]    |
| Placeholder: [e.g., Follow up on proposal      ]    |
|                                                [x]  |
|                                                     |
| Key: [style      ] Label: [Writing style      ]    |
| Type: [select ▾] Options: [formal,casual,friendly] |
| Default: [formal] Required: [x]                    |
|                                                [x]  |
+---------------------------------------------------+
```

#### Builder Wizard - Step 5 (Chat) Changes

Before chat begins, if the agent has `prompt_params`:

```
+---------------------------------------------------+
| Configure Agent Parameters                          |
|                                                     |
| Purpose of email *                                  |
| [e.g., Follow up on project proposal           ]   |
|                                                     |
| Writing style *                                     |
| [formal          ▾]                                 |
|                                                     |
| Tone *                                              |
| [professional    ▾]                                 |
|                                                     |
| Length                                              |
| [medium          ▾]                                 |
|                                                     |
| [Start Chat]                                        |
+---------------------------------------------------+
```

After "Start Chat", the instructions template is resolved:
- `{{purpose}}` -> user's input
- `{{style}}` -> "formal"
- `{{tone}}` -> "professional"
- `{{length}}` -> "medium"

The resolved instructions are sent via the API.

#### API

| Endpoint | Change |
|----------|--------|
| `POST /api/agents/deploy` | Accept `prompt_params` array in request body |
| `POST /api/agents/{name}/chat` | Accept `param_values: dict` in request body; resolve `{{placeholders}}` in instructions before calling the model |
| `GET /api/agents/{name}` | Return `prompt_params` in agent details |

#### Chat API Change Detail

```python
# Current chat request
{
    "message": "Write me a follow-up email",
    "previous_response_id": null
}

# New chat request (with param_values)
{
    "message": "Write me a follow-up email",
    "previous_response_id": null,
    "param_values": {
        "purpose": "Follow up on Q4 project proposal",
        "style": "formal",
        "tone": "professional",
        "length": "medium"
    }
}
```

Server-side resolution:
```python
instructions = agent.instructions  # "Write an email for: {{purpose}}..."
for key, value in param_values.items():
    instructions = instructions.replace(f"{{{{{key}}}}}", value)
# Send resolved instructions to model
```

#### Azure Foundry

- `prompt_params` is a **platform-level concept** - Azure Foundry does not have native support for this
- The platform stores `prompt_params` metadata alongside the agent definition
- Resolution happens server-side before calling `responses.create()`
- Option: Store `prompt_params` in agent description/metadata field, or in a separate platform database

---

## Combined Scenario

An agent can have **both changes** - zero tools AND prompt parameters:

```
Email Composer Agent
  - Model: gpt-4.1
  - Tools: [] (none)
  - Prompt params: [purpose, style, tone, length]
  - Instructions: "Write an email for: {{purpose}}..."
```

This is a valid and common use case for utility agents that don't need external data.

---

## Open Questions

1. **Storage**: Where to persist `prompt_params`? Options:
   - In Azure Foundry agent metadata/description (limited space)
   - In a separate platform-side JSON/database
   - Embedded in the instructions as a structured comment

2. **Parameter resolution timing**: Should params be resolved:
   - Once at chat start (fixed for entire conversation)?
   - Per-message (allow changing params mid-conversation)?
   - Recommendation: **Once at chat start** for simplicity

3. **Validation**: Should the platform validate that all `{{placeholders}}` in instructions have matching `prompt_params` definitions?
   - Recommendation: **Yes** - warn in Step 3 (Review) if mismatched

4. **Re-usability**: Can users save parameter presets for frequently used configurations?
   - Recommendation: **Future enhancement** - not for initial implementation

5. **Builder flow**: With skills being optional, should Step 1 (Skills) be skippable or merged into Step 2 (Configure)?
   - Recommendation: **Keep separate** with a visible "Skip - No skills needed" option

---

## Implementation Priority

| Task | Priority | Effort |
|------|----------|--------|
| Allow empty tools in builder validation | High | Low |
| Skip/optional Step 1 in wizard | High | Low |
| Prompt params builder in Step 2 | High | Medium |
| Param form in Step 5 (Chat) | High | Medium |
| Param resolution in chat API | High | Low |
| Review step updates | Medium | Low |
| `{{placeholder}}` syntax highlighting in instructions | Low | Medium |
| Parameter validation (mismatched placeholders) | Low | Low |
