# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server at http://localhost:3000
npm run build      # Production build to dist/
npm run lint       # Type-check only (tsc --noEmit) — no test suite exists
npm run clean      # Remove dist/
```

There are no automated tests in this project.

## Architecture

Shift Control is a **React chat UI** (the "Command Center") that forwards messages to an **n8n workflow engine** via webhook. The UI itself contains no agent logic — all intelligence lives in n8n.

### Request flow

```
User message → ChatArea.tsx → POST to n8n webhook URL
                                    ↓
                         n8n Orchestrator workflow
                         (LLM routing via OpenRouter)
                                    ↓
                    Shopify Manager / Social Publisher / etc.
                                    ↓
              Response { output, agent } → rendered in ChatArea
```

### Configuration resolution order

The webhook URL and OpenRouter key are resolved at runtime in this order:
1. `localStorage` (`N8N_WEBHOOK_URL`, `OPENROUTER_API_KEY`) — set via the Settings modal
2. Vite env vars (`VITE_N8N_WEBHOOK_URL`, `VITE_OPENROUTER_API_KEY`) from `.env`
3. Hardcoded fallback: `http://localhost:5678/webhook/chat`

### Key files

- `src/components/ChatArea.tsx` — all message state, the `handleSend` fetch call, and session ID generation
- `src/components/SettingsModal.tsx` — persists webhook URL and API key to `localStorage`
- `src/components/Sidebar.tsx` — purely decorative agent status panel (no real backend connection)
- `src/index.css` — defines `.glass-panel` and `.glass-input` utility classes used throughout; also sets `--font-sans` (Outfit) and `--font-mono` (JetBrains Mono) via `@theme`
- `n8n-workflows/` — exportable n8n JSON blueprints; import in order (1-orchestrator → 2-shopify → 3-social)

### Styling conventions

Tailwind CSS v4 is used via `@tailwindcss/vite`. Custom theme tokens are declared in `src/index.css` under `@theme {}`. The design uses a dark glassmorphism aesthetic with emerald (`#10b981`) as the primary accent color. Use `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge) for conditional class composition.

### Deployment

The frontend is a static Nginx container (`docker-compose.yml` exposes port 3000). n8n is hosted externally (e.g., Coolify). Env vars are baked into the Vite build at Docker build time via `--build-arg`.
