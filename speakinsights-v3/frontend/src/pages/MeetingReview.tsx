import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, FileText, CheckSquare, BarChart3 } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import Badge from '@/components/ui/Badge';

export default function MeetingReview() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-white/90 mb-2">Meeting Review</h1>
          <p className="text-sm text-white/40 mb-8">Meeting ID: {id}</p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Recording */}
            <div className="lg:col-span-2">
              <GlassCard variant="heavy" padding="none" className="aspect-video flex items-center justify-center">
                <div className="text-center">
                  <Play className="text-cyan/40 mx-auto mb-3" size={48} />
                  <p className="text-white/40 text-sm">Recording playback</p>
                </div>
              </GlassCard>
            </div>

            {/* Summary sidebar */}
            <div className="space-y-4">
              <GlassCard>
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-cyan" />
                  <h3 className="font-semibold text-white/90">Summary</h3>
                </div>
                <p className="text-sm text-white/50 leading-relaxed">
                  AI-generated summary will appear here after post-processing completes.
                </p>
              </GlassCard>

              <GlassCard>
                <div className="flex items-center gap-2 mb-3">
                  <CheckSquare size={16} className="text-lavender" />
                  <h3 className="font-semibold text-white/90">Tasks</h3>
                  <Badge text="0" variant="gray" />
                </div>
                <p className="text-sm text-white/50">
                  Extracted action items will appear here.
                </p>
              </GlassCard>

              <GlassCard>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 size={16} className="text-emerald-400" />
                  <h3 className="font-semibold text-white/90">Sentiment</h3>
                </div>
                <p className="text-sm text-white/50">
                  Sentiment analysis will appear here.
                </p>
              </GlassCard>
            </div>
          </div>

          {/* Transcript */}
          <div className="mt-6">
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <FileText size={16} className="text-cyan" />
                <h3 className="font-semibold text-white/90">Full Transcript</h3>
              </div>
              <p className="text-sm text-white/40">
                Transcript with speaker labels and timestamps will appear here.
              </p>
            </GlassCard>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
