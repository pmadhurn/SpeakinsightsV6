import { motion } from 'framer-motion';
import { User, Bot } from 'lucide-react';
import { SourceCard } from './SourceCard';

interface Source {
  speaker_name: string;
  text: string;
  start_time: number;
  meeting_title: string;
  score: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatMessageProps {
  message: Message;
  sources?: Source[];
}

export function ChatMessage({ message, sources }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-cyan-500/20 text-cyan-400'
            : 'bg-purple-500/20 text-purple-400'
        }`}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-3 backdrop-blur-md border ${
            isUser
              ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-50'
              : 'bg-white/5 border-white/10 text-slate-200'
          }`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>

        {sources && sources.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-xs text-slate-400 px-1">Sources</p>
            {sources.map((source, i) => (
              <SourceCard key={i} {...source} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default ChatMessage;
