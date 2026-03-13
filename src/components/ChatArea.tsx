import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Bot, User, Loader2, Menu } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agent?: string;
}

interface ChatAreaProps {
  onMenuClick: () => void;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'system',
    content: 'Shift Control initialized. All agents online. OpenRouter connected.',
    timestamp: new Date(Date.now() - 60000),
  },
  {
    id: '2',
    role: 'assistant',
    content: 'Good morning. I am ready to route your commands to the Shopify, Social Media, or Media Ingest agents. What would you like to do?',
    timestamp: new Date(Date.now() - 30000),
    agent: 'Orchestrator',
  }
];

// Generate a random session ID for this chat session to maintain context in n8n
const SESSION_ID = Math.random().toString(36).substring(2, 15);

export function ChatArea({ onMenuClick }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setIsTyping(true);

    // Prioritize local storage settings, then environment variable, fallback to localhost
    const storedWebhookUrl = localStorage.getItem('N8N_WEBHOOK_URL');
    // @ts-ignore - Vite env variables
    const webhookUrl = storedWebhookUrl || import.meta.env.VITE_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/chat';

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: SESSION_ID,
          message: userText,
          timestamp: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.output || data.message || 'Action completed successfully.',
        timestamp: new Date(),
        agent: data.agent || 'Orchestrator'
      }]);
    } catch (error) {
      console.error('Failed to send message to n8n:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: `Connection Error: Unable to reach the n8n webhook at ${webhookUrl}. Ensure your n8n container is running and the webhook is active.`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090b] relative w-full overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-[#27272a] flex items-center px-4 md:px-6 bg-[#09090b]/80 backdrop-blur-sm z-10 shrink-0">
        <button 
          onClick={onMenuClick}
          className="md:hidden p-2 mr-3 -ml-2 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-sm font-medium text-zinc-200">Command Center</h2>
        <div className="ml-auto flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
          <span className="text-xs font-mono text-zinc-400 hidden sm:inline-block">WS_CONNECTED</span>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3 md:gap-4 max-w-3xl",
              msg.role === 'user' ? "ml-auto flex-row-reverse" : "",
              msg.role === 'system' ? "mx-auto text-center" : ""
            )}
          >
            {msg.role !== 'system' && (
              <div className={cn(
                "w-8 h-8 rounded flex items-center justify-center shrink-0 mt-1",
                msg.role === 'user' ? "bg-zinc-800 text-zinc-300" : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500"
              )}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
            )}
            
            <div className={cn(
              "flex flex-col gap-1 max-w-[85%] md:max-w-full",
              msg.role === 'user' ? "items-end" : "items-start",
              msg.role === 'system' ? "items-center w-full" : ""
            )}>
              {msg.role !== 'system' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-400">
                    {msg.role === 'user' ? 'You' : msg.agent}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-600">
                    {format(msg.timestamp, 'HH:mm:ss')}
                  </span>
                </div>
              )}
              
              <div className={cn(
                "text-sm leading-relaxed break-words w-full",
                msg.role === 'user' ? "bg-zinc-800 text-zinc-100 px-4 py-2.5 rounded-2xl rounded-tr-sm" : 
                msg.role === 'system' ? "text-xs font-mono text-zinc-500 bg-zinc-900/50 px-3 py-1 rounded border border-zinc-800" :
                "text-zinc-300 bg-[#18181b] border border-[#27272a] px-4 py-2.5 rounded-2xl rounded-tl-sm"
              )}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex gap-3 md:gap-4 max-w-3xl">
            <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-1 items-start">
              <span className="text-xs font-medium text-zinc-400">System</span>
              <div className="text-sm bg-[#18181b] border border-[#27272a] px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                <span className="text-zinc-400">Processing...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 md:p-4 bg-[#09090b] shrink-0 border-t border-[#27272a] md:border-t-0">
        <form 
          onSubmit={handleSend}
          className="max-w-4xl mx-auto relative flex items-end gap-2 bg-[#18181b] border border-[#27272a] rounded-xl p-2 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all"
        >
          <button 
            type="button"
            className="p-2.5 text-zinc-400 hover:text-zinc-200 transition-colors rounded-lg hover:bg-zinc-800 shrink-0 flex items-center justify-center"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder="Command Shift Control..."
            className="w-full max-h-32 min-h-[44px] bg-transparent text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none py-3 text-sm"
            rows={1}
          />
          
          <button 
            type="submit"
            disabled={!input.trim() || isTyping}
            className="p-2.5 bg-emerald-500 text-emerald-950 hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 transition-colors rounded-lg shrink-0 flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        <div className="text-center mt-2 hidden sm:block">
          <span className="text-[10px] font-mono text-zinc-600">
            Shift Control v1.0.0 • Connected to n8n workflow engine
          </span>
        </div>
      </div>
    </div>
  );
}

