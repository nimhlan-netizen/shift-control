# Personal Assistant UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Shift Control from a developer command center into a personal assistant interface where the user manages a visible team of agents, with natural language routing by default and @mention for explicit targeting.

**Architecture:** Replace the sidebar with a persistent team bar above the chat; each agent has a unique color identity used on their chip and in chat attribution. A new `SessionsDropdown` component handles session management from the header. Agent config is centralized in `src/lib/agents.ts` and shared across components.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vite 6, `cn()` from `src/lib/utils.ts`. No test framework — verification is manual via `npm run dev`.

**Spec:** `docs/superpowers/specs/2026-03-15-personal-assistant-ux-redesign.md`

---

## Chunk 1: Foundation — Agent Config, TeamBar, SessionsDropdown

### Task 1: Create central agent config

**Files:**
- Create: `src/lib/agents.ts`

- [ ] **Step 1: Create `src/lib/agents.ts`**

```typescript
export interface Agent {
  id: string;         // slug used in @mentions: 'shopify', 'social', 'media'
  name: string;       // display name: 'Shopify Manager'
  initial: string;    // avatar letter: 'S'
  color: string;      // primary hex: '#10b981'
  bgColor: string;    // translucent bg for chips/bubbles
  borderColor: string;
}

// Palette for agents added in the future (cycle through in order)
export const FUTURE_PALETTE: Pick<Agent, 'color' | 'bgColor' | 'borderColor'>[] = [
  { color: '#a78bfa', bgColor: 'rgba(167,139,250,0.12)', borderColor: 'rgba(167,139,250,0.25)' },
  { color: '#fb7185', bgColor: 'rgba(251,113,133,0.12)', borderColor: 'rgba(251,113,133,0.25)' },
  { color: '#38bdf8', bgColor: 'rgba(56,189,248,0.12)',  borderColor: 'rgba(56,189,248,0.25)'  },
  { color: '#2dd4bf', bgColor: 'rgba(45,212,191,0.12)',  borderColor: 'rgba(45,212,191,0.25)'  },
];

export const AGENTS: Agent[] = [
  {
    id: 'shopify',
    name: 'Shopify Manager',
    initial: 'S',
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.25)',
  },
  {
    id: 'social',
    name: 'Social Publisher',
    initial: 'P',
    color: '#818cf8',
    bgColor: 'rgba(129,140,248,0.12)',
    borderColor: 'rgba(129,140,248,0.25)',
  },
  {
    id: 'media',
    name: 'Media Ingest',
    initial: 'M',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.25)',
  },
];

/** Look up an agent by its slug id (case-insensitive). */
export function getAgentById(id: string): Agent | undefined {
  return AGENTS.find(a => a.id === id.toLowerCase());
}

/** Look up an agent by its display name (case-insensitive). */
export function getAgentByName(name: string): Agent | undefined {
  return AGENTS.find(a => a.name.toLowerCase() === name.toLowerCase());
}

/**
 * Parse the first @mention from message text.
 * Returns the matched Agent or undefined if no valid mention.
 * Example: "@shopify update pricing" → AGENTS[0]
 */
export function parseMentionedAgent(text: string): Agent | undefined {
  const match = text.match(/@(\w+)/);
  if (!match) return undefined;
  return getAgentById(match[1]);
}
```

- [ ] **Step 2: Add scrollbar-hide utility to `src/index.css`**

The TeamBar uses horizontal scroll. Tailwind v4 has no built-in `scrollbar-none`. Add this utility at the bottom of `src/index.css`:

```css
/* Hide scrollbar while preserving scroll behavior */
.scrollbar-none {
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agents.ts src/index.css
git commit -m "feat: add central agent config and scrollbar-none utility"
```

---

### Task 2: Create TeamBar component

**Files:**
- Create: `src/components/TeamBar.tsx`

- [ ] **Step 1: Create `src/components/TeamBar.tsx`**

