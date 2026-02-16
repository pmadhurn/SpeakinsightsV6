import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Bot, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import type { ChatSource } from '@/types/chat';
import { SourceCard } from './SourceCard';
import { formatDate } from '@/utils/formatTime';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  created_at?: string;
}

interface ChatMessageProps {
  message: Message;
  sources?: ChatSource[];
  isStreaming?: boolean;
}

/** Very simple markdown renderer — handles bold, inline code, code blocks, and bullet lists */
function renderMarkdown(text: string) {
  // Split by code blocks first
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    // Code block
    if (part.startsWith('```') && part.endsWith('```')) {
      const lines = part.slice(3, -3).split('\n');
      const lang = lines[0]?.trim() || '';
      const code = (lang ? lines.slice(1) : lines).join('\n').trim();
      return (
        <pre
          key={i}
          className="my-2 p-3 rounded-lg bg-black/30 border border-white/10 overflow-x-auto text-xs font-mono"
        >
          {lang && (
            <span className="text-[10px] text-white/30 uppercase block mb-1">{lang}</span>
          )}
          <code>{code}</code>
        </pre>
      );
    }

    // Inline processing: lines
    const lines = part.split('\n');
    return lines.map((line, j) => {
      // Bullet lists
      if (/^[-*]\s+/.test(line.trim())) {
        const content = line.trim().replace(/^[-*]\s+/, '');
        return (
          <div key={`${i}-${j}`} className="flex gap-2 ml-2">
            <span className="text-cyan/60 mt-0.5">•</span>
            <span>{renderInline(content)}</span>
          </div>
        );
      }

      // Numbered lists
      if (/^\d+\.\s+/.test(line.trim())) {
        const match = line.trim().match(/^(\d+)\.\s+(.*)/);
        if (match) {
          return (
            <div key={`${i}-${j}`} className="flex gap-2 ml-2">
              <span className="text-lavender/60 mt-0.5 text-xs min-w-[1rem]">{match[1]}.</span>
              <span>{renderInline(match[2])}</span>
            </div>
          );
        }
      }

      // Empty line
      if (!line.trim()) return <br key={`${i}-${j}`} />;

      return (
        <span key={`${i}-${j}`}>
          {renderInline(line)}
          {j < lines.length - 1 && <br />}
        </span>
      );
    });
  });
}

function renderInline(text: string) {
  // Bold, inline code
  const parts = text.split(/(\*\*.*?\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i} className="font-semibold text-white/95">{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith('`') && p.endsWith('`')) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-white/10 text-cyan/80 text-xs font-mono">
          {p.slice(1, -1)}
        </code>
      );
    }
    return p;
  });
}

export function ChatMessage({ message, sources, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 ${
          isUser
            ? 'bg-cyan/15 text-cyan border border-cyan/20'
            : 'bg-lavender/15 text-lavender border border-lavender/20'
        }`}
      >
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>

      {/* Message content */}
      <div className={`max-w-[80%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Meta info for assistant */}
        {!isUser && message.model && (
          <div className="flex items-center gap-2 mb-1 px-1">
            <span className="text-[10px] text-lavender/60 font-medium">{message.model}</span>
            {message.created_at && (
              <span className="text-[10px] text-white/25">
                {formatDate(message.created_at)}
              </span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div
          className={`rounded-2xl px-4 py-3 backdrop-blur-md border ${
            isUser
              ? 'bg-cyan/10 border-cyan/20 text-white/90'
              : 'bg-lavender/5 border-lavender/15 text-white/85'
          }`}
        >
          <div className="text-sm leading-relaxed">
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="space-y-0.5">{renderMarkdown(message.content)}</div>
            )}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-lavender/70 animate-pulse ml-0.5 -mb-0.5 rounded-sm" />
            )}
          </div>
        </div>

        {/* Actions for assistant msgs */}
        {!isUser && !isStreaming && message.content && (
          <div className="flex items-center gap-1 mt-1 px-1">
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-white/5 text-white/25 hover:text-white/50 transition-colors"
              title="Copy"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </button>
          </div>
        )}

        {/* RAG Sources */}
        {sources && sources.length > 0 && !isUser && (
          <div className="mt-2 w-full">
            <button
              onClick={() => setSourcesOpen(!sourcesOpen)}
              className="flex items-center gap-1.5 text-xs text-lavender/60 hover:text-lavender/80 transition-colors px-1"
            >
              {sourcesOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {sources.length} source{sources.length > 1 ? 's' : ''} referenced
            </button>
            {sourcesOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-1.5 space-y-1.5"
              >
                {sources.map((source, i) => (
                  <SourceCard key={i} {...source} />
                ))}
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default ChatMessage;
