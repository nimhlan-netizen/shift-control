export interface Session {
  id: string;
  name: string;
  createdAt: number;
}

const SESSIONS_KEY = 'shift_control_sessions';
const ACTIVE_KEY = 'shift_control_active_session';
/** Legacy flat key — migrated on first load if present */
const LEGACY_MESSAGES_KEY = 'shift_control_messages';

export function getMessageKey(sessionId: string) {
  return `shift_control_msgs_${sessionId}`;
}

export function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as Session[]) : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: Session[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function loadActiveSessionId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveSessionId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function newSession(name?: string): Session {
  return {
    id: Math.random().toString(36).substring(2, 15),
    name: name ?? formatSessionDate(new Date()),
    createdAt: Date.now(),
  };
}

export function formatSessionDate(d: Date): string {
  return d.toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * On first run: if the legacy flat key exists but no sessions have been
 * created yet, migrate it into a new session so history is preserved.
 */
export function migrateIfNeeded(): { sessions: Session[]; activeId: string } {
  const existing = loadSessions();
  const activeId = loadActiveSessionId();

  if (existing.length > 0 && activeId) {
    return { sessions: existing, activeId };
  }

  const session = newSession('Session 1');

  // Migrate legacy messages if present
  const legacy = localStorage.getItem(LEGACY_MESSAGES_KEY);
  if (legacy) {
    localStorage.setItem(getMessageKey(session.id), legacy);
    localStorage.removeItem(LEGACY_MESSAGES_KEY);
  }

  saveSessions([session]);
  saveActiveSessionId(session.id);
  return { sessions: [session], activeId: session.id };
}
