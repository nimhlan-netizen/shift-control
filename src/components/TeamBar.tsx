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
