/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
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
