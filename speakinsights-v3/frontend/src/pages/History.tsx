import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  History as HistoryIcon,
  Search,
  ArrowUpDown,
  Plus,
  Loader2,
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import GlassInput from '@/components/ui/GlassInput';
import GlassButton from '@/components/ui/GlassButton';
import { MeetingCard } from '@/components/history/MeetingCard';
import { useNavigate } from 'react-router-dom';
import { meetings as meetingsApi } from '@/services/api';
import type { Meeting } from '@/types/meeting';

type FilterTab = 'all' | 'ended' | 'processing' | 'archived';
type SortBy = 'recent' | 'longest' | 'participants';

export default function History() {
  const navigate = useNavigate();
  const [allMeetings, setAllMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [visibleCount, setVisibleCount] = useState(20);

  // Fetch meetings
  useEffect(() => {
    setLoading(true);
    meetingsApi
      .list()
      .then((data) => {
        setAllMeetings(data);
        setError(null);
      })
      .catch(() => setError('Failed to load meetings'))
      .finally(() => setLoading(false));
  }, []);

  // Filter + search + sort
  const filteredMeetings = useMemo(() => {
    let result = allMeetings;

    // Filter by status
    if (filter === 'ended') result = result.filter((m) => m.status === 'completed');
    else if (filter === 'processing') result = result.filter((m) => m.status === 'processing');
    else if (filter === 'archived') result = result.filter((m) => m.status === 'cancelled');

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.host_name?.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy === 'recent') result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortBy === 'longest') result = [...result].sort((a, b) => (b.duration || 0) - (a.duration || 0));
    else if (sortBy === 'participants') result = [...result].sort((a, b) => (b.participant_count || 0) - (a.participant_count || 0));

    return result;
  }, [allMeetings, filter, search, sortBy]);

  const visibleMeetings = filteredMeetings.slice(0, visibleCount);
  const hasMore = visibleCount < filteredMeetings.length;

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'ended', label: 'Ended' },
    { key: 'processing', label: 'Processing' },
    { key: 'archived', label: 'Archived' },
  ];

  const sortOptions: { key: SortBy; label: string }[] = [
    { key: 'recent', label: 'Most Recent' },
    { key: 'longest', label: 'Longest' },
    { key: 'participants', label: 'Most Participants' },
  ];

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-glass bg-lavender/10">
                <HistoryIcon className="text-lavender" size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white/90">Meeting History</h1>
                <p className="text-xs text-white/40 mt-0.5">
                  {allMeetings.length} meeting{allMeetings.length !== 1 ? 's' : ''} total
                </p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mb-4">
            <GlassInput
              placeholder="Search meetings..."
              icon={Search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filter tabs + Sort */}
          <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <div className="flex gap-1.5">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setFilter(tab.key); setVisibleCount(20); }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                    filter === tab.key
                      ? 'bg-cyan/20 text-cyan border border-cyan/30'
                      : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <ArrowUpDown size={12} className="text-white/30" />
              {sortOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                    sortBy === opt.key
                      ? 'bg-lavender/15 text-lavender border border-lavender/20'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-cyan" size={28} />
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <GlassCard variant="surface" className="text-center py-12">
              <p className="text-red-400 text-sm mb-3">{error}</p>
              <GlassButton variant="ghost" size="sm" onClick={() => window.location.reload()}>
                Retry
              </GlassButton>
            </GlassCard>
          )}

          {/* Meeting list */}
          {!loading && !error && (
            <div className="space-y-3">
              {visibleMeetings.map((meeting, i) => (
                <motion.div
                  key={meeting.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.5) }}
                >
                  <MeetingCard meeting={meeting} />
                </motion.div>
              ))}

              {/* Load More */}
              {hasMore && (
                <div className="text-center pt-4">
                  <GlassButton variant="ghost" size="sm" onClick={() => setVisibleCount((c) => c + 20)}>
                    Load More ({filteredMeetings.length - visibleCount} remaining)
                  </GlassButton>
                </div>
              )}

              {/* Empty state */}
              {filteredMeetings.length === 0 && (
                <GlassCard variant="surface" className="text-center py-16">
                  <HistoryIcon className="text-white/15 mx-auto mb-4" size={48} />
                  <p className="text-white/50 mb-1">
                    {search ? 'No meetings match your search' : 'No meetings yet'}
                  </p>
                  <p className="text-xs text-white/30 mb-5">
                    {search ? 'Try a different search term' : 'Create your first meeting to get started!'}
                  </p>
                  {!search && (
                    <GlassButton variant="primary" size="md" icon={Plus} onClick={() => navigate('/create')}>
                      Create Meeting
                    </GlassButton>
                  )}
                </GlassCard>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
