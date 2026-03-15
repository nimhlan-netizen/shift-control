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
    initial: 'S',
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
