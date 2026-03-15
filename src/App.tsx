/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';
import {
  type Session,
  migrateIfNeeded,
  newSession,
  saveSessions,
  saveActiveSessionId,
  getMessageKey,
} from './lib/sessions';

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lastActiveAgent, setLastActiveAgent] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [pendingInput, setPendingInput] = useState('');
  const [messageCount, setMessageCount] = useState(0);

  // Sessions
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');

  // Initialise sessions from localStorage (with legacy migration)
  useEffect(() => {
    const { sessions: s, activeId } = migrateIfNeeded();
    setSessions(s);
    setActiveSessionId(activeId);
  }, []);

  const sessionIdRef = useRef('');
  useEffect(() => {
    sessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Probe the webhook URL — called on mount, every 30 s, and after settings save
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
    setTimeout(() => setLastActiveAgent(null), 4000);
  }, []);

  const handleAgentSelect = useCallback((prefix: string) => {
    setPendingInput(prefix);
    setIsSidebarOpen(false);
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
    setMessageCount(0);
    setIsSidebarOpen(false);
  }, []);

  const handleSwitchSession = useCallback((id: string) => {
    setActiveSessionId(id);
    saveActiveSessionId(id);
    setMessageCount(0);
    setIsSidebarOpen(false);
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      saveSessions(next);

      // If we deleted the active session, switch to the first remaining one
      // (or create a brand-new session if none left)
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
        setMessageCount(0);
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

  // Swipe-to-open sidebar on mobile (swipe right from left edge)
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const x = e.touches[0].clientX;
    // Only track swipes starting within 30 px of the left edge
    if (x < 30) touchStartX.current = x;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta > 60) setIsSidebarOpen(true);
    touchStartX.current = null;
  }, []);

  // Don't render until sessions are ready
  if (!activeSessionId) return null;

  return (
    <div
      className="flex h-screen w-full bg-[#030303] text-zinc-100 overflow-hidden font-sans relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Ambient Background Orbs */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        lastActiveAgent={lastActiveAgent}
        connectionStatus={connectionStatus}
        onAgentSelect={handleAgentSelect}
        messageCount={messageCount}
        sessionId={activeSessionId}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewSession={handleNewSession}
        onSwitchSession={handleSwitchSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
      />
      <ChatArea
        key={activeSessionId}
        onMenuClick={() => setIsSidebarOpen(true)}
        onAgentResponse={handleAgentResponse}
        onConnectionChange={setConnectionStatus}
        connectionStatus={connectionStatus}
        pendingInput={pendingInput}
        onPendingInputConsumed={() => setPendingInput('')}
        onMessageSent={() => setMessageCount(c => c + 1)}
        sessionId={activeSessionId}
        storageKey={getMessageKey(activeSessionId)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          // Re-probe immediately so the status badge reflects the new URL
          probeConnection();
        }}
      />
    </div>
  );
}
