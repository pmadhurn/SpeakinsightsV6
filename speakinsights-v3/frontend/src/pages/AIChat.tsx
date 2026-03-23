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
  StopCircle,
  History as HistoryIcon,
} from 'lucide-react';
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
  const [message, setMessage] = useState('');
  const [useRag, setUseRag] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [installedModels, setInstalledModels] = useState<{ name: string }[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Mobile check config
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile); 
  const [meetingsList, setMeetingsList] = useState<Meeting[]>([]);
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<string[]>([]);
  const [meetingDropdownOpen, setMeetingDropdownOpen] = useState(false);

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

        const defaultExists = modelList.some((m: { name: string }) => m.name === defaultModel);
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

  useEffect(() => {
    if (!activeSessionId) {
      setActiveSessionId(crypto.randomUUID());
    }
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamedText]);

  const loadSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setLoadingHistory(true);
    setMessages([]);
    
    // Auto-dismiss sidebar ONLY on mobile viewport upon selection
    if (window.innerWidth < 768) setSidebarOpen(false);

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

  const handleNewChat = () => {
    setActiveSessionId(crypto.randomUUID());
    setMessages([]);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

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

      if (result.session_id && result.session_id !== activeSessionId) {
        setActiveSessionId(result.session_id);
      }

      try {
        const sessionsData: any = await chat.getSessions();
        const sList = sessionsData.sessions || (Array.isArray(sessionsData) ? sessionsData : []);
        setSessions(sList);
      } catch {}
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleMeetingSelection = (id: string) => {
    setSelectedMeetingIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  return (
    <div className="min-h-[100dvh] pt-24 md:pt-32 pb-4 md:pb-6 bg-[#02060B] text-white selection:bg-cyan-500/30 font-sans relative overflow-x-hidden flex flex-col">
      
      {/* Background Meshes */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-cyan-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-purple-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 flex h-[calc(100dvh-7rem)] md:h-[calc(100dvh-9.5rem)] relative z-10 w-full md:gap-6">
        
        {/* Mobile Shadow Overlay for open Drawer */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-[#02060B]/80 backdrop-blur-sm z-40 md:hidden"
            />
          )}
        </AnimatePresence>

        {/* ─── Left Sidebar Drawer/Dock ─── */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0, x: -50 }}
              animate={{ width: "auto", opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: -50 }}
              transition={{ duration: 0.3, ease: 'circOut' }}
              className="absolute inset-y-0 left-4 md:left-auto md:relative shrink-0 flex flex-col z-50 h-[calc(100dvh-9rem)] md:h-full pb-4 md:pb-0 pt-4 md:pt-0"
            >
              <div className="w-[280px] md:w-[300px] bg-[#0a0c10]/95 backdrop-blur-xl md:backdrop-blur-none md:bg-[#0a0c10] border border-white/10 rounded-3xl flex flex-col h-full p-4 shadow-2xl md:shadow-lg">
                
                {/* Mobile 'Close' override at Top Level Menu items */}
                <div className="flex md:hidden items-center justify-between mb-2 pb-1">
                   <h2 className="text-[13px] font-black tracking-widest uppercase text-cyan-400">Activity</h2>
                   <button onClick={() => setSidebarOpen(false)} className="text-white/40 hover:text-white p-2">
                     <Trash2 size={16} className="rotate-45" /> {/* Close "X" visualization icon proxy  */}
                   </button>
                </div>

                <GlassButton
                  variant="cyan"
                  icon={Plus}
                  className="!py-3 !rounded-2xl w-full !text-xs mb-4 uppercase tracking-widest shadow-cyan-500/20"
                  onClick={handleNewChat}
                >
                  New Chat
                </GlassButton>

                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 px-2 mb-3 mt-2">
                  Timeline Context
                </h3>

                {/* Scroller Base */}
                <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent pr-1 pb-4">
                  {sessions.map((session) => (
                    <div
                      key={session.session_id}
                      onClick={() => loadSession(session.session_id)}
                      className={`group flex items-start gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all border ${
                        activeSessionId === session.session_id
                          ? 'bg-cyan-500/10 border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                          : 'hover:bg-white/5 border-transparent'
                      }`}
                    >
                      <MessageSquare
                        size={14}
                        className={`mt-0.5 shrink-0 ${
                          activeSessionId === session.session_id
                            ? 'text-cyan-400'
                            : 'text-white/20 group-hover:text-cyan-400 transition-colors'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[12px] truncate leading-tight font-medium ${activeSessionId === session.session_id ? 'text-white' : 'text-white/60'}`}>
                          {session.preview || 'System init sequence'}
                        </p>
                        <p className="text-[9px] uppercase font-bold tracking-widest text-white/30 mt-1">
                          {session.started_at && formatRelativeTime(session.started_at)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(session.session_id, e)}
                        className="opacity-0 md:group-hover:opacity-100 opacity-100 sm:opacity-0 p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 sm:text-white/20 hover:text-red-400 transition-all shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}

                  {sessions.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 opacity-50">
                      <HistoryIcon size={24} className="mb-2 text-white/40" />
                      <p className="text-[10px] uppercase font-bold tracking-widest">No Storage Nodes Found</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Main Integrated Environment ─── */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* Smart Header Row that flexes dynamically  */}
          <div className="bg-[#0a0c10]/80 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl px-4 md:px-6 py-3 md:py-4 mb-4 flex items-center justify-between gap-3 md:gap-4 flex-wrap z-30 shrink-0">
            
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto shrink-0 justify-start flex-1">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-xl bg-white/5 sm:bg-transparent hover:bg-white/10 text-cyan-400 sm:text-white/40 hover:text-cyan-400 transition-colors"
                title={sidebarOpen ? 'Collapse view' : 'Expand View'}
              >
                <MessageSquare size={16} />
              </button>

              <div className="h-6 w-px bg-white/10 hidden md:block" />

              <button
                onClick={() => setUseRag(!useRag)}
                className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 rounded-xl text-[10px] md:text-[11px] uppercase tracking-widest font-black transition-all border ${
                  useRag
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                    : 'bg-transparent text-white/40 border-white/5 hover:text-white hover:bg-white/5'
                }`}
              >
                <Search size={14} />
                Context<span className="hidden sm:inline"> Vector</span>
              </button>

              {useRag && meetingsList.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setMeetingDropdownOpen(!meetingDropdownOpen)}
                    className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest bg-white/[0.03] text-white/60 border border-white/10 hover:border-white/30 hover:bg-white/[0.05] transition-all shrink-0"
                  >
                    <Sparkles size={14} className="text-cyan-400" />
                    {selectedMeetingIds.length > 0
                      ? `Ids:[${selectedMeetingIds.length}]`
                      : 'Index: ALL'}
                  </button>
                  {meetingDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMeetingDropdownOpen(false)} />
                      <div className="absolute top-full left-0 md:left-auto md:right-0 mt-2 w-64 md:w-72 bg-[#0a0c10]/95 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-2xl p-2 z-50 max-h-56 overflow-y-auto">
                        <div className="text-[9px] uppercase tracking-widest text-white/30 mb-2 px-2 mt-1">Context Anchors</div>
                        {meetingsList.map((m) => (
                          <label key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/5">
                            <input
                              type="checkbox"
                              checked={selectedMeetingIds.includes(m.id)}
                              onChange={() => toggleMeetingSelection(m.id)}
                              className="accent-cyan-400 cursor-pointer"
                            />
                            <span className="text-[12px] text-white/70 font-bold truncate leading-none mt-px">{m.title}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-transparent text-white font-bold uppercase text-[10px] md:text-[11px] tracking-widest outline-none border border-white/5 md:border-transparent rounded-lg py-1 px-2 md:p-0 md:w-auto focus:outline-none focus:ring-0 w-full sm:w-auto text-center md:text-right cursor-pointer bg-white/[0.02]"
            >
              {installedModels.map((m) => (
                <option key={m.name} value={m.name} className="bg-[#0a0c10] font-sans text-left">
                  CPU Output: {m.name}
                </option>
              ))}
              {installedModels.length === 0 && (
                <option value="" className="bg-[#0a0c10]">OFFLINE MODE (REQ NODE)</option>
              )}
            </select>
          </div>

          {/* Interactive Flow Panel (Messages Grid Scroll Area) */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 rounded-2xl mb-4 relative z-20">
            {loadingHistory ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center gap-2 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce" />
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.15s]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.3s]" />
                </div>
              </div>
            ) : messages.length === 0 && !isStreaming ? (
              <div className="flex items-center justify-center h-full flex-col px-4 text-center">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-cyan-500/5 rounded-[2rem] border border-white/5 flex flex-col items-center justify-center mb-6">
                  <Bot className="text-cyan-400/50" size={40} />
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter mb-2">Secure AI Socket Open</h3>
                <p className="text-white/40 text-xs md:text-sm font-medium text-center max-w-sm leading-relaxed">
                  {useRag
                    ? 'Vectors currently bounded to indexing active search on transcription datasets. Fire sequence to scan context queries.'
                    : 'Main loop connected securely on edge hardware context layer.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4 md:space-y-6 pb-6 px-1 md:px-4">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} sources={msg.sources} />
                ))}

                {/* Simulated Loading typing responses via Local Host Nodes */}
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

                {isStreaming && !currentStreamedText && (
                  <div className="flex gap-3 md:gap-4 px-2">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex shrink-0 items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                      <Bot size={20} className="w-4 md:w-5" />
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 backdrop-blur-md">
                      <div className="flex items-center gap-1.5 pt-0.5 md:pt-1.5">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-purple-400 animate-bounce" />
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.15s]" />
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.3s]" />
                      </div>
                    </div>
                  </div>
                )}

                {streamError && (
                  <div className="flex justify-center my-6">
                    <div className="bg-red-500/10 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)] rounded-2xl px-4 md:px-6 py-2.5 md:py-3 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-red-400 max-w-xs md:max-w-md text-center">
                      RUNTIME ERR: {streamError}
                    </div>
                  </div>
                )}
                
                {/* Ensures Scroll anchors gracefully without jerking logic inside map component calls */}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            )}
          </div>

          {/* Prompt Entry Flex */}
          <div className="bg-[#0a0c10]/95 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] rounded-[24px] md:rounded-[32px] p-2 md:p-3 shrink-0 flex gap-2 md:gap-3 flex-wrap">
             <div className="flex-[1_1_100%] sm:flex-[1_1_auto] relative flex items-center min-w-0">
                <textarea
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isStreaming
                      ? 'Compiling runtime response...'
                      : 'Trigger query...'
                  }
                  disabled={isStreaming}
                  rows={1}
                  className="w-full bg-white/[0.03] border border-white/10 hover:border-white/20 rounded-2xl px-5 py-[14px] md:py-[18px] text-xs md:text-sm text-white font-medium placeholder-white/25 outline-none focus:bg-white/[0.05] focus:border-cyan-400/50 transition-all resize-none max-h-[120px] md:max-h-[160px] disabled:opacity-40 custom-scrollbar block min-h-[48px] md:min-h-[56px] align-middle pt-[14px] md:pt-[18px]"
                  style={{}}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 160) + 'px';
                  }}
                />
             </div>

             <div className="flex-1 sm:flex-none flex shrink-0 sm:self-end self-center mb-0 md:mb-1 w-full sm:w-auto h-full px-2 sm:px-0">
              {isStreaming ? (
                <button
                  className="relative w-full sm:w-[100px] flex items-center justify-center h-12 md:h-[52px] rounded-xl md:rounded-2xl bg-red-500/20 text-red-400 border border-red-500/40 font-black text-xs uppercase tracking-widest hover:bg-red-500/30 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.1)] gap-2 shrink-0"
                  onClick={cancelStream}
                >
                  <StopCircle size={16} className="hidden sm:inline" /> Kill
                </button>
              ) : (
                <GlassButton
                  variant="primary"
                  icon={Send}
                  onClick={handleSend}
                  disabled={!message.trim()}
                  className="!h-12 !py-0 md:!h-[52px] w-full sm:w-auto !rounded-xl md:!rounded-2xl !px-6 shadow-xl !flex !justify-center"
                >
                  <span className="inline">Run</span>
                </GlassButton>
              )}
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
// import { useState, useEffect, useRef, useCallback } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import {
//   Send,
//   Bot,
//   Sparkles,
//   Plus,
//   Trash2,
//   MessageSquare,
//   Search,
//   X,
//   StopCircle,
// } from 'lucide-react';
// import GlassCard from '@/components/ui/GlassCard';
// import GlassButton from '@/components/ui/GlassButton';
// import ChatMessage from '@/components/chat/ChatMessage';
// import { useChatStream } from '@/hooks/useChatStream';
// import { chat, models as modelsApi, meetings as meetingsApi } from '@/services/api';
// import { useUIStore } from '@/stores/uiStore';
// import { formatRelativeTime } from '@/utils/formatTime';
// import type { ChatSource } from '@/types/chat';
// import type { Meeting } from '@/types/meeting';

// interface LocalMessage {
//   id: string;
//   role: 'user' | 'assistant';
//   content: string;
//   model?: string;
//   created_at?: string;
//   sources?: ChatSource[];
// }

// interface Session {
//   session_id: string;
//   preview: string;
//   started_at: string;
//   message_count: number;
// }

// export default function AIChat() {
//   // ── State ──
//   const [message, setMessage] = useState('');
//   const [useRag, setUseRag] = useState(false);
//   const [selectedModel, setSelectedModel] = useState('');
//   const [installedModels, setInstalledModels] = useState<{ name: string }[]>([]);
//   const [sessions, setSessions] = useState<Session[]>([]);
//   const [activeSessionId, setActiveSessionId] = useState<string>('');
//   const [messages, setMessages] = useState<LocalMessage[]>([]);
//   const [loadingHistory, setLoadingHistory] = useState(false);
//   const [sidebarOpen, setSidebarOpen] = useState(true);
//   const [meetingsList, setMeetingsList] = useState<Meeting[]>([]);
//   const [selectedMeetingIds, setSelectedMeetingIds] = useState<string[]>([]);
//   const [meetingDropdownOpen, setMeetingDropdownOpen] = useState(false);

//   const messagesEndRef = useRef<HTMLDivElement>(null);
//   const inputRef = useRef<HTMLTextAreaElement>(null);
//   const { defaultModel } = useUIStore();

//   const {
//     sendMessage: streamMessage,
//     isStreaming,
//     currentStreamedText,
//     streamedSources,
//     error: streamError,
//     cancelStream,
//   } = useChatStream();

//   // ── Init: load models + sessions + meetings ──
//   useEffect(() => {
//     const init = async () => {
//       try {
//         const [modelsData, sessionsData] = await Promise.all([
//           modelsApi.list().catch(() => ({ models: [] })),
//           chat.getSessions().catch(() => ({ sessions: [] })),
//         ]);
//         const modelList = modelsData.models || [];
//         setInstalledModels(modelList);
//         const sessionsList = sessionsData.sessions || sessionsData || [];
//         setSessions(Array.isArray(sessionsList) ? sessionsList : []);

//         // Set default model
//         const defaultExists = modelList.some(
//           (m: { name: string }) => m.name === defaultModel,
//         );
//         if (defaultExists) {
//           setSelectedModel(defaultModel);
//         } else if (modelList.length > 0) {
//           setSelectedModel(modelList[0].name);
//         }
//       } catch { }

//       try {
//         const meetingsData = await meetingsApi.list();
//         setMeetingsList(meetingsData);
//       } catch { }
//     };
//     init();
//   }, [defaultModel]);

//   // ── Generate a new session on mount if none active ──
//   useEffect(() => {
//     if (!activeSessionId) {
//       setActiveSessionId(crypto.randomUUID());
//     }
//   }, [activeSessionId]);

//   // ── Auto-scroll ──
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages, currentStreamedText]);

//   // ── Load session history ──
//   const loadSession = useCallback(async (sessionId: string) => {
//     setActiveSessionId(sessionId);
//     setLoadingHistory(true);
//     setMessages([]);

//     try {
//       const data: any = await chat.getHistory(sessionId);
//       const msgArray = data.messages || (Array.isArray(data) ? data : []);
//       const loaded: LocalMessage[] = msgArray.map((m: any) => ({
//         id: m.id || crypto.randomUUID(),
//         role: m.role,
//         content: m.content,
//         model: m.model_used || m.model,
//         created_at: m.created_at,
//         sources: m.context_chunks
//           ? m.context_chunks.map((c: any) => ({
//             segment_id: c.meeting_id || '',
//             speaker_name: c.speaker || '',
//             text: c.text || '',
//             start_time: c.start_time || 0,
//             meeting_title: c.meeting_title || '',
//             score: c.distance ? 1 / (1 + c.distance) : 0,
//           }))
//           : undefined,
//       }));
//       setMessages(loaded);
//     } catch {
//       setMessages([]);
//     }
//     setLoadingHistory(false);
//   }, []);

//   // ── New chat ──
//   const handleNewChat = () => {
//     setActiveSessionId(crypto.randomUUID());
//     setMessages([]);
//   };

//   // ── Delete session ──
//   const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
//     e.stopPropagation();
//     try {
//       await chat.deleteSession(sessionId);
//       setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
//       if (activeSessionId === sessionId) {
//         handleNewChat();
//       }
//     } catch { }
//   };

//   // ── Send message ──
//   const handleSend = async () => {
//     const trimmed = message.trim();
//     if (!trimmed || isStreaming) return;

//     const userMsg: LocalMessage = {
//       id: crypto.randomUUID(),
//       role: 'user',
//       content: trimmed,
//       created_at: new Date().toISOString(),
//     };
//     setMessages((prev) => [...prev, userMsg]);
//     setMessage('');

//     // Stream response
//     const result = await streamMessage({
//       message: trimmed,
//       session_id: activeSessionId,
//       model: selectedModel || undefined,
//       use_rag: useRag,
//       meeting_ids: useRag && selectedMeetingIds.length > 0 ? selectedMeetingIds : undefined,
//     });

//     if (result) {
//       const assistantMsg: LocalMessage = {
//         id: crypto.randomUUID(),
//         role: 'assistant',
//         content: result.content,
//         model: selectedModel,
//         created_at: new Date().toISOString(),
//         sources: result.sources.length > 0 ? result.sources : undefined,
//       };
//       setMessages((prev) => [...prev, assistantMsg]);

//       // Update session id if backend assigned one
//       if (result.session_id && result.session_id !== activeSessionId) {
//         setActiveSessionId(result.session_id);
//       }

//       // Refresh sessions list
//       try {
//         const sessionsData: any = await chat.getSessions();
//         const sList = sessionsData.sessions || (Array.isArray(sessionsData) ? sessionsData : []);
//         setSessions(sList);
//       } catch { }
//     }
//   };

//   // ── Keyboard shortcut ──
//   const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
//     if (e.key === 'Enter' && !e.shiftKey) {
//       e.preventDefault();
//       handleSend();
//     }
//   };

//   // ── Meeting selection for RAG ──
//   const toggleMeetingSelection = (id: string) => {
//     setSelectedMeetingIds((prev) =>
//       prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
//     );
//   };

//   return (
//     <div className="min-h-screen pt-20 pb-4">
//       <div className="max-w-7xl mx-auto px-4 flex h-[calc(100vh-6rem)]">
//         {/* ─── Left Sidebar — Chat Sessions ─── */}
//         <AnimatePresence>
//           {sidebarOpen && (
//             <motion.div
//               initial={{ width: 0, opacity: 0 }}
//               animate={{ width: 280, opacity: 1 }}
//               exit={{ width: 0, opacity: 0 }}
//               transition={{ duration: 0.2 }}
//               className="shrink-0 mr-4 flex flex-col overflow-hidden"
//             >
//               <div className="glass-heavy rounded-2xl flex flex-col h-full p-3">
//                 {/* New Chat button */}
//                 <GlassButton
//                   variant="primary"
//                   size="sm"
//                   icon={Plus}
//                   fullWidth
//                   onClick={handleNewChat}
//                   className="mb-3"
//                 >
//                   New Chat
//                 </GlassButton>

//                 {/* Sessions list */}
//                 <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin">
//                   {sessions.map((session) => (
//                     <div
//                       key={session.session_id}
//                       onClick={() => loadSession(session.session_id)}
//                       className={`group flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${activeSessionId === session.session_id
//                         ? 'bg-cyan/10 border-l-2 border-cyan'
//                         : 'hover:bg-white/5 border-l-2 border-transparent'
//                         }`}
//                     >
//                       <MessageSquare
//                         size={13}
//                         className={`mt-0.5 shrink-0 ${activeSessionId === session.session_id
//                           ? 'text-cyan'
//                           : 'text-white/25'
//                           }`}
//                       />
//                       <div className="flex-1 min-w-0">
//                         <p className="text-xs text-white/80 truncate leading-snug">
//                           {session.preview || 'New conversation'}
//                         </p>
//                         <p className="text-[10px] text-white/30 mt-0.5">
//                           {session.started_at &&
//                             formatRelativeTime(session.started_at)}
//                         </p>
//                       </div>
//                       <button
//                         onClick={(e) => handleDeleteSession(session.session_id, e)}
//                         className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-white/30 hover:text-red-400 transition-all"
//                       >
//                         <Trash2 size={12} />
//                       </button>
//                     </div>
//                   ))}

//                   {sessions.length === 0 && (
//                     <p className="text-xs text-white/20 text-center py-8">
//                       No conversations yet
//                     </p>
//                   )}
//                 </div>
//               </div>
//             </motion.div>
//           )}
//         </AnimatePresence>

//         {/* ─── Main Chat Area ─── */}
//         <div className="flex-1 flex flex-col min-w-0">
//           {/* Top bar */}
//           <div className="glass rounded-2xl px-4 py-3 mb-3 flex items-center gap-3 flex-wrap">
//             {/* Sidebar toggle */}
//             <button
//               onClick={() => setSidebarOpen(!sidebarOpen)}
//               className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
//               title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
//             >
//               <MessageSquare size={16} />
//             </button>

//             {/* Model selector */}
//             <select
//               value={selectedModel}
//               onChange={(e) => setSelectedModel(e.target.value)}
//               className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-cyan/50 transition-colors min-w-[160px]"
//             >
//               {installedModels.map((m) => (
//                 <option key={m.name} value={m.name} className="bg-navy-light">
//                   {m.name}
//                 </option>
//               ))}
//               {installedModels.length === 0 && (
//                 <option value="" className="bg-navy-light">
//                   No models installed
//                 </option>
//               )}
//             </select>

//             <div className="h-5 w-px bg-white/10" />

//             {/* RAG toggle */}
//             <button
//               onClick={() => setUseRag(!useRag)}
//               className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${useRag
//                 ? 'bg-cyan/15 text-cyan border border-cyan/25'
//                 : 'bg-white/5 text-white/40 border border-white/10 hover:text-white/60'
//                 }`}
//             >
//               <Search size={12} />
//               Search Meetings
//             </button>

//             {/* Meeting selector (when RAG is on) */}
//             {useRag && meetingsList.length > 0 && (
//               <div className="relative">
//                 <button
//                   onClick={() => setMeetingDropdownOpen(!meetingDropdownOpen)}
//                   className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/50 border border-white/10 hover:border-white/20 transition-colors"
//                 >
//                   <Sparkles size={12} />
//                   {selectedMeetingIds.length > 0
//                     ? `${selectedMeetingIds.length} meeting${selectedMeetingIds.length > 1 ? 's' : ''}`
//                     : 'All meetings'}
//                 </button>
//                 {meetingDropdownOpen && (
//                   <>
//                     {/* Invisible backdrop to close on outside click */}
//                     <div
//                       className="fixed inset-0 z-40"
//                       onClick={() => setMeetingDropdownOpen(false)}
//                     />
//                     <div className="absolute top-full left-0 mt-1 w-64 glass-heavy rounded-xl p-2 z-50 max-h-48 overflow-y-auto">
//                       {meetingsList.map((m) => (
//                         <label
//                           key={m.id}
//                           className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
//                         >
//                           <input
//                             type="checkbox"
//                             checked={selectedMeetingIds.includes(m.id)}
//                             onChange={() => toggleMeetingSelection(m.id)}
//                             className="accent-cyan-500"
//                           />
//                           <span className="text-xs text-white/70 truncate">{m.title}</span>
//                         </label>
//                       ))}
//                     </div>
//                   </>
//                 )}
//               </div>
//             )}
//           </div>

//           {/* Messages area */}
//           <div className="flex-1 overflow-y-auto rounded-2xl mb-3 px-1">
//             {loadingHistory ? (
//               <div className="flex items-center justify-center h-full">
//                 <div className="flex items-center gap-2 text-white/30">
//                   <div className="w-2 h-2 rounded-full bg-cyan/60 animate-bounce" />
//                   <div className="w-2 h-2 rounded-full bg-cyan/60 animate-bounce [animation-delay:0.15s]" />
//                   <div className="w-2 h-2 rounded-full bg-cyan/60 animate-bounce [animation-delay:0.3s]" />
//                 </div>
//               </div>
//             ) : messages.length === 0 && !isStreaming ? (
//               <div className="flex items-center justify-center h-full">
//                 <div className="text-center">
//                   <Bot className="text-white/[0.08] mx-auto mb-4" size={64} />
//                   <p className="text-white/30 text-sm font-medium">
//                     Start a conversation
//                   </p>
//                   <p className="text-white/15 text-xs mt-1 max-w-xs">
//                     {useRag
//                       ? 'RAG enabled — answers will be grounded in your meeting transcripts'
//                       : 'Ask anything — or enable "Search Meetings" for context-aware answers'}
//                   </p>
//                 </div>
//               </div>
//             ) : (
//               <div className="space-y-4 py-4">
//                 {messages.map((msg) => (
//                   <ChatMessage
//                     key={msg.id}
//                     message={msg}
//                     sources={msg.sources}
//                   />
//                 ))}

//                 {/* Streaming assistant message */}
//                 {isStreaming && currentStreamedText && (
//                   <ChatMessage
//                     message={{
//                       role: 'assistant',
//                       content: currentStreamedText,
//                       model: selectedModel,
//                     }}
//                     sources={streamedSources.length > 0 ? streamedSources : undefined}
//                     isStreaming
//                   />
//                 )}

//                 {/* Typing indicator */}
//                 {isStreaming && !currentStreamedText && (
//                   <div className="flex gap-3">
//                     <div className="w-8 h-8 rounded-full bg-lavender/15 text-lavender border border-lavender/20 flex items-center justify-center">
//                       <Bot size={15} />
//                     </div>
//                     <div className="bg-lavender/5 border border-lavender/15 rounded-2xl px-4 py-3 backdrop-blur-md">
//                       <div className="flex items-center gap-1.5">
//                         <div className="w-1.5 h-1.5 rounded-full bg-lavender/60 animate-bounce" />
//                         <div className="w-1.5 h-1.5 rounded-full bg-lavender/60 animate-bounce [animation-delay:0.15s]" />
//                         <div className="w-1.5 h-1.5 rounded-full bg-lavender/60 animate-bounce [animation-delay:0.3s]" />
//                       </div>
//                     </div>
//                   </div>
//                 )}

//                 {/* Stream error */}
//                 {streamError && (
//                   <div className="flex justify-center">
//                     <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 text-xs text-red-400">
//                       {streamError}
//                     </div>
//                   </div>
//                 )}

//                 <div ref={messagesEndRef} />
//               </div>
//             )}
//           </div>

//           {/* Input area */}
//           <div className="glass rounded-2xl px-4 py-3">
//             <div className="flex items-end gap-3">
//               <div className="flex-1 relative">
//                 <textarea
//                   ref={inputRef}
//                   value={message}
//                   onChange={(e) => setMessage(e.target.value)}
//                   onKeyDown={handleKeyDown}
//                   placeholder={
//                     isStreaming
//                       ? 'Waiting for response...'
//                       : 'Type your message... (Enter to send, Shift+Enter for new line)'
//                   }
//                   disabled={isStreaming}
//                   rows={1}
//                   className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-sm text-white/90 placeholder-white/25 focus:outline-none focus:border-cyan/40 transition-colors resize-none min-h-[44px] max-h-[160px] disabled:opacity-40"
//                   style={{
//                     height: 'auto',
//                     minHeight: '44px',
//                   }}
//                   onInput={(e) => {
//                     const target = e.target as HTMLTextAreaElement;
//                     target.style.height = 'auto';
//                     target.style.height = Math.min(target.scrollHeight, 160) + 'px';
//                   }}
//                 />
//               </div>

//               {isStreaming ? (
//                 <GlassButton variant="danger" size="md" icon={StopCircle} onClick={cancelStream}>
//                   Stop
//                 </GlassButton>
//               ) : (
//                 <GlassButton
//                   variant="primary"
//                   size="md"
//                   icon={Send}
//                   onClick={handleSend}
//                   disabled={!message.trim()}
//                 >
//                   Send
//                 </GlassButton>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
