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

### 4. Async Trigger (HTTP Request node)

After `Format Lifestyle Shots Response`, an HTTP Request node fires a POST to:
```
POST {{ $env.N8N_LIFESTYLE_WEBHOOK_URL || 'http://localhost:5678/webhook/lifestyle-shots' }}
```

Body:
```json
{
  "message": "{{ $('Chat Webhook').item.json.body.message }}",
  "sessionId": "{{ $('Chat Webhook').item.json.body.sessionId }}"
}
```

This node is **not** in the response chain — the orchestrator returns the acknowledgement immediately without waiting for it to complete.

---

## Lifestyle Shots Workflow (`5-lifestyle-shots-agent.json`)

### Node Chain

#### 1. Chat Webhook
- `POST /webhook/lifestyle-shots`
- `responseMode: immediatelyReturns` (fire-and-forget, no response needed)
- Receives: `{ message, sessionId }`

#### 2. Parse Command (Code node)
Extracts N from the message:
```js
const match = $input.item.json.message.match(/(\d+)\s*per\s*product/i);
const n = match ? parseInt(match[1], 10) : 3;
return { json: { n } };
```

#### 3. Fetch All Products (HTTP Request)
```
GET https://<store>.myshopify.com/admin/api/2024-01/products.json
  ?fields=id,title,images
  &limit=250
```
Auth: Shopify Access Token (existing credential).

Pagination: If the response `Link` header contains `rel="next"`, a loop node fetches the next page and merges results until all products are loaded.

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

#### 7. Generate Shots Loop (Split In Batches × N + HTTP Request → fal.ai)
Creates N copies of the current product data, then for each:

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
Tracks running totals across all batches:
```js
const stats = $getWorkflowStaticData('global');
if (!stats.processed) { stats.processed = 0; stats.added = 0; stats.skipped = 0; }
if ($input.item.json.skipped) {
  stats.skipped++;
} else {
  stats.processed++;
  stats.added += n;
}
return { json: { ...stats } };
```

#### 10. Format Summary (Set node)
After all batches complete:
```
✅ {{ processed }} products processed, {{ added }} images added.
{{ skipped > 0 ? skipped + ' products skipped (no source image).' : '' }}
```

#### 11. No-op Respond
The webhook was fire-and-forget (`immediatelyReturns`). The summary is logged in the n8n execution history. The chat UI already received the acknowledgement from the orchestrator.

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
