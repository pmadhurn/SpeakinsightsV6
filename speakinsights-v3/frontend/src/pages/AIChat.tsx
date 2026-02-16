import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot, Sparkles, ToggleLeft, ToggleRight } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import GlassButton from '@/components/ui/GlassButton';
import GlassInput from '@/components/ui/GlassInput';

export default function AIChat() {
  const [message, setMessage] = useState('');
  const [useRag, setUseRag] = useState(true);

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 flex flex-col h-[calc(100vh-8rem)]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-glass bg-lavender/10">
                <Bot className="text-lavender" size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white/90">AI Chat</h1>
                <p className="text-xs text-white/40">Ask questions about your meetings</p>
              </div>
            </div>
            <button
              onClick={() => setUseRag(!useRag)}
              className="flex items-center gap-2 text-sm text-white/50 hover:text-white/70 transition-colors"
            >
              <Sparkles size={14} className={useRag ? 'text-cyan' : ''} />
              RAG
              {useRag ? (
                <ToggleRight size={20} className="text-cyan" />
              ) : (
                <ToggleLeft size={20} />
              )}
            </button>
          </div>
        </motion.div>

        {/* Chat messages area */}
        <div className="flex-1 overflow-y-auto mb-4">
          <GlassCard variant="surface" className="h-full flex items-center justify-center">
            <div className="text-center">
              <Bot className="text-white/15 mx-auto mb-3" size={48} />
              <p className="text-white/30 text-sm">
                Ask a question about your meetings...
              </p>
              <p className="text-white/20 text-xs mt-1">
                {useRag ? 'RAG enabled — answers grounded in meeting transcripts' : 'Direct LLM mode'}
              </p>
            </div>
          </GlassCard>
        </div>

        {/* Input */}
        <div className="flex gap-3">
          <div className="flex-1">
            <GlassInput
              placeholder="Type your question..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <GlassButton
            variant="primary"
            icon={Send}
            disabled={!message.trim()}
          >
            Send
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
