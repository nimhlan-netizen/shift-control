/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lastActiveAgent, setLastActiveAgent] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [pendingInput, setPendingInput] = useState('');
  const [messageCount, setMessageCount] = useState(0);

  const sessionIdRef = useRef(Math.random().toString(36).substring(2, 15));

  // Probe the webhook URL on mount and every 30 s
  useEffect(() => {
    const probe = async () => {
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
    };

    probe();
    const interval = setInterval(probe, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAgentResponse = useCallback((name: string) => {
    setLastActiveAgent(name);
    setTimeout(() => setLastActiveAgent(null), 4000);
  }, []);

  const handleAgentSelect = useCallback((prefix: string) => {
    setPendingInput(prefix);
    setIsSidebarOpen(false);
  }, []);

  return (
    <div className="flex h-screen w-full bg-[#030303] text-zinc-100 overflow-hidden font-sans relative">
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
        sessionId={sessionIdRef.current}
      />
      <ChatArea
        onMenuClick={() => setIsSidebarOpen(true)}
        onAgentResponse={handleAgentResponse}
        onConnectionChange={setConnectionStatus}
        connectionStatus={connectionStatus}
        pendingInput={pendingInput}
        onPendingInputConsumed={() => setPendingInput('')}
        onMessageSent={() => setMessageCount(c => c + 1)}
        sessionId={sessionIdRef.current}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}


