import React, { useState, useEffect } from 'react';
import { Bot, ShoppingBag, Share2, HardDrive, Settings, Activity, TerminalSquare, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  className?: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

const agents = [
  { name: 'Shopify Manager', icon: ShoppingBag, status: 'idle', id: 'shopify' },
  { name: 'Social Publisher', icon: Share2, status: 'active', id: 'social' },
  { name: 'Media Ingest', icon: HardDrive, status: 'monitoring', id: 'media' },
];

export function Sidebar({ className, isOpen, onClose, onOpenSettings }: SidebarProps) {
  const [cpuLoad, setCpuLoad] = useState(12);

  useEffect(() => {
    // Simulate dynamic CPU load
    const interval = setInterval(() => {
      setCpuLoad(prev => {
        const diff = Math.floor(Math.random() * 5) - 2; // -2 to +2
        let newLoad = prev + diff;
        if (newLoad < 5) newLoad = 5;
        if (newLoad > 95) newLoad = 95;
        return newLoad;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

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
        "fixed inset-y-0 left-0 z-50 w-72 bg-[#18181b] border-r border-[#27272a] flex flex-col h-full transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:w-64",
        isOpen ? "translate-x-0" : "-translate-x-full",
        className
      )}>
        <div className="p-4 border-b border-[#27272a] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <TerminalSquare className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h1 className="font-mono font-bold text-sm tracking-tight text-white">SHIFT_CONTROL</h1>
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

        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-4 mb-2">
            <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Active Agents</h2>
            <div className="space-y-1">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  className="w-full flex items-center gap-3 px-2 py-2.5 md:py-2 rounded-md hover:bg-zinc-800/50 transition-colors group text-left"
                >
                  <agent.icon className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200" />
                  <span className="text-sm text-zinc-300 group-hover:text-white flex-1">{agent.name}</span>
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    agent.status === 'active' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                    agent.status === 'monitoring' ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" :
                    "bg-zinc-600"
                  )} />
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 mt-8">
            <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">System Status</h2>
            <div className="bg-black/20 rounded-lg p-3 border border-zinc-800/50">
              <div className="flex items-center justify-between mb-3 md:mb-2">
                <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <Activity className="w-3 h-3" /> CPU Load
                </span>
                <span className="text-xs font-mono text-emerald-400">{cpuLoad}%</span>
              </div>
              <div className="flex items-center justify-between mb-3 md:mb-2">
                <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <HardDrive className="w-3 h-3" /> Drive Sync
                </span>
                <span className="text-xs font-mono text-amber-400">Syncing...</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <Bot className="w-3 h-3" /> LLM Router
                </span>
                <span className="text-xs font-mono text-emerald-400">Online</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#27272a] shrink-0">
          <button 
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-2 py-2.5 md:py-2 rounded-md hover:bg-zinc-800/50 transition-colors text-zinc-400 hover:text-white"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm">Settings</span>
          </button>
        </div>
      </div>
    </>
  );
}
