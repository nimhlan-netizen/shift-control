import React, { useState, useEffect } from 'react';
import { X, Save, Key, Globe } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Load from local storage, fallback to environment variables
      setWebhookUrl(localStorage.getItem('N8N_WEBHOOK_URL') || import.meta.env.VITE_N8N_WEBHOOK_URL || '');
      setOpenRouterKey(localStorage.getItem('OPENROUTER_API_KEY') || import.meta.env.VITE_OPENROUTER_API_KEY || '');
      setIsSaved(false);
    }
  }, [isOpen]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('N8N_WEBHOOK_URL', webhookUrl);
    localStorage.setItem('OPENROUTER_API_KEY', openRouterKey);
    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div 
        className="bg-[#18181b] border border-[#27272a] rounded-xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#27272a] bg-[#09090b]/50">
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            Settings
          </h2>
          <button 
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="webhook" className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-500" />
                n8n Webhook URL
              </label>
              <input
                id="webhook"
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="http://localhost:5678/webhook/chat"
                className="w-full bg-[#09090b] border border-[#27272a] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-600"
              />
              <p className="text-xs text-zinc-500">The URL where Shift Control routes its requests.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="openrouter" className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-500" />
                OpenRouter API Key
              </label>
              <input
                id="openrouter"
                type="password"
                value={openRouterKey}
                onChange={(e) => setOpenRouterKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full bg-[#09090b] border border-[#27272a] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-600"
              />
              <p className="text-xs text-zinc-500">Only required if LLM routing is handled client-side.</p>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isSaved 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                  : 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
              }`}
            >
              {isSaved ? 'Settings Saved' : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
