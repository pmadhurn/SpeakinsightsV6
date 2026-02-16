import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

interface SentimentArcPoint {
  time: number;
  score: number;
  speaker?: string;
}

interface SentimentChartProps {
  data: SentimentArcPoint[];
}

export function SentimentChart({ data }: SentimentChartProps) {
  const maxScore = Math.max(...data.map((d) => Math.abs(d.score)), 1);

  return (
    <div className="rounded-2xl p-4 bg-white/5 backdrop-blur-md border border-white/10">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={16} className="text-purple-400" />
        <h3 className="text-sm font-medium text-white">Sentiment Arc</h3>
      </div>

      {data.length === 0 ? (
        <div className="h-32 flex items-center justify-center">
          <p className="text-xs text-slate-500">No sentiment data yet</p>
        </div>
      ) : (
        <div className="h-32 flex items-end gap-0.5">
          {data.map((point, i) => {
            const height = (Math.abs(point.score) / maxScore) * 100;
            const isPositive = point.score >= 0;
            return (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ delay: i * 0.02 }}
                title={`${point.speaker || 'Unknown'}: ${point.score.toFixed(2)}`}
                className={`flex-1 min-w-[3px] max-w-3 rounded-t transition-colors ${
                  isPositive
                    ? 'bg-cyan-400/60 hover:bg-cyan-400'
                    : 'bg-purple-400/60 hover:bg-purple-400'
                }`}
              />
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 text-[10px] text-slate-500">
        <span>Start</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400/60" /> Positive
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-400/60" /> Negative
          </span>
        </div>
        <span>End</span>
      </div>
    </div>
  );
}

export default SentimentChart;
