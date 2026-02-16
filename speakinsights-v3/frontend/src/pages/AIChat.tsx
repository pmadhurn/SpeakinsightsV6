import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Bot,
  Sparkles,
  Plus,
  Trash2,
  MessageSquare,
  Search,
  X,
  StopCircle,
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import GlassButton from '@/components/ui/GlassButton';
import ChatMessage from '@/components/chat/ChatMessage';
import { useChatStream } from '@/hooks/useChatStream';
import { chat, models as modelsApi, meetings as meetingsApi } from '@/services/api';
import { useUIStore } from '@/stores/uiStore';
import { formatRelativeTime } from '@/utils/formatTime';
import type { ChatSource } from '@/types/chat';
import type { Meeting } from '@/types/meeting';

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  created_at?: string;
  sources?: ChatSource[];
}

interface Session {
  session_id: string;
  preview: string;
  started_at: string;
  message_count: number;
}

export default function AIChat() {
  // ── State ──
  const [message, setMessage] = useState('');
  const [useRag, setUseRag] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [installedModels, setInstalledModels] = useState<{ name: string }[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [meetingsList, setMeetingsList] = useState<Meeting[]>([]);
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { defaultModel } = useUIStore();

  const {
    sendMessage: streamMessage,
    isStreaming,
    currentStreamedText,
    streamedSources,
    error: streamError,
    cancelStream,
  } = useChatStream();

  // ── Init: load models + sessions + meetings ──
  useEffect(() => {
    const init = async () => {
      try {
        const [modelsData, sessionsData] = await Promise.all([
          modelsApi.list().catch(() => ({ models: [] })),
          chat.getSessions().catch(() => ({ sessions: [] })),
        ]);
        const modelList = modelsData.models || [];
        setInstalledModels(modelList);
        const sessionsList = sessionsData.sessions || sessionsData || [];
        setSessions(Array.isArray(sessionsList) ? sessionsList : []);

        // Set default model
        const defaultExists = modelList.some(
          (m: { name: string }) => m.name === defaultModel,
        );
        if (defaultExists) {
          setSelectedModel(defaultModel);
        } else if (modelList.length > 0) {
          setSelectedModel(modelList[0].name);
        }
      } catch {}

      try {
        const meetingsData = await meetingsApi.list();
        setMeetingsList(meetingsData);
      } catch {}
    };
    init();
  }, [defaultModel]);

  // ── Generate a new session on mount if none active ──
  useEffect(() => {
    if (!activeSessionId) {
      setActiveSessionId(crypto.randomUUID());
    }
  }, [activeSessionId]);

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamedText]);

  // ── Load session history ──
  const loadSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setLoadingHistory(true);
    setMessages([]);

    try {
      const data: any = await chat.getHistory(sessionId);
      const msgArray = data.messages || (Array.isArray(data) ? data : []);
      const loaded: LocalMessage[] = msgArray.map((m: any) => ({
        id: m.id || crypto.randomUUID(),
        role: m.role,
        content: m.content,
        model: m.model_used || m.model,
        created_at: m.created_at,
        sources: m.context_chunks
          ? m.context_chunks.map((c: any) => ({
              segment_id: c.meeting_id || '',
              speaker_name: c.speaker || '',
              text: c.text || '',
              start_time: c.start_time || 0,
              meeting_title: c.meeting_title || '',
              score: c.distance ? 1 / (1 + c.distance) : 0,
            }))
          : undefined,
      }));
      setMessages(loaded);
    } catch {
      setMessages([]);
    }
    setLoadingHistory(false);
  }, []);

  // ── New chat ──
  const handleNewChat = () => {
    setActiveSessionId(crypto.randomUUID());
    setMessages([]);
  };

  // ── Delete session ──
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await chat.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      if (activeSessionId === sessionId) {
        handleNewChat();
      }
    } catch {}
  };

  // ── Send message ──
  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: LocalMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setMessage('');

    // Stream response
    const result = await streamMessage({
      message: trimmed,
      session_id: activeSessionId,
      model: selectedModel || undefined,
      use_rag: useRag,
      meeting_ids: useRag && selectedMeetingIds.length > 0 ? selectedMeetingIds : undefined,
    });

    if (result) {
      const assistantMsg: LocalMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.content,
        model: selectedModel,
        created_at: new Date().toISOString(),
        sources: result.sources.length > 0 ? result.sources : undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Update session id if backend assigned one
      if (result.session_id && result.session_id !== activeSessionId) {
        setActiveSessionId(result.session_id);
      }

      // Refresh sessions list
      try {
        const sessionsData: any = await chat.getSessions();
        const sList = sessionsData.sessions || (Array.isArray(sessionsData) ? sessionsData : []);
        setSessions(sList);
      } catch {}
    }
  };

  // ── Keyboard shortcut ──
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Meeting selection for RAG ──
  const toggleMeetingSelection = (id: string) => {
    setSelectedMeetingIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  return (
    <div className="min-h-screen pt-20 pb-4">
      <div className="max-w-7xl mx-auto px-4 flex h-[calc(100vh-6rem)]">
        {/* ─── Left Sidebar — Chat Sessions ─── */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 mr-4 flex flex-col overflow-hidden"
            >
              <div className="glass-heavy rounded-2xl flex flex-col h-full p-3">
                {/* New Chat button */}
                <GlassButton
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  fullWidth
                  onClick={handleNewChat}
                  className="mb-3"
                >
                  New Chat
                </GlassButton>

                {/* Sessions list */}
                <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin">
                  {sessions.map((session) => (
                    <div
                      key={session.session_id}
                      onClick={() => loadSession(session.session_id)}
                      className={`group flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                        activeSessionId === session.session_id
                          ? 'bg-cyan/10 border-l-2 border-cyan'
                          : 'hover:bg-white/5 border-l-2 border-transparent'
                      }`}
                    >
                      <MessageSquare
                        size={13}
                        className={`mt-0.5 shrink-0 ${
                          activeSessionId === session.session_id
                            ? 'text-cyan'
                            : 'text-white/25'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/80 truncate leading-snug">
                          {session.preview || 'New conversation'}
                        </p>
                        <p className="text-[10px] text-white/30 mt-0.5">
                          {session.started_at &&
                            formatRelativeTime(session.started_at)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(session.session_id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-white/30 hover:text-red-400 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}

                  {sessions.length === 0 && (
                    <p className="text-xs text-white/20 text-center py-8">
                      No conversations yet
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Main Chat Area ─── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <div className="glass rounded-2xl px-4 py-3 mb-3 flex items-center gap-3 flex-wrap">
            {/* Sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <MessageSquare size={16} />
            </button>

            {/* Model selector */}
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-cyan/50 transition-colors min-w-[160px]"
            >
              {installedModels.map((m) => (
                <option key={m.name} value={m.name} className="bg-navy-light">
                  {m.name}
                </option>
              ))}
              {installedModels.length === 0 && (
                <option value="" className="bg-navy-light">
                  No models installed
                </option>
              )}
            </select>

            <div className="h-5 w-px bg-white/10" />

            {/* RAG toggle */}
            <button
              onClick={() => setUseRag(!useRag)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                useRag
                  ? 'bg-cyan/15 text-cyan border border-cyan/25'
                  : 'bg-white/5 text-white/40 border border-white/10 hover:text-white/60'
              }`}
            >
              <Search size={12} />
              Search Meetings
            </button>

            {/* Meeting selector (when RAG is on) */}
            {useRag && meetingsList.length > 0 && (
              <div className="relative group">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/50 border border-white/10 hover:border-white/20 transition-colors">
                  <Sparkles size={12} />
                  {selectedMeetingIds.length > 0
                    ? `${selectedMeetingIds.length} meeting${selectedMeetingIds.length > 1 ? 's' : ''}`
                    : 'All meetings'}
                </button>
                <div className="absolute top-full left-0 mt-1 w-64 glass-heavy rounded-xl p-2 hidden group-hover:block z-50 max-h-48 overflow-y-auto">
                  {meetingsList.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMeetingIds.includes(m.id)}
                        onChange={() => toggleMeetingSelection(m.id)}
                        className="accent-cyan-500"
                      />
                      <span className="text-xs text-white/70 truncate">{m.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto rounded-2xl mb-3 px-1">
            {loadingHistory ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center gap-2 text-white/30">
                  <div className="w-2 h-2 rounded-full bg-cyan/60 animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-cyan/60 animate-bounce [animation-delay:0.15s]" />
                  <div className="w-2 h-2 rounded-full bg-cyan/60 animate-bounce [animation-delay:0.3s]" />
                </div>
              </div>
            ) : messages.length === 0 && !isStreaming ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Bot className="text-white/[0.08] mx-auto mb-4" size={64} />
                  <p className="text-white/30 text-sm font-medium">
                    Start a conversation
                  </p>
                  <p className="text-white/15 text-xs mt-1 max-w-xs">
                    {useRag
                      ? 'RAG enabled — answers will be grounded in your meeting transcripts'
                      : 'Ask anything — or enable "Search Meetings" for context-aware answers'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    sources={msg.sources}
                  />
                ))}

                {/* Streaming assistant message */}
                {isStreaming && currentStreamedText && (
                  <ChatMessage
                    message={{
                      role: 'assistant',
                      content: currentStreamedText,
                      model: selectedModel,
                    }}
                    sources={streamedSources.length > 0 ? streamedSources : undefined}
                    isStreaming
                  />
                )}

                {/* Typing indicator */}
                {isStreaming && !currentStreamedText && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-lavender/15 text-lavender border border-lavender/20 flex items-center justify-center">
                      <Bot size={15} />
                    </div>
                    <div className="bg-lavender/5 border border-lavender/15 rounded-2xl px-4 py-3 backdrop-blur-md">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-lavender/60 animate-bounce" />
                        <div className="w-1.5 h-1.5 rounded-full bg-lavender/60 animate-bounce [animation-delay:0.15s]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-lavender/60 animate-bounce [animation-delay:0.3s]" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Stream error */}
                {streamError && (
                  <div className="flex justify-center">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 text-xs text-red-400">
                      {streamError}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="glass rounded-2xl px-4 py-3">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isStreaming
                      ? 'Waiting for response...'
                      : 'Type your message... (Enter to send, Shift+Enter for new line)'
                  }
                  disabled={isStreaming}
                  rows={1}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-sm text-white/90 placeholder-white/25 focus:outline-none focus:border-cyan/40 transition-colors resize-none min-h-[44px] max-h-[160px] disabled:opacity-40"
                  style={{
                    height: 'auto',
                    minHeight: '44px',
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 160) + 'px';
                  }}
                />
              </div>

              {isStreaming ? (
                <GlassButton variant="danger" size="md" icon={StopCircle} onClick={cancelStream}>
                  Stop
                </GlassButton>
              ) : (
                <GlassButton
                  variant="primary"
                  size="md"
                  icon={Send}
                  onClick={handleSend}
                  disabled={!message.trim()}
                >
                  Send
                </GlassButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
