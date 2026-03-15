# Bug Fixes: Probe CORS / Media Routing / Missing Output Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three bugs found during automated testing: (1) the connection probe falsely shows Offline due to CORS on HEAD requests, (2) n8n's orchestrator misclassifies `Media:` messages as social intent, and (3) the orchestrator's LLM response silently drops the `output` field when JSON.parse fails on markdown-wrapped responses.

**Architecture:** Bug 3 is a one-line frontend change in `App.tsx`. Bugs 1 and 2 are both changes to the n8n orchestrator's LLM system prompt in `1-orchestrator-agent.json` — same file, combined into one task. After updating the JSON blueprint, the user re-imports it into n8n (manual step documented in each task).

**Tech Stack:** React 18, TypeScript, Vite, n8n webhook workflow (JSON blueprints), OpenRouter (LLM)

---

## Chunk 1: Frontend — Fix CORS Connection Probe

### Task 1: Change HEAD probe to POST in App.tsx

**Files:**
- Modify: `src/App.tsx:44-59` — the `probeConnection` callback

**Context:**
The current probe uses `method: 'HEAD'`. n8n's CORS policy allows `POST` from the browser but blocks `HEAD`, so every probe returns `net::ERR_FAILED` and the UI shows N8N_OFFLINE even when the webhook is reachable. Changing to `POST` with a small ping body fixes this because POST already works (verified during testing).

The logic change: any response at all (even a 4xx/5xx) means the server is reachable → `online`. Only a network-level failure (thrown exception, timeout) → `offline`.

- [ ] **Step 1: Edit the probeConnection function**

In `src/App.tsx`, replace lines 44–59:

```typescript
// BEFORE
const probeConnection = useCallback(async () => {
  // @ts-ignore
  const storedUrl = localStorage.getItem('N8N_WEBHOOK_URL');
  // @ts-ignore
  const url = storedUrl || import.meta.env.VITE_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/chat';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(url, { method: 'HEAD', signal: controller.signal });
    setConnectionStatus('online');
  } catch {
    setConnectionStatus('offline');
  } finally {
    clearTimeout(timer);
  }
}, []);
```

```typescript
// AFTER
const probeConnection = useCallback(async () => {
  // @ts-ignore
  const storedUrl = localStorage.getItem('N8N_WEBHOOK_URL');
  // @ts-ignore
  const url = storedUrl || import.meta.env.VITE_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/chat';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ ping: true }),
    });
    setConnectionStatus('online');
  } catch {
    setConnectionStatus('offline');
  } finally {
    clearTimeout(timer);
  }
}, []);
```

- [ ] **Step 2: Verify in browser**

Run `npm run dev` (or use existing dev server at `http://localhost:3000`).

Open the app. Within 2 seconds of load the header badge should turn green and show `N8N_CONNECTED`. The sidebar System Status should show **LLM Router: Online**.

If it still shows Offline, open DevTools → Network tab and verify the POST probe is returning a 200 response (not a CORS error).

- [ ] **Step 3: Run type-check**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "fix: change connection probe from HEAD to POST to avoid n8n CORS block"
```

---

## Chunk 2: n8n Blueprint — Fix Output Field + Media Routing

Both bugs share root cause in the orchestrator's LLM system prompt in `n8n-workflows/1-orchestrator-agent.json`.

**Bug 1 root cause:** The LLM is asked for JSON but sometimes wraps it in markdown code fences (` ```json ... ``` `). The n8n Set node expressions use `JSON.parse(...)` which throws on markdown-wrapped output. With `keepOnlySet: true`, a failed expression produces an empty string which is then omitted — so the response only contains `{"agent":"..."}` with no `output` field, triggering the "Action completed successfully." fallback in the UI.

**Bug 2 root cause:** The system prompt describes the four intents without examples. The LLM conflates "Media" (file ingest) with "social media" and returns `"intent": "social"` for `Media:` prefixed messages.

**Fix:** Update the system prompt in the single `OpenRouter LLM` node to:
1. Explicitly forbid markdown/code fences (fixes Bug 1)
2. Add a `Media:` prefix example and clarify "media" = file upload/ingest, not social media (fixes Bug 2)

### Task 2: Update orchestrator system prompt in the JSON blueprint

**Files:**
- Modify: `n8n-workflows/1-orchestrator-agent.json` — node `id: "openrouter-llm-node"`, the `jsonBody` parameter

- [ ] **Step 1: Replace the system prompt in the jsonBody**

In `n8n-workflows/1-orchestrator-agent.json`, find the `openrouter-llm-node` node (id `"openrouter-llm-node"`). Its `parameters.jsonBody` currently contains:

```
"You are the Orchestrator Agent for Shift Control. Classify the user's intent into one of three categories: 'shopify', 'social', 'media', or 'general'. Respond ONLY with a JSON object in this exact format: { \\\"intent\\\": \\\"<category>\\\", \\\"extracted_data\\\": \\\"<any specific details>\\\", \\\"response_message\\\": \\\"<A friendly message acknowledging the task>\\\" }"
```

Replace it with this updated system prompt (note the escaping must remain intact for JSON-in-JSON):

```
"You are the Orchestrator Agent for Shift Control, an e-commerce automation hub. Classify the user message into EXACTLY ONE of these four intents:\\n\\n- shopify: product management, inventory, orders, store updates (e.g. 'Shopify: update product description')\\n- social: social media posting, Instagram publishing, tweet drafting (e.g. 'Social: post this image')\\n- media: file ingestion, image/video upload to storage, media tagging — NOT social media (e.g. 'Media: ingest file', 'Media: upload this image')\\n- general: anything else, greetings, questions, unclear intent\\n\\nIMPORTANT: Respond with ONLY a raw JSON object. No markdown. No code fences. No backticks. No explanation. The exact format:\\n{ \\\"intent\\\": \\\"<one of: shopify|social|media|general>\\\", \\\"extracted_data\\\": \\\"<relevant details from the message>\\\", \\\"response_message\\\": \\\"<a brief friendly acknowledgement of the task, 1-2 sentences>\\\" }"
```

The full updated node `parameters.jsonBody` value (replacing the old one) is:

```json
"={\n  \"model\": \"anthropic/claude-3.5-sonnet\",\n  \"messages\": [\n    {\n      \"role\": \"system\",\n      \"content\": \"You are the Orchestrator Agent for Shift Control, an e-commerce automation hub. Classify the user message into EXACTLY ONE of these four intents:\\n\\n- shopify: product management, inventory, orders, store updates (e.g. 'Shopify: update product description')\\n- social: social media posting, Instagram publishing, tweet drafting (e.g. 'Social: post this image')\\n- media: file ingestion, image/video upload to storage, media tagging — NOT social media (e.g. 'Media: ingest file', 'Media: upload this image')\\n- general: anything else, greetings, questions, unclear intent\\n\\nIMPORTANT: Respond with ONLY a raw JSON object. No markdown. No code fences. No backticks. No explanation. The exact format:\\n{ \\\\\\\"intent\\\\\\\": \\\\\\\"<one of: shopify|social|media|general>\\\\\\\", \\\\\\\"extracted_data\\\\\\\": \\\\\\\"<relevant details from the message>\\\\\\\", \\\\\\\"response_message\\\\\\\": \\\\\\\"<a brief friendly acknowledgement of the task, 1-2 sentences>\\\\\\\" }\"\n    },\n    {\n      \"role\": \"user\",\n      \"content\": \"{{ $json.body.message }}\"\n    }\n  ]\n}"
```

- [ ] **Step 2: Run type-check to ensure the JSON file is valid**

```bash
node -e "require('./n8n-workflows/1-orchestrator-agent.json'); console.log('JSON valid')"
```

Expected output: `JSON valid`

If it prints a parse error, fix the escaping in the file.

- [ ] **Step 3: Re-import the updated workflow into n8n**

1. Open your n8n instance at `https://n8n.almostrolledit.com` (or wherever it runs)
2. Go to **Workflows** → find "Orchestrator Agent"
3. Open it → click the **⋮ menu** → **Import from file** → select `n8n-workflows/1-orchestrator-agent.json`
   - OR: delete the existing workflow and create a new one by importing the file
