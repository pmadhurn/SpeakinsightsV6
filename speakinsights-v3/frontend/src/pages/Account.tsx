/**
 * SpeakInsights v3 — My Data (account) page
 *
 * Signed-in view of "what data exists for me": profile summary,
 * meeting counts, talk time, participants, transcripts, tasks, chat.
 * Guests are redirected to sign in.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useUser, useAuth } from '@clerk/react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UserCircle2,
  Video,
  Timer,
  Users,
  FileText,
  MessageSquare,
  ListChecks,
  CalendarClock,
  Loader2,
  AlertCircle,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import { users as usersApi } from '@/services/api';

interface UserMe {
  user: {
    id: string;
    clerk_id: string;
    email: string | null;
    display_name: string | null;
    avatar_url: string | null;
    member_since: string | null;
  };
  stats: {
    meetings_total: number;
    meetings_active: number;
    meetings_completed: number;
    total_duration_seconds: number;
    participants: number;
    transcript_segments: number;
    chat_messages: number;
    tasks_total: number;
    tasks_completed: number;
  };
  recent_meetings: {
    id: string;
    title: string;
    status: string;
    code: string;
    created_at: string | null;
    duration: number | null;
  }[];
}

function fmtDuration(sec: number): string {
  if (!sec || sec < 1) return '0m';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return '—';
  }
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  completed: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  processing: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  waiting: 'text-white/50 bg-white/5 border-white/10',
  failed: 'text-red-400 bg-red-500/10 border-red-500/20',
};

export default function Account() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user: clerkUser } = useUser();
  const navigate = useNavigate();
  const [data, setData] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate('/sign-in');
      return;
    }
    if (!isSignedIn) return;
    setLoading(true);
    usersApi
      .me()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(() => setError('Could not load your data. Is the backend running?'))
      .finally(() => setLoading(false));
  }, [isSignedIn, isLoaded, navigate]);

  const name =
    clerkUser?.fullName || data?.user.display_name || data?.user.email || 'You';

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen pt-40 flex items-center justify-center bg-[#02060B]">
        <Loader2 className="animate-spin text-cyan-400" size={36} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-16 bg-[#02060B] text-white selection:bg-cyan-500/30 font-sans relative overflow-x-hidden">
      {/* Ambient meshes */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-cyan-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-purple-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto px-6 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-white/5 shadow-lg">
              <UserCircle2 className="text-cyan-400" size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight">My <span className="text-white/40">Data</span></h1>
              <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-bold">
                {data ? `${data.stats.meetings_total} meeting${data.stats.meetings_total !== 1 ? 's' : ''} hosted` : ''}
              </p>
            </div>
          </div>

          {/* Error state */}
          {error && (
            <GlassCard variant="default" className="text-center py-12 px-6 mb-8">
              <AlertCircle className="text-red-400 mx-auto mb-4" size={32} />
              <p className="text-red-300 text-sm font-bold uppercase tracking-widest mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                Retry
              </button>
            </GlassCard>
          )}

          {data && (
            <>
              {/* Profile card */}
              <GlassCard variant="default" className="p-6 mb-8 flex flex-col sm:flex-row items-center gap-6">
                {clerkUser?.imageUrl ? (
                  <img
                    src={clerkUser.imageUrl}
                    alt={name}
                    className="w-16 h-16 rounded-2xl object-cover shadow-lg ring-1 ring-white/20"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-xl font-black shadow-lg">
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-lg font-black text-white">{name}</p>
                  <p className="text-xs text-white/40 mt-0.5">{data.user.email || '—'}</p>
                  <p className="text-[10px] text-white/30 mt-1 uppercase tracking-widest font-bold flex items-center justify-center sm:justify-start gap-1 mt-2">
                    <CalendarClock size={11} />
                    Member since {fmtDate(data.user.member_since)}
                  </p>
                </div>
                <span className="hidden sm:block text-[10px] uppercase tracking-widest font-black text-cyan-400/60">
                  Signed in via Clerk
                </span>
              </GlassCard>

              {/* Stat grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard icon={Video} label="MEETINGS" value={data.stats.meetings_total} sub={`${data.stats.meetings_active} active · ${data.stats.meetings_completed} done`} />
                <StatCard icon={Timer} label="TALK TIME" value={fmtDuration(data.stats.total_duration_seconds)} sub="across all meetings" />
                <StatCard icon={Users} label="PARTICIPANTS" value={data.stats.participants} sub="total joins" />
                <StatCard icon={FileText} label="TRANSCRIPTS" value={data.stats.transcript_segments} sub="segments captured" />
                <StatCard icon={MessageSquare} label="AI CHAT" value={data.stats.chat_messages} sub="messages exchanged" />
                <StatCard icon={ListChecks} label="TASKS" value={data.stats.tasks_total} sub={`${data.stats.tasks_completed} completed`} />
              </div>

              {/* Recent meetings */}
              <h2 className="text-sm font-black uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
                <Video size={14} className="text-cyan-400" /> Recent meetings
              </h2>
              <div className="space-y-3 mb-10">
                {data.recent_meetings.map((m) => (
                  <Link
                    key={m.id}
                    to={`/meeting/${m.id}/review`}
                    className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-cyan-500/20 transition-all group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div>
                        <p className="text-sm font-bold text-white truncate max-w-[320px]">{m.title}</p>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mt-1">
                          {fmtDate(m.created_at)} · {m.duration ? fmtDuration(m.duration) : 'no recording'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${STATUS_COLORS[m.status] || STATUS_COLORS.waiting}`}>
                        {m.status}
                      </span>
                      <ChevronRight size={16} className="text-white/20 group-hover:text-cyan-400 transition-colors" />
                    </div>
                  </Link>
                ))}
                {data.recent_meetings.length === 0 && (
                  <GlassCard variant="solid" className="text-center py-12 px-6 border-dashed border-white/20">
                    <p className="text-white/60 text-sm font-bold mb-1">NO MEETINGS YET</p>
                    <p className="text-xs text-white/30 mb-6">Host your first meeting to start building your history.</p>
                    <Link
                      to="/create"
                      className="inline-block px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 text-cyan-300 hover:text-cyan-200 transition-colors"
                    >
                      Create Meeting
                    </Link>
                  </GlassCard>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <GlassCard variant="default" className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-cyan-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</span>
      </div>
      <p className="text-2xl font-black text-white tracking-tight">{value}</p>
      <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold mt-1">{sub}</p>
    </GlassCard>
  );
}
