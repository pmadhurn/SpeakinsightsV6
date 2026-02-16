import { motion } from 'framer-motion';
import { MeetingCard } from './MeetingCard';

interface Meeting {
  id: string;
  title: string;
  status: string;
  created_at: string;
  participant_count: number;
  duration: number;
}

interface MeetingTimelineProps {
  meetings: Meeting[];
}

export function MeetingTimeline({ meetings }: MeetingTimelineProps) {
  const grouped = meetings.reduce<Record<string, Meeting[]>>((acc, meeting) => {
    const date = new Date(meeting.created_at).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(meeting);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, dateMeetings]) => (
        <motion.div
          key={date}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
            <h3 className="text-sm font-medium text-slate-300">{date}</h3>
            <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          <div className="ml-4 pl-4 border-l border-white/5 space-y-2">
            {dateMeetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </div>
        </motion.div>
      ))}

      {meetings.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p className="text-sm">No meetings yet</p>
        </div>
      )}
    </div>
  );
}

export default MeetingTimeline;