```typescript
import React from 'react';
import { cn } from '../lib/utils';
import { AGENTS, type Agent } from '../lib/agents';

interface TeamBarProps {
  /** true while a fetch is in flight */
  isTyping: boolean;
  /** agent id from @mention parsing — known before response arrives */
  explicitAgentId: string | null;
  /** agent name from the response `agent` field — set for 4s after response */
  lastActiveAgentName: string | null;
}

export function TeamBar({ isTyping, explicitAgentId, lastActiveAgentName }: TeamBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-black/10 overflow-x-auto shrink-0 scrollbar-none">
      <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest shrink-0 mr-1 select-none">
        Team
      </span>

      {AGENTS.map(agent => {
        // Show this chip as "Working" only when we know the specific agent via @mention
        const isWorking = isTyping && explicitAgentId === agent.id;
        const justResponded = lastActiveAgentName === agent.name;

        return (
          <AgentChip
            key={agent.id}
            agent={agent}
            isWorking={isWorking}
            justResponded={justResponded}
          />
        );
      })}
    </div>
  );
}

function AgentChip({
  agent,
  isWorking,
  justResponded,
}: {
  agent: Agent;
  isWorking: boolean;
  justResponded: boolean;
}) {
  const active = isWorking || justResponded;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-300 shrink-0 select-none',
        active ? 'opacity-100' : 'opacity-50 hover:opacity-70'
      )}
      style={{
        backgroundColor: active ? agent.bgColor : 'transparent',
        borderColor: active ? agent.borderColor : 'rgba(255,255,255,0.06)',
      }}
    >
      {/* Avatar */}
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
        style={{
          backgroundColor: agent.bgColor,
          border: `1px solid ${agent.borderColor}`,
          color: agent.color,
        }}
      >
        {agent.initial}
      </div>

      {/* Name */}
      <span className="text-xs text-zinc-300 whitespace-nowrap leading-none">
        {agent.name}
      </span>

      {/* Status dot */}
      <span
        className={cn('w-1.5 h-1.5 rounded-full shrink-0 transition-colors', isWorking && 'animate-pulse')}
        style={{ backgroundColor: isWorking || justResponded ? agent.color : '#374151' }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TeamBar.tsx
git commit -m "feat: add TeamBar component with per-agent color chips and status indicators"
```

---

### Task 3: Create SessionsDropdown component

**Files:**
- Create: `src/components/SessionsDropdown.tsx`

- [ ] **Step 1: Verify `Session` type is exported from `src/lib/sessions.ts`**

```bash
grep "export.*Session" src/lib/sessions.ts
```

Expected: a line like `export interface Session {` or `export type Session =`. If not present, the import in SessionsDropdown will fail — check `sessions.ts` and export the type.

- [ ] **Step 2: Create `src/components/SessionsDropdown.tsx`**

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Pencil, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Session } from '../lib/sessions';

interface SessionsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  activeSessionId: string;
  onNewSession: () => void;
  onSwitchSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, name: string) => void;
}

