import React from 'react';
import { cn } from '../lib/utils';
import { AGENTS, type Agent } from '../lib/agents';

interface TeamBarProps {
  isTyping: boolean;
  explicitAgentId: string | null;
  lastActiveAgentName: string | null;
}

export function TeamBar({ isTyping, explicitAgentId, lastActiveAgentName }: TeamBarProps) {
  const isGenericWorking = isTyping && !explicitAgentId;

  return (
    <aside className="w-56 shrink-0 border-l border-white/[0.06] flex flex-col overflow-hidden bg-[#0a0e14]">
      <div className="px-4 py-3.5 border-b border-white/[0.06]">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Your Team</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {AGENTS.map(agent => {
          const isWorking = isTyping && explicitAgentId === agent.id;
          const justResponded = lastActiveAgentName === agent.name;
          return (
            <AgentCard
              key={agent.id}
              agent={agent}
              isWorking={isWorking}
              justResponded={justResponded}
              isGenericWorking={isGenericWorking}
            />
          );
        })}
      </div>
    </aside>
  );
}

function AgentCard({
  agent,
  isWorking,
  justResponded,
  isGenericWorking,
}: {
  agent: Agent;
  isWorking: boolean;
  justResponded: boolean;
  isGenericWorking: boolean;
}) {
  const active = isWorking || justResponded;
  const pulsing = isWorking || isGenericWorking;

  return (
    <div
      className={cn(
        'rounded-xl p-3 border transition-all duration-300',
        active
          ? 'border-opacity-100'
          : 'border-white/[0.06] hover:border-white/10'
      )}
      style={{
        backgroundColor: active ? agent.bgColor : 'rgba(255,255,255,0.02)',
        borderColor: active ? agent.borderColor : undefined,
      }}
    >
      <div className="flex items-center gap-2.5">
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{
            backgroundColor: agent.bgColor,
            border: `1.5px solid ${agent.borderColor}`,
            color: agent.color,
            boxShadow: active ? `0 0 14px ${agent.color}30` : 'none',
          }}
        >
          {agent.initial}
        </div>

        {/* Name + role */}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold leading-tight truncate"
            style={{ color: active ? agent.color : '#d4d4d8' }}
          >
            {agent.displayName}
          </p>
          <p className="text-[11px] text-zinc-600 leading-tight mt-0.5 truncate">{agent.role}</p>
        </div>

        {/* Status dot */}
        <span
          className={cn('w-2 h-2 rounded-full shrink-0', pulsing && 'animate-pulse')}
          style={{
            backgroundColor: isWorking
              ? agent.color
              : justResponded
              ? agent.color
              : isGenericWorking
              ? '#4b5563'
              : '#2d3139',
          }}
        />
      </div>
    </div>
  );
}
