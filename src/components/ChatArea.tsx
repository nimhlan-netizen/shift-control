import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Bot, User, Loader2, Trash2, Copy, Check, Search, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, formatDistanceToNowStrict, differenceInHours } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AGENTS, getAgentByName, type Agent } from '../lib/agents';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agent?: string;
  attachment?: { name: string; type: string; dataUrl: string };
}

interface Attachment {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

interface ChatAreaProps {
  onAgentResponse: (name: string) => void;
  onConnectionChange: (status: 'online' | 'offline') => void;
  connectionStatus: 'checking' | 'online' | 'offline';
  /** Called on every send with the raw message text (for @mention detection in App) */
  onMessageSend: (text: string) => void;
  /** Called when isTyping changes, so App can reflect it in TeamBar */
  onTypingChange: (typing: boolean) => void;
  sessionId: string;
  storageKey: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'system',
    content: 'Session started.',
    timestamp: new Date(Date.now() - 60000),
  },
  {
    id: '2',
    role: 'assistant',
    content: "Hi! I'm ready to help. Just tell me what you'd like to do, or type @ to address a specific member of your team.",
    timestamp: new Date(Date.now() - 30000),
    agent: 'Orchestrator',
  },
];

function loadMessages(storageKey: string): Message[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return INITIAL_MESSAGES;
    const parsed = JSON.parse(raw) as Array<Omit<Message, 'timestamp'> & { timestamp: string }>;
    return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return INITIAL_MESSAGES;
  }
}

