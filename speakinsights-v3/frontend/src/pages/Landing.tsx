import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, ArrowRight, Mic, Users, Brain, Calendar, Shield, Zap } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import GlassButton from '@/components/ui/GlassButton';
import GlassInput from '@/components/ui/GlassInput';

const features = [
  {
    icon: Users,
    title: 'Up to 20 Participants',
    description: 'Real-time video conferencing with LiveKit WebRTC',
    color: 'text-cyan',
  },
  {
    icon: Mic,
    title: 'Live Transcription',
    description: 'WhisperX-powered accurate transcripts with speaker labels',
    color: 'text-lavender',
  },
  {
    icon: Brain,
    title: 'AI Summaries & Tasks',
    description: 'Post-meeting analysis with Ollama LLM — summaries, tasks, sentiment',
    color: 'text-cyan',
  },
  {
    icon: Calendar,
    title: 'Calendar Export',
    description: 'Export action items as .ics calendar events',
    color: 'text-lavender',
  },
  {
    icon: Shield,
    title: 'Self-Hosted & Private',
    description: 'Everything runs on your hardware. No data leaves your network.',
    color: 'text-emerald-400',
  },
  {
    icon: Zap,
    title: 'RAG-Powered Chat',
    description: 'Ask questions about your meetings with context-aware AI',
    color: 'text-amber-400',
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState('');

  const handleJoin = () => {
    if (meetingCode.trim()) {
      navigate(`/join/${meetingCode.trim()}`);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-16">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              <span className="text-gradient">Intelligent</span>{' '}
              <span className="text-white/90">Meetings,</span>
              <br />
              <span className="text-white/90">Actionable </span>
              <span className="text-gradient">Insights</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed">
              Self-hosted meeting platform with real-time transcription, AI-powered summaries,
              sentiment analysis, and intelligent search — all running on your own hardware.
            </p>
          </motion.div>

          {/* Actions */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <GlassButton
              variant="primary"
              size="lg"
              icon={Plus}
              onClick={() => navigate('/create')}
            >
              Create Meeting
            </GlassButton>

            <div className="flex items-center gap-2">
              <GlassInput
                placeholder="Enter meeting code"
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                className="!w-48"
              />
              <GlassButton
                variant="ghost"
                size="lg"
                icon={ArrowRight}
                onClick={handleJoin}
                disabled={!meetingCode.trim()}
              >
                Join
              </GlassButton>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
            >
              <GlassCard className="h-full" shimmer>
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-glass bg-white/5">
                    <feature.icon className={feature.color} size={22} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white/90 mb-1">{feature.title}</h3>
                    <p className="text-sm text-white/50 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Stats */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <GlassCard variant="gradient" padding="lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: '20', label: 'Max Participants' },
                { value: '∞', label: 'Meetings' },
                { value: '100%', label: 'Self-Hosted' },
                { value: 'Free', label: 'Forever' },
              ].map(({ value, label }) => (
                <div key={label}>
                  <div className="text-3xl font-bold text-gradient mb-1">{value}</div>
                  <div className="text-sm text-white/50">{label}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </section>
    </div>
  );
}
