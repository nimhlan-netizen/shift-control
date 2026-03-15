# Personal Assistant UX Redesign

**Date:** 2026-03-15
**Status:** Approved for implementation

## Problem

The current interface presents itself as a developer command center ("Command Shift Control", "N8N_CONNECTED", "Automation Hub") rather than a personal assistant. Users must manually prefix messages with "Shopify:", "Social:", or "Media:" to route to specific agents — this is hidden complexity that is not discoverable. The sidebar is hidden on mobile, agents feel like menu items rather than team members, and there is no clear mental model for how the system works.

## Goal

Redesign Shift Control as a personal assistant interface where the user feels like they are managing a team of capable employees. The orchestrator handles routing automatically by default; users can @mention a specific agent to direct tasks explicitly.

---

## Design Decisions

### Layout: Team Bar + Full-Width Chat

- A pinned **team bar** sits between the top header and the chat area
- The team bar shows all agents as pill-shaped chips with avatar initials, name, and live status
- The chat occupies the full width below the team bar
- Sessions management + Settings move to the header

### Agent Identity & Color Palette

Each agent gets a unique color used consistently across their chip and chat responses:

| Agent | Slug | Color |
|-------|------|-------|
| Shopify Manager | `shopify` | emerald `#10b981` |
| Social Publisher | `social` | indigo `#818cf8` |
| Media Ingest | `media` | amber `#f59e0b` |
| Future agents | — | cycle through: violet `#a78bfa`, rose `#fb7185`, sky `#38bdf8`, teal `#2dd4bf` |

Each agent response shows a colored circular avatar (initial letter) + agent name label. The **Orchestrator** (when it responds directly without delegating) is represented with a neutral zinc avatar and the label "Orchestrator" — it does not appear in the team bar.

### Routing

- **Default:** User types naturally → message sent to n8n as-is → orchestrator LLM decides which agent to use → response attributed to the chosen agent via the `agent` field in the JSON response
- **Explicit:** User types `@slug` (e.g., `@shopify`) → @mention autocomplete appears → on send, the `@shopify` text is left **in the message body** sent to n8n (no payload structure change) — the orchestrator LLM reads it and routes accordingly. No backend changes required.
- The old hardcoded prefix system (`Shopify:`, `Social:`, `Media:` prepended by sidebar clicks) is removed

### @Mention Autocomplete — Canonical Format

- **Trigger:** user types `@` anywhere in the input
- **Token format:** lowercase slug, no spaces — `@shopify`, `@social`, `@media`
- **Autocomplete popup:** appears above the input, lists all agents by display name + slug
- **Selection:** keyboard (↑↓ + Enter) or click inserts the slug token at cursor, e.g. `@shopify update the price`
- **In message bubble:** the `@shopify` token is displayed as-is in the user message (not stripped)
- **Parsing on send:** if input starts with or contains `@{slug}`, set `pendingAgentName` to the matching agent for the Working status indicator. The raw message string is sent unchanged to n8n.

### Status Indicators

Agent chips in the team bar show:
- **Idle** — grey dot, chip at 60% opacity
- **Working** — colored pulsing dot, chip at full opacity, slightly highlighted background

**Working trigger:** when `isTyping` is true:
- If the message contained an `@mention`, only that agent's chip shows Working
- Otherwise, all chips show a subtle generic pulse (no single agent highlighted yet)

**Post-response highlight:** when a response arrives, the responding agent's chip flashes its highlight color for **4000ms** (matching the existing `lastActiveAgent` timeout in App.tsx), then returns to Idle.

### Header

New header layout (left → right):
1. App logo + "SHIFT CONTROL" wordmark
2. `● Connected` / `● Offline` status (plain language, no `N8N_` prefix)
3. Sessions dropdown button (history icon or "Sessions ▾")
4. Settings gear icon → opens existing `SettingsModal`

Sessions and Settings are both accessible from the header. The sidebar is removed entirely.

### Sessions Dropdown

New `SessionsDropdown` component. Preserves **all existing session management behavior**:
- New session, rename (inline edit with pencil icon), delete, switch active session
- Inline rename: pencil icon → text input → blur or Enter to commit, Escape to cancel
- Dismiss: click outside or Escape key
- Max visible height: `max-h-64` with overflow scroll for long lists
- Positioned as a dropdown from the header sessions button

### Language & Tone

| Before | After |
|--------|-------|
| `"Command Shift Control..."` | `"What would you like to do? Type @ to address a specific agent..."` |
| `"Command Center"` | removed (header shows wordmark only) |
| `"N8N_CONNECTED"` | `"Connected"` |
| `"N8N_OFFLINE"` | `"Offline"` |
| `"N8N_CHECKING"` | `"Connecting..."` |
| `"Automation Hub"` | removed |
| `"Active Agents"` | removed (replaced by team bar) |
| `"LLM Router: Online"` | removed |

### Mobile

On mobile (< `md` breakpoint):
- Team bar scrolls horizontally (no wrap, overflow-x-auto)
- Sessions + Settings accessible from header icons
- No swipe gesture (sidebar gone, no longer needed)

---

## Files Changed

| File | Action |
|------|--------|
| `src/components/TeamBar.tsx` | **New** — agent chips, status indicators |
| `src/components/SessionsDropdown.tsx` | **New** — extracted + improved from Sidebar sessions section |
| `src/components/Sidebar.tsx` | **Deleted** |
| `src/components/ChatArea.tsx` | **Modified** — avatars, attribution, placeholder, @mention logic, remove old prefix routing |
| `src/App.tsx` | **Modified** — new layout, wire TeamBar + SessionsDropdown, remove sidebar state |
| `src/index.css` | **Modified** — agent color CSS tokens |

---

## Out of Scope

- n8n workflow changes (orchestrator already handles @mention text naturally)
- Agent capability descriptions / onboarding tooltips
- Agent-specific chat channels / threads
- Real-time agent activity from backend (status is frontend-inferred only)