function SessionItem({
  session,
  isActive,
  onSwitch,
  onDelete,
  onRename,
}: {
  session: Session;
  isActive: boolean;
  onSwitch: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== session.name) onRename(trimmed);
    else setDraft(session.name);
    setEditing(false);
  };

  return (
    <div
      className={cn(
        'group flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors cursor-pointer',
        isActive
          ? 'bg-emerald-500/10 border border-emerald-500/20'
          : 'hover:bg-zinc-800/50 border border-transparent'
      )}
      onClick={() => !editing && onSwitch()}
    >
      <span
        className={cn('w-1.5 h-1.5 rounded-full shrink-0', isActive ? 'bg-emerald-500' : 'bg-zinc-700')}
      />

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') { setDraft(session.name); setEditing(false); }
          }}
          onClick={e => e.stopPropagation()}
          className="flex-1 bg-transparent text-xs text-zinc-200 focus:outline-none min-w-0"
        />
      ) : (
        <span
          className={cn(
            'flex-1 text-xs truncate',
            isActive ? 'text-zinc-200' : 'text-zinc-400 group-hover:text-zinc-200'
          )}
        >
          {session.name}
        </span>
      )}

      <div
        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={e => e.stopPropagation()}
      >
        {editing ? (
          <button onClick={commitRename} className="p-0.5 text-emerald-400 hover:text-emerald-300">
            <Check className="w-3 h-3" />
          </button>
        ) : (
          <button
            onClick={() => { setDraft(session.name); setEditing(true); }}
            className="p-0.5 text-zinc-600 hover:text-zinc-300"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
        <button onClick={onDelete} className="p-0.5 text-zinc-600 hover:text-red-400">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export function SessionsDropdown({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
  onRenameSession,
}: SessionsDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Dismiss on click-outside or Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full right-0 mt-2 w-64 glass-panel border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
    >
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Sessions</span>
          <button
            onClick={() => { onNewSession(); onClose(); }}
            title="New session"
            className="p-1 text-zinc-600 hover:text-emerald-400 transition-colors rounded"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-0.5 max-h-64 overflow-y-auto pr-0.5">
          {sessions.map(s => (
            <SessionItem
              key={s.id}
              session={s}
              isActive={s.id === activeSessionId}
              onSwitch={() => { onSwitchSession(s.id); onClose(); }}
              onDelete={() => onDeleteSession(s.id)}
              onRename={name => onRenameSession(s.id, name)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/SessionsDropdown.tsx
git commit -m "feat: add SessionsDropdown with full session management (new, rename, delete, switch)"
```

---

## Chunk 2: Integration — ChatArea, App, Delete Sidebar

> **Note:** App.tsx and ChatArea.tsx must both be updated before either is committed, because App.tsx passes new props that ChatArea.tsx must accept. Complete Tasks 4 and 5 before committing either file.

### Task 4: Update ChatArea component

**Files:**
- Modify: `src/components/ChatArea.tsx`

- [ ] **Step 1: Update imports and the props interface**

Replace the import block at the top of `ChatArea.tsx` with:

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Bot, User, Loader2, Trash2, Copy, Check, Search, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, formatDistanceToNowStrict, differenceInHours } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AGENTS, getAgentByName, type Agent } from '../lib/agents';
```

Replace the `ChatAreaProps` interface with:

```typescript
interface ChatAreaProps {
  onAgentResponse: (name: string) => void;
  onConnectionChange: (status: 'online' | 'offline') => void;
  connectionStatus: 'checking' | 'online' | 'offline';
  /** Called on every send with the raw message text (for @mention detection in App) */
  onMessageSend: (text: string) => void;
  /** Called when isTyping changes, so App can reflect it in TeamBar */
  onTypingChange: (typing: boolean) => void;
  sessionId: string;
  storageKey: string;
}
```

- [ ] **Step 2: Update the function signature**

Replace:

```typescript
export function ChatArea({
  onMenuClick,
  onAgentResponse,
  onConnectionChange,
  connectionStatus,
  pendingInput,
  onPendingInputConsumed,
  onMessageSent,
  sessionId,
  storageKey,
}: ChatAreaProps) {
```

with:

```typescript
export function ChatArea({
  onAgentResponse,
  onConnectionChange,
  connectionStatus,
  onMessageSend,
  onTypingChange,
  sessionId,
  storageKey,
}: ChatAreaProps) {
```

- [ ] **Step 3: Remove the `pendingInput` sync effect**

Find and delete this entire `useEffect` block (it syncs `pendingInput` from App into the textarea):

```typescript
// Sync pendingInput from App into textarea
useEffect(() => {
  if (pendingInput) {
    setInput(pendingInput);
    onPendingInputConsumed();
    textareaRef.current?.focus();
  }
}, [pendingInput, onPendingInputConsumed]);
```

- [ ] **Step 4: Add @mention autocomplete state**

After the existing state declarations (near the top of the function body), add:

```typescript
const [mentionPopupOpen, setMentionPopupOpen] = useState(false);
const [mentionIndex, setMentionIndex] = useState(0);
```

- [ ] **Step 5: Wire `onTypingChange` — update both `setIsTyping` call sites**

There are exactly **two** `setIsTyping` calls in `ChatArea.tsx` (both inside `sendMessage`). The `catch` block does not call `setIsTyping` — the `finally` block handles cleanup. Add the paired `onTypingChange` call to each:

**In `sendMessage`, at the very start of the function body:**
```typescript
// Before:
setIsTyping(true);
// After:
setIsTyping(true); onTypingChange(true);
```

**In `sendMessage`, inside the `finally` block:**
```typescript
// Before:
setIsTyping(false);
// After:
setIsTyping(false); onTypingChange(false);
```

Confirm both are updated:
```bash
grep -n "setIsTyping" src/components/ChatArea.tsx
```
Expected: 2 matches, each paired with `onTypingChange`.

- [ ] **Step 6: Remove `pendingAgentName` state and its setter calls**

The old `handleSend` called `setPendingAgentName(...)` to track which agent was routing. This is replaced by `explicitAgentId` in `App.tsx`. Remove:

1. The state declaration (near the top of the component body):
   ```typescript
   const [pendingAgentName, setPendingAgentName] = useState('Orchestrator');
   ```
2. All `setPendingAgentName(...)` calls — there are two inside `sendMessage` (one in the streaming path, one in the JSON path). Delete both lines.

Confirm they're gone:
```bash
grep -n "pendingAgentName" src/components/ChatArea.tsx
```
Expected: no output.

- [ ] **Step 7: Update `handleSend` to remove prefix routing and add new callbacks**

> Note: `onMessageSent` (which incremented `messageCount` in App) is intentionally dropped here. `messageCount` is not used in the new App.tsx layout.

Replace the entire `handleSend` function with:

```typescript
const handleSend = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!input.trim() && !attachment) return;

  const userText = input.trim();
  const currentAttachment = attachment;

  // Notify App of the send (for @mention detection → TeamBar explicitAgentId)
  onMessageSend(userText);

  setMessages(prev => [...prev, {
    id: Date.now().toString(),
    role: 'user',
    content: userText,
    timestamp: new Date(),
    ...(currentAttachment && {
      attachment: {
        name: currentAttachment.name,
        type: currentAttachment.type,
        dataUrl: currentAttachment.dataUrl,
      }
    }),
  }]);
  setInput('');
  setMentionPopupOpen(false);
  await sendMessage(userText, currentAttachment);
};
```

- [ ] **Step 8: Add `insertMention` helper**

Add this function inside the `ChatArea` component body, just before the `return`:

```typescript
const insertMention = (agent: Agent) => {
  // Replace trailing @partial with @slug + space
  const updated = input.replace(/@(\w*)$/, `@${agent.id} `);
  setInput(updated);
  setMentionPopupOpen(false);
  textareaRef.current?.focus();
};
```

- [ ] **Step 9: Update the textarea's onChange and onKeyDown handlers**

Replace the textarea's `onChange`:

```typescript
onChange={(e) => {
  const val = e.target.value;
  setInput(val);
  // Show mention popup when text ends with @ or @partial word
  const atMatch = val.match(/@(\w*)$/);
  if (atMatch) {
    setMentionPopupOpen(true);
    setMentionIndex(0);
  } else {
    setMentionPopupOpen(false);
  }
}}
```

Replace the textarea's `onKeyDown`:

```typescript
onKeyDown={(e) => {
  if (mentionPopupOpen) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, AGENTS.length - 1)); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); insertMention(AGENTS[mentionIndex]); return; }
    if (e.key === 'Escape') { setMentionPopupOpen(false); return; }
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend(e);
  }
}}
```

- [ ] **Step 10: Update textarea placeholder**

Replace:
```typescript
placeholder="Command Shift Control..."
```
with:
```typescript
placeholder="What would you like to do? Type @ to address a specific agent..."
```

- [ ] **Step 11: Add the @mention popup JSX**

Inside the input area `<div className="relative flex items-end gap-2 ...">`, add this popup **before** the `<textarea>`:

```typescript
{/* @mention autocomplete popup */}
{mentionPopupOpen && (
  <div className="absolute bottom-full left-0 mb-2 w-56 glass-panel border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50">
    {AGENTS.map((agent, i) => (
      <button
        key={agent.id}
        type="button"
        onClick={() => insertMention(agent)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
          i === mentionIndex ? 'bg-white/10' : 'hover:bg-white/5'
        )}
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{
            backgroundColor: agent.bgColor,
            border: `1px solid ${agent.borderColor}`,
            color: agent.color,
          }}
        >
          {agent.initial}
        </div>
        <div>
          <div className="text-xs text-zinc-200">{agent.name}</div>
          <div className="text-[10px] font-mono text-zinc-500">@{agent.id}</div>
        </div>
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 12: Replace the assistant message avatar rendering**

Find the avatar `<div>` inside the messages `.map()` — the one that renders `<Bot>` or `<User>` icons. Replace it entirely:

```typescript
{msg.role !== 'system' && (
  (() => {
    if (msg.role === 'user') {
      return (
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-lg bg-gradient-to-tr from-zinc-800 to-zinc-700 text-zinc-300 border border-white/10">
          <User className="w-4 h-4" />
        </div>
      );
    }
    const agentConfig = msg.agent ? getAgentByName(msg.agent) : undefined;
    if (agentConfig) {
      return (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 text-xs font-bold"
          style={{
            backgroundColor: agentConfig.bgColor,
            border: `1px solid ${agentConfig.borderColor}`,
            color: agentConfig.color,
            boxShadow: `0 0 12px ${agentConfig.color}30`,
          }}
        >
          {agentConfig.initial}
        </div>
      );
    }
    // Fallback: Orchestrator or unknown agent
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-lg bg-zinc-800/60 border border-white/10 text-zinc-400">
        <Bot className="w-4 h-4" />
      </div>
    );
  })()
)}
```

- [ ] **Step 13: Update agent name color in message header**

Find the sender name `<span>` inside the message header and replace:

```typescript
// Before:
<span className="text-xs font-medium text-zinc-400">
  {msg.role === 'user' ? 'You' : msg.agent}
</span>

// After:
<span
  className="text-xs font-medium"
  style={{
    color: msg.role === 'user'
      ? '#a1a1aa'
      : (msg.agent ? (getAgentByName(msg.agent)?.color ?? '#a1a1aa') : '#a1a1aa')
  }}
>
  {msg.role === 'user' ? 'You' : msg.agent}
</span>
```

- [ ] **Step 14: Update the typing indicator**

> Note: The spec called for "all chips show a subtle generic pulse" when no @mention is used. This is deferred — the "Working on it..." label in the chat covers this case visually. The TeamBar only pulses a specific chip when an @mention is known.

Replace the `{isTyping && (...)}` block:

```typescript
{isTyping && (
  <div className="flex gap-3 md:gap-4 max-w-3xl">
    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 bg-zinc-800/60 border border-white/10 text-zinc-500">
      <Bot className="w-4 h-4" />
    </div>
    <div className="flex flex-col gap-1 items-start">
      <span className="text-xs font-medium text-zinc-500">Your team</span>
      <div className="text-sm glass-panel border border-white/5 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
        <span className="text-zinc-500">Working on it...</span>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 15: Replace the chat sub-header**

Replace the entire `<header>` block inside `ChatArea`'s return:

```typescript
<header className="glass-panel border-b border-white/5 z-10 shrink-0">
  <div className="h-12 flex items-center px-4 md:px-6">
    <div className="flex items-center gap-2">
      {isTyping && (
        <span className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          Working on it...
        </span>
      )}
    </div>
    <div className="ml-auto flex items-center gap-2">
      <button
        onClick={() => {
          setSearchOpen(o => {
            if (!o) setTimeout(() => searchInputRef.current?.focus(), 50);
            else setSearchQuery('');
            return !o;
          });
        }}
        title="Search messages (Ctrl+F)"
        className={cn(
          'p-1.5 transition-colors rounded-md hover:bg-zinc-800',
          searchOpen ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-300'
        )}
      >
        <Search className="w-4 h-4" />
      </button>
      <button
        onClick={handleClearHistory}
        title="Clear conversation history"
        className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors rounded-md hover:bg-zinc-800"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  </div>

  {searchOpen && (
    <div className="px-4 md:px-6 pb-3 flex items-center gap-2">
      <div className="flex-1 flex items-center gap-2 glass-input rounded-lg px-3 py-1.5 border border-white/10 focus-within:border-emerald-500/40">
        <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <input
          ref={searchInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search messages..."
          className="flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
        />
        {searchQuery && (
          <span className="text-[10px] font-mono text-zinc-500 shrink-0">
            {messages.filter(messageMatches).length} match{messages.filter(messageMatches).length !== 1 ? 'es' : ''}
          </span>
        )}
      </div>
      <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )}
</header>
```

- [ ] **Step 16: Update the initial welcome message**

Replace `INITIAL_MESSAGES`:

```typescript
const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'system',
    content: 'Session started.',
    timestamp: new Date(Date.now() - 60000),
  },
  {
    id: '2',
    role: 'assistant',
    content: "Hi! I'm ready to help. Just tell me what you'd like to do, or type @ to address a specific member of your team.",
    timestamp: new Date(Date.now() - 30000),
    agent: 'Orchestrator',
  },
];
```

---

### Task 5: Rewrite App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace the entire contents of `src/App.tsx`**

```typescript
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Settings, History, TerminalSquare } from 'lucide-react';
import { TeamBar } from './components/TeamBar';
import { ChatArea } from './components/ChatArea';
import { SessionsDropdown } from './components/SessionsDropdown';
import { SettingsModal } from './components/SettingsModal';
import { parseMentionedAgent } from './lib/agents';
import {
  type Session,
  migrateIfNeeded,
  newSession,
  saveSessions,
  saveActiveSessionId,
  getMessageKey,
} from './lib/sessions';

export default function App() {
  const [isSessionsOpen, setIsSessionsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lastActiveAgent, setLastActiveAgent] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [explicitAgentId, setExplicitAgentId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');

  useEffect(() => {
    const { sessions: s, activeId } = migrateIfNeeded();
    setSessions(s);
    setActiveSessionId(activeId);
  }, []);

  const sessionIdRef = useRef('');
  useEffect(() => {
    sessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

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

  useEffect(() => {
    probeConnection();
    const interval = setInterval(probeConnection, 30000);
    return () => clearInterval(interval);
  }, [probeConnection]);

  const handleAgentResponse = useCallback((name: string) => {
    setLastActiveAgent(name);
    setExplicitAgentId(null);
    setTimeout(() => setLastActiveAgent(null), 4000);
  }, []);

  const handleNewSession = useCallback(() => {
    const s = newSession();
    setSessions(prev => {
      const next = [s, ...prev];
      saveSessions(next);
      return next;
    });
    setActiveSessionId(s.id);
    saveActiveSessionId(s.id);
  }, []);

  const handleSwitchSession = useCallback((id: string) => {
    setActiveSessionId(id);
    saveActiveSessionId(id);
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      saveSessions(next);

      if (id === activeSessionId) {
        if (next.length > 0) {
          setActiveSessionId(next[0].id);
          saveActiveSessionId(next[0].id);
        } else {
          const fresh = newSession();
          next.push(fresh);
          saveSessions(next);
          setActiveSessionId(fresh.id);
          saveActiveSessionId(fresh.id);
        }
      }

      return next;
    });
  }, [activeSessionId]);

  const handleRenameSession = useCallback((id: string, name: string) => {
    setSessions(prev => {
      const next = prev.map(s => s.id === id ? { ...s, name } : s);
      saveSessions(next);
      return next;
    });
  }, []);

  const handleMessageSend = useCallback((text: string) => {
    const mentioned = parseMentionedAgent(text);
    setExplicitAgentId(mentioned?.id ?? null);
  }, []);

  if (!activeSessionId) return null;

  return (
    <div className="flex flex-col h-screen w-full bg-[#030303] text-zinc-100 overflow-hidden font-sans relative">
      {/* Ambient Background Orbs */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="glass-panel border-b border-white/5 z-10 shrink-0">
        <div className="h-14 flex items-center px-4 md:px-6 gap-3">
          {/* Wordmark */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-gradient-to-tr from-emerald-500/20 to-emerald-400/5 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
              <TerminalSquare className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="font-mono font-bold text-sm tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-400 select-none">
              SHIFT CONTROL
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Connection status */}
            <div className="hidden sm:flex items-center gap-1.5">
              <span className={[
                'w-1.5 h-1.5 rounded-full',
                connectionStatus === 'online'  ? 'bg-emerald-500' :
                connectionStatus === 'offline' ? 'bg-red-500' :
                'bg-amber-500 animate-pulse'
              ].join(' ')} />
              <span className={[
                'text-xs font-mono',
                connectionStatus === 'online'  ? 'text-zinc-500' :
                connectionStatus === 'offline' ? 'text-red-400' :
                'text-amber-400'
              ].join(' ')}>
                {connectionStatus === 'online'  ? 'Connected' :
                 connectionStatus === 'offline' ? 'Offline' :
                 'Connecting...'}
              </span>
            </div>

            {/* Sessions dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsSessionsOpen(o => !o)}
                title="Sessions"
                className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors rounded-md hover:bg-zinc-800"
              >
                <History className="w-4 h-4" />
              </button>
              <SessionsDropdown
                isOpen={isSessionsOpen}
                onClose={() => setIsSessionsOpen(false)}
                sessions={sessions}
                activeSessionId={activeSessionId}
                onNewSession={handleNewSession}
                onSwitchSession={handleSwitchSession}
                onDeleteSession={handleDeleteSession}
                onRenameSession={handleRenameSession}
              />
            </div>

            {/* Settings */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="Settings"
              className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors rounded-md hover:bg-zinc-800"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Team Bar */}
      <TeamBar
        isTyping={isTyping}
        explicitAgentId={explicitAgentId}
        lastActiveAgentName={lastActiveAgent}
      />

      {/* Chat */}
      <ChatArea
        key={activeSessionId}
        onAgentResponse={handleAgentResponse}
        onConnectionChange={setConnectionStatus}
        connectionStatus={connectionStatus}
        onMessageSend={handleMessageSend}
        onTypingChange={setIsTyping}
        sessionId={activeSessionId}
        storageKey={getMessageKey(activeSessionId)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          probeConnection();
        }}
      />
    </div>
  );
}
```

---

### Task 6: Verify, delete Sidebar, commit everything

**Files:**
- Delete: `src/components/Sidebar.tsx`

- [ ] **Step 1: Verify TypeScript compiles cleanly (both files)**

```bash
npm run lint
```

Expected: no errors. If there are errors, fix them before proceeding.

- [ ] **Step 2: Run dev server and do a full visual check**

```bash
npm run dev
```

Open http://localhost:3000 and verify:
- Team bar appears below the header with Shopify (emerald), Social (indigo), Media (amber) chips
- Sessions dropdown opens from the history icon (clock) in the header — full rename/delete/switch works
- Settings gear in the header opens the SettingsModal
- Connection status shows "Connected" / "Offline" (not "N8N_CONNECTED")
- Chat placeholder reads "What would you like to do?..."
- Typing `@` in the input shows the autocomplete popup with all three agents
- Arrow keys navigate the popup; Enter or click inserts `@shopify ` etc.
- Sending a message without @mention: typing indicator shows "Working on it..."
- Sending `@shopify do something`: Shopify chip shows pulsing Working state
- After a response arrives, the responding agent's chip highlights for ~4 seconds
- Agent responses show a colored letter avatar (S / P / M) matching the chip color

- [ ] **Step 3: Delete Sidebar.tsx**

```bash
git rm src/components/Sidebar.tsx
```

- [ ] **Step 4: Verify no remaining Sidebar imports**

```bash
grep -r "Sidebar" src/
```

Expected: no output.

- [ ] **Step 5: Commit all changes and push**

> Note: `git rm` in Step 3 already staged the Sidebar deletion. The `-u` flag below picks up all tracked-file changes (modifications + deletions) alongside the explicitly added files.

```bash
git add src/components/ChatArea.tsx src/App.tsx
git add -u  # picks up the staged git rm for Sidebar.tsx
git commit -m "feat: personal assistant UX — team bar, @mention autocomplete, agent avatars, plain-language status"
git push
```
