import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageSquare } from 'lucide-react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { DataPacket_Kind, RoomEvent } from 'livekit-client';
import { getAvatarColor } from '@/utils/colors';

interface ChatMsg {
  id: string;
  sender: string;
  senderIdentity: string;
  content: string;
  timestamp: number;
  isOwn: boolean;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for incoming data messages
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (
      payload: Uint8Array,
      participant?: { identity: string; name?: string } | undefined,
      _kind?: DataPacket_Kind
    ) => {
      try {
        const data = JSON.parse(decoder.decode(payload));
        if (data.type === 'chat') {
          const msg: ChatMsg = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            sender: data.sender || participant?.name || participant?.identity || 'Unknown',
            senderIdentity: data.senderIdentity || participant?.identity || '',
            content: data.content,
            timestamp: data.timestamp || Date.now(),
            isOwn: false,
          };
          setMessages((prev) => [...prev, msg]);
        }
      } catch (err) {
        console.warn('[ChatPanel] Failed to parse message:', err);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !localParticipant) return;

    const content = input.trim();
    const senderName = localParticipant.name || localParticipant.identity;

    // Add to local messages
    const msg: ChatMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sender: senderName,
      senderIdentity: localParticipant.identity,
      content,
      timestamp: Date.now(),
      isOwn: true,
    };
    setMessages((prev) => [...prev, msg]);

    // Send via LiveKit data channel
    const data = encoder.encode(
      JSON.stringify({
        type: 'chat',
        sender: senderName,
        senderIdentity: localParticipant.identity,
        content,
        timestamp: Date.now(),
      })
    );

    try {
      localParticipant.publishData(data, { reliable: true });
    } catch (err) {
      console.error('[ChatPanel] Failed to send message:', err);
    }

    setInput('');
  }, [input, localParticipant]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <MessageSquare size={16} className="text-cyan" />
        <h3 className="text-sm font-medium text-white/90">Chat</h3>
        {messages.length > 0 && (
          <span className="ml-auto text-[10px] text-white/30">
            {messages.length} messages
          </span>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare size={24} className="text-white/15 mb-2" />
            <p className="text-xs text-white/30">No messages yet</p>
            <p className="text-[10px] text-white/20 mt-1">
              Messages are sent via LiveKit data channels
            </p>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.isOwn ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 ${
                  msg.isOwn
                    ? 'bg-cyan/10 border border-cyan/20'
                    : 'bg-lavender/10 border border-lavender/20'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: getAvatarColor(msg.sender) }}
                  >
                    {msg.isOwn ? 'You' : msg.sender}
                  </span>
                  <span className="text-[9px] text-white/20">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-white/80 leading-relaxed break-words">
                  {msg.content}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/90 placeholder-white/30 outline-none focus:border-cyan/50 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={`p-2 rounded-lg transition-colors ${
              input.trim()
                ? 'bg-cyan/20 text-cyan hover:bg-cyan/30'
                : 'bg-white/5 text-white/20 cursor-not-allowed'
            }`}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatPanel;
