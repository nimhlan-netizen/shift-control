# Lifestyle Shots Agent — Design Spec

## Goal

A new n8n workflow that retrieves all Shopify products, uses each product's existing images as input to fal.ai FLUX Kontext (image-to-image), generates N lifestyle shots per product, and uploads them back to Shopify. Triggered via chat command.

---

## Trigger

Chat command routed through the existing Shift Control orchestrator:

```
Shopify: generate lifestyle shots
Shopify: generate lifestyle shots, 5 per product
```

The orchestrator classifies this as `lifestyle_shots` intent, responds immediately with an acknowledgement, then fires the lifestyle shots workflow asynchronously via a separate POST to `/webhook/lifestyle-shots`.

**N** (images per product): parsed from the command. Defaults to 3 if not specified.

---

## Architecture

### New file
- `n8n-workflows/5-lifestyle-shots-agent.json`

### Modified file
- `n8n-workflows/1-orchestrator-agent.json`

---

## Orchestrator Changes

### 1. LLM Classification Prompt

Add `lifestyle_shots` as a fifth intent category:

```
- lifestyle_shots: bulk lifestyle photo generation for Shopify products
  (e.g. 'Shopify: generate lifestyle shots', 'Shopify: generate lifestyle shots, 5 per product')
```

### 2. New Routing Branch

Add to the `Route by Intent` Switch node: output index 4 → `Format Lifestyle Shots Response`.

### 3. Format Lifestyle Shots Response (Set node)

```json
{
  "output": "Starting lifestyle shot generation for all products. This may take a few minutes depending on catalog size.",
  "agent": "Shopify Manager"
}
```

### 4. Async Trigger (Execute Workflow node)

After `Format Lifestyle Shots Response`, an `Execute Workflow` node triggers the lifestyle shots workflow:

- **Node type:** `n8n-nodes-base.executeWorkflow`
- **Wait for sub-workflow:** `false` (fire-and-forget — orchestrator does not block on completion)
- **Workflow:** reference to `5-lifestyle-shots-agent` by ID

Pass-through data:
```json
{
  "message": "={{ $('Chat Webhook').item.json.body.message }}",
  "sessionId": "={{ $('Chat Webhook').item.json.body.sessionId }}"
}
```

Setting `waitForSubWorkflow: false` is what makes this non-blocking. The orchestrator's response chain returns the acknowledgement from `Format Lifestyle Shots Response` immediately; the sub-workflow executes independently in n8n's queue.

---

## Lifestyle Shots Workflow (`5-lifestyle-shots-agent.json`)

### Node Chain

#### 1. Execute Workflow Trigger
- Triggered by the orchestrator's `Execute Workflow` node (not a webhook)
- Node type: `n8n-nodes-base.executeWorkflowTrigger`
- Receives: `{ message, sessionId }`

#### 2. Parse Command (Code node)
Extracts N from the message:
```js
const match = $input.item.json.message.match(/(\d+)\s*per\s*product/i);
const n = match ? parseInt(match[1], 10) : 3;
return { json: { n } };
```

#### 3. Fetch All Products (HTTP Request + pagination loop)

**3a. Fetch Page** (HTTP Request node):
```
GET https://<store>.myshopify.com/admin/api/2024-01/products.json
  ?fields=id,title,images
  &limit=250
  &page_info={{ $json.nextPageInfo || '' }}
```
Auth: Shopify Access Token.

**3b. Has Next Page?** (IF node):
Condition: `{{ $response.headers['link']?.includes('rel="next"') }}`
- **True** → extract `page_info` token from the `Link` header using a Code node, loop back to 3a
- **False** → proceed with all collected products

**3c. Merge Pages** (Merge node, `mergeByIndex` mode): Combines all product arrays from each page fetch into a single list before passing to the Split In Batches node.

This three-node pattern (Fetch → Check → Merge) repeats until the `Link` header has no `rel="next"` cursor.

#### 4. Split In Batches
Processes one product at a time to respect Shopify and fal.ai API rate limits.

#### 5. Has Image? (IF node)
Condition: `{{ $json.images.length > 0 }}`
- **True** → proceed to scene prompt generation
- **False** → skip to `Log Skip` Set node (`{ skipped: true, reason: "no source image" }`)