4. **Save** and **Activate** the workflow
5. Ensure the OpenRouter API credential is still linked to the `OpenRouter LLM` node

- [ ] **Step 4: Smoke-test Bug 1 fix — verify output field returns**

In the browser DevTools console on `http://localhost:3000`, run:

```js
fetch('https://n8n.almostrolledit.com/webhook/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId: 'test', message: 'Hello', timestamp: new Date().toISOString() })
}).then(r => r.json()).then(console.log)
```

Expected: response contains **both** `agent` and `output` fields, e.g.:
```json
{ "agent": "Orchestrator", "output": "Hello! I'm ready to help you..." }
```

If `output` is still missing, check the n8n execution log for the OpenRouter LLM node output — the LLM may still be wrapping JSON in code fences. If so, switch the model from `claude-3.5-sonnet` to `claude-3-haiku` which follows formatting instructions more strictly, or add a Code node after the LLM node to strip markdown before the JSON.parse.

- [ ] **Step 5: Smoke-test Bug 2 fix — verify Media routes correctly**

In the same DevTools console:

```js
fetch('https://n8n.almostrolledit.com/webhook/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId: 'test', message: 'Media: ingest file', timestamp: new Date().toISOString() })
}).then(r => r.json()).then(console.log)
```

Expected: `agent` field is `"Media Ingest"` (not `"Social Publisher"`).

Also test Social routing still works:

```js
fetch('https://n8n.almostrolledit.com/webhook/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId: 'test', message: 'Social: draft a tweet about our new product', timestamp: new Date().toISOString() })
}).then(r => r.json()).then(console.log)
```

Expected: `agent` is `"Social Publisher"`.

- [ ] **Step 6: End-to-end test in the UI**

1. Open `http://localhost:3000`
2. Type `Hello, what can you do?` → press Enter
3. Verify the response bubble shows actual text (not "Action completed successfully.")
4. Type `Media: I want to upload a product image` → press Enter
5. Verify the response shows agent label **Media Ingest** (not Social Publisher)

- [ ] **Step 7: Commit the blueprint**

```bash
git add n8n-workflows/1-orchestrator-agent.json
git commit -m "fix: update orchestrator prompt to prevent JSON markdown wrapping and fix media routing"
```

---

## Contingency: If LLM still wraps JSON in code fences after re-import

The n8n blueprint fix relies on prompt engineering. If the hosted LLM model continues to wrap JSON despite the `IMPORTANT` instruction, add a Code node between `OpenRouter LLM` and `Route by Intent` to strip markdown fences before parsing:

**Insert a Code node** (`n8n-nodes-base.code`) with this JavaScript:

```js
const raw = $input.item.json.choices[0].message.content.trim();
// Strip ```json ... ``` or ``` ... ``` wrappers
const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
try {
  const parsed = JSON.parse(cleaned);
  return { json: { ...parsed, _rawLlm: raw } };
} catch {
  // Fallback: return a safe general-intent response
  return { json: { intent: 'general', extracted_data: '', response_message: raw, _rawLlm: raw } };
}
```

Then update the `Route by Intent` switch node and all Format nodes to reference this Code node's output instead of `$('OpenRouter LLM').item...`.

This approach makes the intent routing resilient to any LLM output formatting.
