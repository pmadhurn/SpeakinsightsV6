import { motion } from 'framer-motion';
import { TrendingUp, Smile, Meh, Frown } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { getAvatarColor, getSentimentColor } from '@/utils/colors';
import type { SentimentData } from '@/types/summary';

interface SentimentChartProps {
  sentiment: SentimentData | null;
}

export function SentimentChart({ sentiment }: SentimentChartProps) {
  if (!sentiment) {
    return (
      <div className="rounded-2xl p-8 bg-white/[0.04] backdrop-blur-xl border border-white/10 text-center">
        <TrendingUp size={40} className="text-white/10 mx-auto mb-3" />
        <p className="text-sm text-white/40">No sentiment data available</p>
        <p className="text-xs text-white/20 mt-1">
          Sentiment analysis will be generated after meeting processing
        </p>
      </div>
    );
  }

  const { overall_score, overall_label, per_speaker, arc } = sentiment;

  // Format arc data for Recharts
  const arcData = arc.map((point) => ({
    ...point,
    minute: Math.round(point.time / 60),
    displayTime: `${Math.floor(point.time / 60)}:${String(Math.floor(point.time % 60)).padStart(2, '0')}`,
  }));

  // Speaker bar data
  const speakerData = per_speaker.map((s) => ({
    ...s,
    name: s.speaker_name,
    fillColor: getSentimentColor(s.score),
    avatarColor: getAvatarColor(s.speaker_name),
  }));

  // Overall sentiment icon
  const SentimentIcon = overall_score >= 0.3 ? Smile : overall_score <= -0.3 ? Frown : Meh;
  const sentimentColor = getSentimentColor(overall_score);

  return (
    <div className="space-y-4">
      {/* Overall Sentiment */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 bg-white/[0.04] backdrop-blur-xl border border-white/10"
      >
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: `${sentimentColor}15`,
              boxShadow: `0 0 20px ${sentimentColor}15`,
            }}
          >
            <SentimentIcon size={28} style={{ color: sentimentColor }} />
          </div>
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider">Overall Meeting Mood</p>
            <p className="text-lg font-bold text-white/90">
              {overall_label || (overall_score >= 0.3 ? 'Positive' : overall_score <= -0.3 ? 'Negative' : 'Neutral')}
            </p>
            <p className="text-sm font-mono" style={{ color: sentimentColor }}>
              {overall_score >= 0 ? '+' : ''}{overall_score.toFixed(2)}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Sentiment Timeline */}
      {arcData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-5 bg-white/[0.04] backdrop-blur-xl border border-white/10"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-cyan" />
            <h3 className="text-sm font-semibold text-white/90">Sentiment Timeline</h3>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={arcData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34D399" stopOpacity={0.4} />
                    <stop offset="50%" stopColor="#FBBF24" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#F87171" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="displayTime"
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[-1, 1]}
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                  ticks={[-1, -0.5, 0, 0.5, 1]}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(30, 41, 59, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                  formatter={(value: number) => [value.toFixed(2), 'Sentiment']}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#22D3EE"
                  strokeWidth={2}
                  fill="url(#sentimentGradient)"
                  dot={{ fill: '#22D3EE', strokeWidth: 0, r: 3 }}
                  activeDot={{ fill: '#22D3EE', strokeWidth: 2, stroke: 'white', r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Speaker Sentiment Breakdown */}
      {speakerData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-5 bg-white/[0.04] backdrop-blur-xl border border-white/10"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-lavender" />
            <h3 className="text-sm font-semibold text-white/90">Speaker Sentiment</h3>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={speakerData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[-1, 1]}
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(30, 41, 59, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [value.toFixed(2), 'Sentiment']}
                />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {speakerData.map((entry, i) => (
                    <Cell key={i} fill={entry.fillColor} fillOpacity={0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Speaker summaries */}
          <div className="mt-4 space-y-2">
            {per_speaker.map((s, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white/[0.02] text-xs"
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                  style={{
                    backgroundColor: `${getAvatarColor(s.speaker_name)}20`,
                    color: getAvatarColor(s.speaker_name),
                  }}
                >
                  {s.speaker_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="font-medium text-white/70">{s.speaker_name}</span>
                  <span className="text-white/30 ml-1.5">
                    ({s.label || (s.score >= 0.3 ? 'Positive' : s.score <= -0.3 ? 'Negative' : 'Neutral')})
                  </span>
                  {s.summary && (
                    <p className="text-white/40 mt-0.5">{s.summary}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default SentimentChart;