#### 6. Generate Scene Prompt (HTTP Request → OpenRouter, Claude Haiku)
```json
{
  "model": "anthropic/claude-haiku-4-5",
  "messages": [
    {
      "role": "system",
      "content": "You are a product photography prompt writer. Given a product title, write a single lifestyle photography prompt (max 30 words). Focus on the product in use, natural setting, editorial style. Output ONLY the prompt text, no quotes, no explanation."
    },
    {
      "role": "user",
      "content": "Product: {{ $json.title }}"
    }
  ]
}
```
Returns a plain-text prompt, e.g.: `"person wearing the jacket outdoors in autumn forest, natural light, editorial fashion photography, clean background"`

#### 7. Generate Shots Loop (Code node → Split In Batches → HTTP Request → fal.ai)

**7a. Create N Items** (Code node): Returns an array of N identical items, each carrying the product ID, image URL, and generated prompt:
```js
const items = [];
const n = $('Parse Command').first().json.n;
const product = $input.item.json;
const prompt = $('Generate Scene Prompt').item.json.choices[0].message.content;
for (let i = 0; i < n; i++) {
  items.push({ json: { productId: product.id, imageUrl: product.images[0].src, prompt, shotIndex: i } });
}
return items;
```

**7b. Split In Batches** (batchSize: 1): Iterates over the N items one at a time.

**7c. HTTP Request → fal.ai FLUX Kontext**: For each item:

```
POST https://fal.run/fal-ai/flux-pro/kontext
Authorization: Key {{ $env.FAL_KEY }}
Content-Type: application/json

{
  "image_url": "{{ $json.images[0].src }}",
  "prompt": "{{ $('Generate Scene Prompt').item.json.choices[0].message.content }}",
  "num_inference_steps": 28,
  "image_size": "square_hd"
}
```

Response: `{ "images": [{ "url": "...", "width": 1024, "height": 1024 }] }`

Collects all N image URLs for the current product.

#### 8. Upload to Shopify (HTTP Request loop)
For each generated image URL, calls the Shopify GraphQL Admin API:

```graphql
mutation productCreateMedia($media: [CreateMediaInput!]!, $productId: ID!) {
  productCreateMedia(media: $media, productId: $productId) {
    media {
      mediaContentType
      status
    }
    userErrors {
      field
      message
    }
  }
}
```

Variables:
```json
{
  "productId": "gid://shopify/Product/{{ $json.id }}",
  "media": [
    {
      "alt": "Lifestyle shot",
      "mediaContentType": "IMAGE",
      "originalSource": "{{ generatedImageUrl }}"
    }
  ]
}
```

#### 9. Aggregate Results (Code node)
Collects per-product results after all Split In Batches iterations complete. Uses a running tally via workflow static data, **reset at the start of each execution** (in Parse Command, step 2):

```js
// In Parse Command (step 2), add reset:
const stats = $getWorkflowStaticData('global');
stats.processed = 0; stats.added = 0; stats.skipped = 0;

// In Aggregate Results (step 9):
const stats = $getWorkflowStaticData('global');
if ($input.item.json.skipped) {
  stats.skipped++;
} else {
  stats.processed++;
  stats.added += $input.item.json.imagesAdded ?? 0;
}
return { json: { processed: stats.processed, added: stats.added, skipped: stats.skipped } };
```

Resetting in step 2 ensures concurrent or back-to-back runs start with clean counters.

#### 10. Format Summary (Set node)
After all batches complete:
```
✅ {{ processed }} products processed, {{ added }} images added.
{{ skipped > 0 ? skipped + ' products skipped (no source image).' : '' }}
```

#### 11. No-op Respond
The workflow was triggered via `Execute Workflow` with `waitForSubWorkflow: false`. The summary is logged in the n8n execution history. The chat UI already received the acknowledgement from the orchestrator.

---

## API Credentials Required

| Service | Credential | Used In |
|---|---|---|
| Shopify | `Shopify Access Token` (existing) | Fetch products, upload media |
| OpenRouter | `OpenRouter API Key` (existing) | Scene prompt generation (Haiku) |
| fal.ai | `FAL_KEY` (existing) | FLUX Kontext image-to-image |

No new credentials needed — all three are already used in existing workflows.

---

## Error Handling

| Failure Point | Behavior |
|---|---|
| Product has no images | Skip product, increment `skipped` counter |
| fal.ai call fails | Log error for that product, continue to next |
| Shopify upload fails | Log `userErrors`, continue to next image |
| OpenRouter call fails | Use fallback prompt: `"product lifestyle photography, natural light, editorial style"` |
| Shopify pagination fails | Halt workflow, log error |

---

## Out of Scope

- Streaming progress to the chat UI (summary-at-end is sufficient)
- Deleting or replacing existing images
- Per-product style customisation
- Scheduling / cron triggers
- Choosing which product image to use as source (always uses `images[0].src`)
