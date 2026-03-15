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
