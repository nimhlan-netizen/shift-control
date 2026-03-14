import React, { useState, useRef, useEffect } from 'react';
import { Bot, ShoppingBag, Share2, HardDrive, Settings, TerminalSquare, X, Plus, Trash2, Pencil, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Session } from '../lib/sessions';

interface SidebarProps {
  className?: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  lastActiveAgent: string | null;
  connectionStatus: 'checking' | 'online' | 'offline';
  onAgentSelect: (prefix: string) => void;
  messageCount: number;
  sessionId: string;
  sessions: Session[];
  activeSessionId: string;
  onNewSession: () => void;
  onSwitchSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, name: string) => void;
}

const AGENTS = [
  { name: 'Shopify Manager', icon: ShoppingBag, id: 'shopify', prefix: 'Shopify: ' },
  { name: 'Social Publisher', icon: Share2, id: 'social', prefix: 'Social: ' },
  { name: 'Media Ingest', icon: HardDrive, id: 'media', prefix: 'Media: ' },
];

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
        isActive ? 'bg-emerald-500/10 border border-emerald-500/20' : 'hover:bg-zinc-800/50 border border-transparent'
      )}
      onClick={() => !editing && onSwitch()}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', isActive ? 'bg-emerald-500' : 'bg-zinc-700')} />

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
        <span className={cn('flex-1 text-xs truncate', isActive ? 'text-zinc-200' : 'text-zinc-400 group-hover:text-zinc-200')}>
          {session.name}
        </span>
      )}

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
        {editing ? (
          <button onClick={commitRename} className="p-0.5 text-emerald-400 hover:text-emerald-300">
            <Check className="w-3 h-3" />
          </button>
        ) : (
          <button onClick={() => { setDraft(session.name); setEditing(true); }} className="p-0.5 text-zinc-600 hover:text-zinc-300">
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

export function Sidebar({
  className,
  isOpen,
  onClose,
  onOpenSettings,
  lastActiveAgent,
  connectionStatus,
  onAgentSelect,
  messageCount,
  sessionId,
  sessions,
  activeSessionId,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
  onRenameSession,
}: SidebarProps) {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 glass-panel border-r border-white/5 flex flex-col h-full transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:w-64",
        isOpen ? "translate-x-0" : "-translate-x-full",
        className
      )}>
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500/20 to-emerald-400/5 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
              <TerminalSquare className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-mono font-bold text-sm tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-400">SHIFT_CONTROL</h1>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Automation Hub</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-2 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Sessions */}
          <div className="px-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Sessions</h2>
              <button
                onClick={onNewSession}
                title="New session"
                className="p-1 text-zinc-600 hover:text-emerald-400 transition-colors rounded"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-0.5 max-h-48 overflow-y-auto pr-0.5">
              {sessions.map(s => (
                <SessionItem
                  key={s.id}
                  session={s}
                  isActive={s.id === activeSessionId}
                  onSwitch={() => onSwitchSession(s.id)}
                  onDelete={() => onDeleteSession(s.id)}
                  onRename={name => onRenameSession(s.id, name)}
                />
              ))}
            </div>
          </div>

          {/* Active Agents */}
          <div className="px-4">
            <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Active Agents</h2>
            <div className="space-y-1">
              {AGENTS.map((agent) => {
                const isActive = lastActiveAgent === agent.name;
                return (
                  <button
                    key={agent.id}
                    onClick={() => onAgentSelect(agent.prefix)}
                    className="w-full flex items-center gap-3 px-2 py-2.5 md:py-2 rounded-md hover:bg-zinc-800/50 transition-colors group text-left"
                  >
                    <agent.icon className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200" />
                    <span className="text-sm text-zinc-300 group-hover:text-white flex-1">{agent.name}</span>
                    <span className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      isActive
                        ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                        : "bg-zinc-600"
                    )} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* System Status */}
          <div className="px-4">
            <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">System Status</h2>
            <div className="glass-input rounded-xl p-3 border border-white/5">
              <div className="flex items-center justify-between mb-3 md:mb-2">
                <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <TerminalSquare className="w-3 h-3" /> Session ID
                </span>
                <span className="text-xs font-mono text-zinc-500">{sessionId.slice(0, 8)}</span>
              </div>
              <div className="flex items-center justify-between mb-3 md:mb-2">
                <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <Bot className="w-3 h-3" /> Messages
                </span>
                <span className="text-xs font-mono text-zinc-400">{messageCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <Bot className="w-3 h-3" /> LLM Router
                </span>
                <span className={cn(
                  "text-xs font-mono",
                  connectionStatus === 'online' ? "text-emerald-400" :
                  connectionStatus === 'offline' ? "text-red-400" :
                  "text-amber-400"
                )}>
                  {connectionStatus === 'online' ? 'Online' :
                   connectionStatus === 'offline' ? 'Offline' :
                   'Checking...'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/5 shrink-0">
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-2 py-2.5 md:py-2 rounded-md hover:bg-white/5 transition-colors text-zinc-400 hover:text-white"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm">Settings</span>
          </button>
        </div>
      </div>
    </>
  );
}