export function ChatArea({
  onAgentResponse,
  onConnectionChange,
  connectionStatus,
  onMessageSend,
  onTypingChange,
  sessionId,
  storageKey,
}: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>(() => loadMessages(storageKey));
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [errorToast, setErrorToast] = useState<{ message: string; retryPayload: { text: string; att: Attachment | null } } | null>(null);
  const [mentionPopupOpen, setMentionPopupOpen] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Persist messages to localStorage (per-session key)
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  const handleClearHistory = () => {
    setMessages(INITIAL_MESSAGES);
  };

  const dismissToast = () => {
    setErrorToast(null);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  };

  const showError = (message: string, retryPayload: { text: string; att: Attachment | null }) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setErrorToast({ message, retryPayload });
    toastTimerRef.current = setTimeout(dismissToast, 6000);
  };

  // Tick every 30 s to refresh relative timestamps
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleClearHistory();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      showError(
        `File too large (${mb} MB). Maximum attachment size is 10 MB.`,
        { text: '', att: null }
      );
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const sendMessage = async (userText: string, currentAttachment: Attachment | null) => {
    setIsTyping(true); onTypingChange(true);

    // Prioritize local storage settings, then environment variable, fallback to localhost
    const storedWebhookUrl = localStorage.getItem('N8N_WEBHOOK_URL');
    // @ts-ignore - Vite env variables
    const webhookUrl = storedWebhookUrl || import.meta.env.VITE_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/chat';

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: userText,
          timestamp: new Date().toISOString(),
          ...(currentAttachment && { attachment: currentAttachment }),
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('text/event-stream') && response.body) {
        // — Streaming path —
        const msgId = (Date.now() + 1).toString();
        let agentName = 'Orchestrator';

        // Insert an empty assistant message to stream into
        setMessages(prev => [...prev, {
          id: msgId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          agent: agentName,
        }]);
        setIsTyping(false); onTypingChange(false);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE lines
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (raw === '[DONE]') break;
            try {
              const parsed = JSON.parse(raw);
              const token: string = parsed.token ?? parsed.output ?? parsed.message ?? '';
              if (parsed.agent) agentName = parsed.agent;
              if (token) {
                setMessages(prev => prev.map(m =>
                  m.id === msgId ? { ...m, content: m.content + token, agent: agentName } : m
                ));
              }
            } catch {
              // Plain-text chunk (non-JSON SSE)
              if (raw) {
                setMessages(prev => prev.map(m =>
                  m.id === msgId ? { ...m, content: m.content + raw } : m
                ));
              }
            }
          }
        }

        onAgentResponse(agentName);
        onConnectionChange('online');
      } else {
        // — Standard JSON path (fallback) —
        const data = await response.json();
        const agentName = data.agent || 'Orchestrator';

        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.output || data.message || 'Action completed successfully.',
          timestamp: new Date(),
          agent: agentName,
        }]);

        onAgentResponse(agentName);
        onConnectionChange('online');
      }
    } catch (error) {
      console.error('Failed to send message to n8n:', error);
      showError(
        `Cannot reach n8n webhook. Check your settings or ensure n8n is running.`,
        { text: userText, att: currentAttachment }
      );
      onConnectionChange('offline');
    } finally {
      setIsTyping(false); onTypingChange(false);
      setAttachment(null);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !attachment) return;

    const userText = input.trim();
    const currentAttachment = attachment;

    // Notify App of the send (for @mention detection → TeamBar explicitAgentId)
    onMessageSend(userText);

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: new Date(),
      ...(currentAttachment && {
        attachment: {
          name: currentAttachment.name,
          type: currentAttachment.type,
          dataUrl: currentAttachment.dataUrl,
        }
      }),
    }]);
    setInput('');
    setMentionPopupOpen(false);
    await sendMessage(userText, currentAttachment);
  };

  const searchLower = searchQuery.trim().toLowerCase();

  const messageMatches = (msg: Message) => {
    if (!searchLower) return true;
    return msg.content.toLowerCase().includes(searchLower) ||
      (msg.agent?.toLowerCase().includes(searchLower) ?? false);
  };

  /** Wrap matched substrings in a <mark> span */
  const highlight = (text: string) => {
    if (!searchLower) return text;
    const idx = text.toLowerCase().indexOf(searchLower);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-emerald-500/30 text-emerald-200 rounded px-0.5">{text.slice(idx, idx + searchLower.length)}</mark>
        {highlight(text.slice(idx + searchLower.length))}
      </>
    );
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 60000) return 'just now';
    if (differenceInHours(now, date) < 1) return formatDistanceToNowStrict(date, { addSuffix: true });
    return format(date, 'HH:mm');
  };

  const handleRetry = async () => {
    if (!errorToast) return;
    const { text, att } = errorToast.retryPayload;
    dismissToast();
    onMessageSend(text);
    await sendMessage(text, att);
  };

  const insertMention = (agent: Agent) => {
    // Replace trailing @partial with @slug + space
    const updated = input.replace(/@(\w*)$/, `@${agent.id} `);
    setInput(updated);
    setMentionPopupOpen(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0d1117] relative overflow-hidden">
      {/* Header */}
      <header className="border-b border-white/[0.06] shrink-0 bg-[#0d1117]">
        <div className="h-12 flex items-center px-5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-200">Team</span>
            {isTyping && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-500 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                Working on it...
              </span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => {
                setSearchOpen(o => {
                  if (!o) setTimeout(() => searchInputRef.current?.focus(), 50);
                  else setSearchQuery('');
                  return !o;
                });
              }}
              title="Search messages"
              className={cn(
                'p-1.5 transition-colors rounded-md',
                searchOpen ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-300 hover:bg-white/5'
              )}
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={handleClearHistory}
              title="Clear conversation"
              className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors rounded-md hover:bg-white/5"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="px-4 md:px-6 pb-3 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 glass-input rounded-lg px-3 py-1.5 border border-white/10 focus-within:border-emerald-500/40">
              <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
              />
              {searchQuery && (
                <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                  {messages.filter(messageMatches).length} match{messages.filter(messageMatches).length !== 1 ? 'es' : ''}
                </span>
              )}
            </div>
            <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3 md:gap-4 max-w-3xl group transition-opacity",
              msg.role === 'user' ? "ml-auto flex-row-reverse" : "",
              msg.role === 'system' ? "mx-auto text-center" : "",
              searchLower && !messageMatches(msg) ? "opacity-20" : ""
            )}
          >
            {msg.role !== 'system' && (
              (() => {
                if (msg.role === 'user') {
                  return (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-lg bg-gradient-to-tr from-zinc-800 to-zinc-700 text-zinc-300 border border-white/10">
                      <User className="w-4 h-4" />
                    </div>
                  );
                }
                const agentConfig = msg.agent ? getAgentByName(msg.agent) : undefined;
                if (agentConfig) {
                  return (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 text-xs font-bold"
                      style={{
                        backgroundColor: agentConfig.bgColor,
                        border: `1px solid ${agentConfig.borderColor}`,
                        color: agentConfig.color,
                        boxShadow: `0 0 12px ${agentConfig.color}30`,
                      }}
                    >
                      {agentConfig.initial}
                    </div>
                  );
                }
                // Fallback: Orchestrator or unknown agent
                return (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-lg bg-zinc-800/60 border border-white/10 text-zinc-400">
                    <Bot className="w-4 h-4" />
                  </div>
                );
              })()
            )}

            <div className={cn(
              "flex flex-col gap-1 max-w-[85%] md:max-w-full",
              msg.role === 'user' ? "items-end" : "items-start",
              msg.role === 'system' ? "items-center w-full" : ""
            )}>
              {msg.role !== 'system' && (
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-medium"
                    style={{
                      color: msg.role === 'user'
                        ? '#a1a1aa'
                        : (msg.agent ? (getAgentByName(msg.agent)?.color ?? '#a1a1aa') : '#a1a1aa')
                    }}
                  >
                    {msg.role === 'user' ? 'You' : msg.agent}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-600" title={format(msg.timestamp, 'HH:mm:ss dd/MM/yyyy')}>
                    {formatTimestamp(msg.timestamp)}
                  </span>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                        setCopiedId(msg.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      title="Copy message"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-zinc-600 hover:text-zinc-300 rounded"
                    >
                      {copiedId === msg.id
                        ? <Check className="w-3 h-3 text-emerald-400" />
                        : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              )}

              {msg.attachment && (
                <div className="mb-1.5 max-w-[260px]">
                  {msg.attachment.type.startsWith('image/') ? (
                    <img
                      src={msg.attachment.dataUrl}
                      alt={msg.attachment.name}
                      className="rounded-xl rounded-tr-sm border border-white/10 object-cover max-h-48 w-full"
                    />
                  ) : (
                    <div className="flex items-center gap-2 glass-input px-3 py-2 rounded-xl border border-white/10 text-xs text-zinc-300">
                      <Paperclip className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="font-mono truncate">{msg.attachment.name}</span>
                    </div>
                  )}
                </div>
              )}
              {(msg.content || msg.role !== 'user') && <div className={cn(
                "text-sm leading-relaxed break-words w-full shadow-sm transition-all hover:shadow-md",
                msg.role === 'user' ? "bg-gradient-to-tr from-zinc-800 to-zinc-700/80 text-zinc-100 px-4 py-3 rounded-2xl rounded-tr-sm border border-white/5" :
                msg.role === 'system' ? "text-xs font-mono text-zinc-500 glass-panel px-3 py-1.5 rounded-full border border-white/5 inline-block" :
                "text-zinc-200 glass-panel px-4 py-3 rounded-2xl rounded-tl-sm border border-white/5"
              )}>
                {msg.role === 'assistant' ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="text-zinc-300">{children}</li>,
                      code: ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) =>
                        inline
                          ? <code className="font-mono text-xs bg-zinc-800 text-emerald-300 px-1.5 py-0.5 rounded">{children}</code>
                          : <code className="block font-mono text-xs text-emerald-300 overflow-x-auto whitespace-pre">{children}</code>,
                      pre: ({ children }) => {
                        const CodeBlockCopy = () => {
                          const [copied, setCopied] = React.useState(false);
                          const extractText = (node: React.ReactNode): string => {
                            if (typeof node === 'string') return node;
                            if (Array.isArray(node)) return node.map(extractText).join('');
                            if (React.isValidElement(node)) return extractText((node.props as { children?: React.ReactNode }).children);
                            return '';
                          };
                          const text = extractText(children);
                          return (
                            <button
                              onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                              className="absolute top-2 right-2 p-1 text-zinc-600 hover:text-zinc-300 transition-colors rounded"
                              title="Copy code"
                            >
                              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          );
                        };
                        return (
                          <div className="relative bg-zinc-900 rounded-lg my-2 p-3">
                            <CodeBlockCopy />
                            {children}
                          </div>
                        );
                      },
                      strong: ({ children }) => <strong className="text-zinc-100 font-semibold">{children}</strong>,
                      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300">{children}</a>,
                      blockquote: ({ children }) => <blockquote className="border-l-2 border-emerald-500/40 pl-3 text-zinc-400 italic my-2">{children}</blockquote>,
                      h1: ({ children }) => <h1 className="text-base font-bold text-zinc-100 mb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-sm font-bold text-zinc-100 mb-1.5">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-semibold text-zinc-200 mb-1">{children}</h3>,
                      hr: () => <hr className="border-zinc-700 my-3" />,
                      table: ({ children }) => <div className="overflow-x-auto my-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
                      th: ({ children }) => <th className="border border-zinc-700 px-2 py-1 text-left text-zinc-300 bg-zinc-800/50">{children}</th>,
                      td: ({ children }) => <td className="border border-zinc-700 px-2 py-1 text-zinc-400">{children}</td>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  highlight(msg.content)
                )}
              </div>}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3 md:gap-4 max-w-3xl">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 bg-zinc-800/60 border border-white/10 text-zinc-500">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-1 items-start">
              <span className="text-xs font-medium text-zinc-500">Your team</span>
              <div className="text-sm glass-panel border border-white/5 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                <span className="text-zinc-500">Working on it...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 md:p-6 bg-transparent shrink-0">
        <form
          onSubmit={handleSend}
          className="max-w-4xl mx-auto"
        >
          {/* Attachment chip */}
          {attachment && (
            <div className="flex items-center gap-2 mb-2 px-2">
              <div className="glass-input flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-zinc-300 border border-white/10">
                <Paperclip className="w-3 h-3 text-zinc-400" />
                <span className="font-mono truncate max-w-[200px]">{attachment.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="ml-1 text-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          <div className="relative flex items-end gap-2 glass-input rounded-2xl p-2 focus-within:border-emerald-500/50 focus-within:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all duration-300">
            {/* @mention autocomplete popup */}
            {mentionPopupOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-56 glass-panel border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50">
                {AGENTS.map((agent, i) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => insertMention(agent)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                      i === mentionIndex ? 'bg-white/10' : 'hover:bg-white/5'
                    )}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{
                        backgroundColor: agent.bgColor,
                        border: `1px solid ${agent.borderColor}`,
                        color: agent.color,
                      }}
                    >
                      {agent.initial}
                    </div>
                    <div>
                      <div className="text-xs text-zinc-200">{agent.displayName}</div>
                      <div className="text-[10px] font-mono text-zinc-500">@{agent.id} · {agent.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <input
              type="file"
              accept="image/*,video/*,.pdf"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-zinc-400 hover:text-zinc-200 transition-colors rounded-lg hover:bg-zinc-800 shrink-0 flex items-center justify-center"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                const val = e.target.value;
                setInput(val);
                // Show mention popup when text ends with @ or @partial word
                const atMatch = val.match(/@(\w*)$/);
                if (atMatch) {
                  setMentionPopupOpen(true);
                  setMentionIndex(0);
                } else {
                  setMentionPopupOpen(false);
                }
              }}
              onKeyDown={(e) => {
                if (mentionPopupOpen) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, AGENTS.length - 1)); return; }
                  if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); insertMention(AGENTS[mentionIndex]); return; }
                  if (e.key === 'Escape') { setMentionPopupOpen(false); return; }
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="What would you like to do? Type @ to address a specific agent..."
              className="w-full max-h-48 min-h-[44px] bg-transparent text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none py-3 text-sm overflow-y-auto"
            />

            <button
              type="submit"
              disabled={(!input.trim() && !attachment) || isTyping}
              className="p-3 bg-gradient-to-tr from-emerald-600 to-emerald-400 text-emerald-950 hover:from-emerald-500 hover:to-emerald-300 disabled:opacity-50 disabled:grayscale transition-all rounded-xl shrink-0 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:shadow-[0_0_25px_rgba(16,185,129,0.6)]"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

      {/* Error Toast */}
      {errorToast && (
        <div className="absolute bottom-24 right-4 z-50 max-w-sm w-full pointer-events-auto">
          <div className="glass-panel border border-red-500/30 rounded-xl px-4 py-3 shadow-[0_0_20px_rgba(239,68,68,0.15)] flex items-start gap-3">
            <div className="shrink-0 w-2 h-2 rounded-full bg-red-500 mt-1.5 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-zinc-300 leading-relaxed">{errorToast.message}</p>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={handleRetry}
                  className="text-xs font-mono text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Retry
                </button>
                <button
                  onClick={dismissToast}
                  className="text-xs font-mono text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button onClick={dismissToast} className="shrink-0 text-zinc-600 hover:text-zinc-400 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
