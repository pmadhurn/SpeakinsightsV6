import { motion } from 'framer-motion';
import { History as HistoryIcon, Clock, Users, ChevronRight } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import Badge from '@/components/ui/Badge';
import { useNavigate } from 'react-router-dom';

const mockMeetings = [
  { id: '1', title: 'Sprint Planning', status: 'completed', date: '2026-02-15', participants: 5, duration: '45 min' },
  { id: '2', title: 'Client Review Q1', status: 'completed', date: '2026-02-14', participants: 8, duration: '1h 20min' },
  { id: '3', title: 'Architecture Discussion', status: 'processing', date: '2026-02-13', participants: 4, duration: '30 min' },
];

export default function History() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 rounded-glass bg-lavender/10">
              <HistoryIcon className="text-lavender" size={22} />
            </div>
            <h1 className="text-2xl font-bold text-white/90">Meeting History</h1>
          </div>

          <div className="space-y-3">
            {mockMeetings.map((meeting, i) => (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <GlassCard
                  onClick={() => navigate(`/meeting/${meeting.id}/review`)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="font-semibold text-white/90">{meeting.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {meeting.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {meeting.participants} participants
                        </span>
                        <span>{meeting.duration}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      text={meeting.status}
                      variant={meeting.status === 'completed' ? 'green' : 'yellow'}
                    />
                    <ChevronRight size={16} className="text-white/30" />
                  </div>
                </GlassCard>
              </motion.div>
            ))}

            {mockMeetings.length === 0 && (
              <GlassCard variant="surface" className="text-center py-12">
                <HistoryIcon className="text-white/20 mx-auto mb-3" size={40} />
                <p className="text-white/40">No meetings yet. Create your first meeting!</p>
              </GlassCard>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
