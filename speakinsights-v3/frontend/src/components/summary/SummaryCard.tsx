import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  CheckCircle,
  ListOrdered,
  Tag,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import GlassButton from '@/components/ui/GlassButton';
import type { Summary } from '@/types/summary';

interface SummaryCardProps {
  summary: Summary | null;
  onRegenerate?: () => void;
}

export function SummaryCard({ summary, onRegenerate }: SummaryCardProps) {
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    setRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  };

  if (!summary) {
    return (
      <div className="rounded-2xl p-8 bg-white/[0.04] backdrop-blur-xl border border-white/10 text-center">
        <Brain size={40} className="text-white/10 mx-auto mb-3" />
        <p className="text-sm text-white/40 mb-1">No summary available</p>
        <p className="text-xs text-white/20">
          Summary will be generated after meeting processing completes
        </p>
        {onRegenerate && (
          <div className="mt-4">
            <GlassButton variant="secondary" size="sm" icon={RefreshCw} onClick={handleRegenerate}>
              Generate Summary
            </GlassButton>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Executive Summary */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 bg-white/[0.04] backdrop-blur-xl border border-white/10"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-cyan/10">
            <Brain size={16} className="text-cyan" />
          </div>
          <h3 className="text-sm font-semibold text-white/90">Executive Summary</h3>
          <Sparkles size={12} className="text-lavender ml-auto" />
        </div>
        <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
          {summary.executive_summary}
        </p>
      </motion.div>

      {/* Key Points */}
      {summary.key_points && summary.key_points.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-5 bg-white/[0.04] backdrop-blur-xl border border-white/10"
        >
          <div className="flex items-center gap-2 mb-3">
            <ListOrdered size={16} className="text-cyan" />
            <h4 className="text-sm font-semibold text-white/90">Key Points</h4>
            <span className="text-[10px] text-white/30 ml-auto">{summary.key_points.length}</span>
          </div>
          <ul className="space-y-2">
            {summary.key_points.map((point, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="flex items-start gap-2.5 text-xs text-white/70"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan/10 text-cyan text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{point}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Decisions */}
      {summary.decisions && summary.decisions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-5 bg-white/[0.04] backdrop-blur-xl border border-white/10"
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} className="text-emerald-400" />
            <h4 className="text-sm font-semibold text-white/90">Decisions Made</h4>
            <span className="text-[10px] text-white/30 ml-auto">{summary.decisions.length}</span>
          </div>
          <ul className="space-y-2">
            {summary.decisions.map((decision, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                className="flex items-start gap-2 text-xs text-white/70"
              >
                <CheckCircle size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{decision}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Topics */}
      {summary.topics && summary.topics.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl p-5 bg-white/[0.04] backdrop-blur-xl border border-white/10"
        >
          <div className="flex items-center gap-2 mb-3">
            <ListOrdered size={16} className="text-amber-400" />
            <h4 className="text-sm font-semibold text-white/90">Topics Discussed</h4>
            <span className="text-[10px] text-white/30 ml-auto">{summary.topics.length}</span>
          </div>
          <ul className="space-y-2">
            {summary.topics.map((topic, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                className="flex items-start gap-2.5 text-xs text-white/70"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-400/10 text-amber-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{topic}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Themes */}
      {summary.themes && summary.themes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl p-5 bg-white/[0.04] backdrop-blur-xl border border-white/10"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-lavender" />
            <h4 className="text-sm font-semibold text-white/90">Themes</h4>
          </div>
          <div className="space-y-2">
            {summary.themes.map((theme, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="flex items-start gap-2 px-3 py-2 rounded-lg bg-lavender/5 border border-lavender/10 text-xs text-white/70"
              >
                <Sparkles size={12} className="text-lavender flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{theme}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Keywords */}
      {summary.keywords && summary.keywords.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl p-5 bg-white/[0.04] backdrop-blur-xl border border-white/10"
        >
          <div className="flex items-center gap-2 mb-3">
            <Tag size={16} className="text-cyan" />
            <h4 className="text-sm font-semibold text-white/90">Keywords</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.keywords.map((keyword, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35 + i * 0.03 }}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-cyan/10 text-cyan border border-cyan/15 hover:bg-cyan/15 transition-colors"
              >
                {keyword}
              </motion.span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Footer: model info + regenerate */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-white/20">
          {summary.model_used && <>Model: {summary.model_used}</>}
          {summary.created_at && (
            <span className="ml-2">
              Generated: {new Date(summary.created_at).toLocaleDateString()}
            </span>
          )}
        </div>
        {onRegenerate && (
          <GlassButton
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            loading={regenerating}
            onClick={handleRegenerate}
          >
            Regenerate
          </GlassButton>
        )}
      </div>
    </div>
  );
}

export default SummaryCard;
