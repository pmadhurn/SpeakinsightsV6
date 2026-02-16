import { motion } from 'framer-motion';
import { FileText, CheckCircle } from 'lucide-react';

interface SummaryCardProps {
  summary: string;
  key_points: string[];
}

export function SummaryCard({ summary, key_points }: SummaryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 bg-white/5 backdrop-blur-md border border-white/10"
    >
      <div className="flex items-center gap-2 mb-4">
        <FileText size={16} className="text-cyan-400" />
        <h3 className="text-sm font-semibold text-white">Meeting Summary</h3>
      </div>

      <p className="text-sm text-slate-300 leading-relaxed mb-4">{summary}</p>

      {key_points.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
            Key Points
          </h4>
          <ul className="space-y-1.5">
            {key_points.map((point, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-2 text-xs text-slate-300"
              >
                <CheckCircle
                  size={14}
                  className="text-cyan-400 flex-shrink-0 mt-0.5"
                />
                <span>{point}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}

export default SummaryCard;
