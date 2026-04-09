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
    <div className="min-h-screen pt-32 pb-16 bg-[#02060B] text-white selection:bg-cyan-500/30 font-sans relative overflow-x-hidden">
      
      {/* Visual Ambient Meshes (Syncing exactly to your landing page) */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-cyan-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-purple-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto px-6 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/5 shadow-lg">
                <HistoryIcon className="text-cyan-400" size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white uppercase tracking-tight">Meeting <span className="text-white/40">History</span></h1>
                <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-bold">
                  {allMeetings.length} meeting{allMeetings.length !== 1 ? 's' : ''} total
                </p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative group">
              <GlassInput
                placeholder="Search meetings..."
                icon={Search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/[0.03] border-white/10 text-white focus:bg-white/[0.05] focus:border-cyan-500/50 rounded-2xl font-medium tracking-wide placeholder:text-white/20 transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Filter tabs + Sort */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            
            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setFilter(tab.key); setVisibleCount(20); }}
                  className={`px-4 py-2 rounded-xl text-[11px] uppercase tracking-widest font-black transition-all ${
                    filter === tab.key
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                      : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10 hover:text-white/80'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <ArrowUpDown size={14} className="text-white/30 mr-1" />
              {sortOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                    sortBy === opt.key
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.1)]'
                      : 'bg-transparent text-white/30 border border-transparent hover:text-white/60'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-32">
              <Loader2 className="animate-spin text-cyan-400" size={36} />
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <GlassCard variant="default" className="text-center py-16 px-6">
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm py-4 px-6 rounded-2xl inline-block mb-6 font-bold uppercase tracking-widest">
                {error}
              </div>
              <div className="flex justify-center">
                <GlassButton variant="secondary" onClick={() => window.location.reload()}>
                  Retry Connection
                </GlassButton>
              </div>
            </GlassCard>
          )}

          {/* Meeting List Array */}
          {!loading && !error && (
            <div className="space-y-4">
              {visibleMeetings.map((meeting, i) => (
                <motion.div
                  key={meeting.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.5) }}
                >
                  <MeetingCard
                    meeting={meeting}
                    onDeleted={(id) => setAllMeetings((prev) => prev.filter((m) => m.id !== id))}
                    onUpdated={(updated) =>
                      setAllMeetings((prev) =>
                        prev.map((m) => (m.id === updated.id ? updated : m))
                      )
                    }
                  />
                </motion.div>
              ))}

              {/* Load More Section */}
              {hasMore && (
                <div className="text-center pt-8">
                  <GlassButton variant="outline" className="mx-auto !text-xs !py-3 !px-6" onClick={() => setVisibleCount((c) => c + 20)}>
                    Load More <span className="opacity-50 ml-1 font-normal">({filteredMeetings.length - visibleCount} remaining)</span>
                  </GlassButton>
                </div>
              )}

              {/* Empty state (No Meetings found) */}
              {filteredMeetings.length === 0 && (
                <GlassCard variant="solid" className="text-center py-20 px-6 border-dashed border-white/20">
                  <HistoryIcon className="text-cyan-400/20 mx-auto mb-6" size={56} />
                  <p className="text-white/60 text-lg font-bold mb-2">
                    {search ? 'NO MEETINGS FOUND' : 'YOUR VAULT IS EMPTY'}
                  </p>
                  <p className="text-sm text-white/30 mb-8 max-w-sm mx-auto">
                    {search 
                      ? 'No items matched your query. Please adjust your filters and try again.' 
                      : 'Create your first encrypted local meeting room to start capturing secure history.'}
                  </p>
                  
                  {!search && (
                    <div className="flex justify-center">
                      <GlassButton variant="primary" size="md" icon={Plus} onClick={() => navigate('/create')}>
                        Create Meeting
                      </GlassButton>
                    </div>
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
// import { useState, useEffect, useMemo } from 'react';
// import { motion } from 'framer-motion';
// import {
//   History as HistoryIcon,
//   Search,
//   ArrowUpDown,
//   Plus,
//   Loader2,
// } from 'lucide-react';
// import GlassCard from '@/components/ui/GlassCard';
// import GlassInput from '@/components/ui/GlassInput';
// import GlassButton from '@/components/ui/GlassButton';
// import { MeetingCard } from '@/components/history/MeetingCard';
// import { useNavigate } from 'react-router-dom';
// import { meetings as meetingsApi } from '@/services/api';
// import type { Meeting } from '@/types/meeting';

// type FilterTab = 'all' | 'ended' | 'processing' | 'archived';
// type SortBy = 'recent' | 'longest' | 'participants';

// export default function History() {
//   const navigate = useNavigate();
//   const [allMeetings, setAllMeetings] = useState<Meeting[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [search, setSearch] = useState('');
//   const [filter, setFilter] = useState<FilterTab>('all');
//   const [sortBy, setSortBy] = useState<SortBy>('recent');
//   const [visibleCount, setVisibleCount] = useState(20);

//   // Fetch meetings
//   useEffect(() => {
//     setLoading(true);
//     meetingsApi
//       .list()
//       .then((data) => {
//         setAllMeetings(data);
//         setError(null);
//       })
//       .catch(() => setError('Failed to load meetings'))
//       .finally(() => setLoading(false));
//   }, []);

//   // Filter + search + sort
//   const filteredMeetings = useMemo(() => {
//     let result = allMeetings;

//     // Filter by status
//     if (filter === 'ended') result = result.filter((m) => m.status === 'completed');
//     else if (filter === 'processing') result = result.filter((m) => m.status === 'processing');
//     else if (filter === 'archived') result = result.filter((m) => m.status === 'cancelled');

//     // Search
//     if (search.trim()) {
//       const q = search.toLowerCase();
//       result = result.filter(
//         (m) =>
//           m.title.toLowerCase().includes(q) ||
//           m.host_name?.toLowerCase().includes(q) ||
//           m.description?.toLowerCase().includes(q)
//       );
//     }

//     // Sort
//     if (sortBy === 'recent') result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
//     else if (sortBy === 'longest') result = [...result].sort((a, b) => (b.duration || 0) - (a.duration || 0));
//     else if (sortBy === 'participants') result = [...result].sort((a, b) => (b.participant_count || 0) - (a.participant_count || 0));

//     return result;
//   }, [allMeetings, filter, search, sortBy]);

//   const visibleMeetings = filteredMeetings.slice(0, visibleCount);
//   const hasMore = visibleCount < filteredMeetings.length;

//   const tabs: { key: FilterTab; label: string }[] = [
//     { key: 'all', label: 'All' },
//     { key: 'ended', label: 'Ended' },
//     { key: 'processing', label: 'Processing' },
//     { key: 'archived', label: 'Archived' },
//   ];

//   const sortOptions: { key: SortBy; label: string }[] = [
//     { key: 'recent', label: 'Most Recent' },
//     { key: 'longest', label: 'Longest' },
//     { key: 'participants', label: 'Most Participants' },
//   ];

//   return (
//     <div className="min-h-screen pt-24 pb-16">
//       <div className="max-w-4xl mx-auto px-4">
//         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
//           {/* Header */}
//           <div className="flex items-center justify-between mb-6">
//             <div className="flex items-center gap-3">
//               <div className="p-2.5 rounded-glass bg-lavender/10">
//                 <HistoryIcon className="text-lavender" size={22} />
//               </div>
//               <div>
//                 <h1 className="text-2xl font-bold text-white/90">Meeting History</h1>
//                 <p className="text-xs text-white/40 mt-0.5">
//                   {allMeetings.length} meeting{allMeetings.length !== 1 ? 's' : ''} total
//                 </p>
//               </div>
//             </div>
//           </div>

//           {/* Search */}
//           <div className="mb-4">
//             <GlassInput
//               placeholder="Search meetings..."
//               icon={Search}
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//             />
//           </div>

//           {/* Filter tabs + Sort */}
//           <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
//             <div className="flex gap-1.5">
//               {tabs.map((tab) => (
//                 <button
//                   key={tab.key}
//                   onClick={() => { setFilter(tab.key); setVisibleCount(20); }}
//                   className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
//                     filter === tab.key
//                       ? 'bg-cyan/20 text-cyan border border-cyan/30'
//                       : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70'
//                   }`}
//                 >
//                   {tab.label}
//                 </button>
//               ))}
//             </div>

//             <div className="flex items-center gap-1.5">
//               <ArrowUpDown size={12} className="text-white/30" />
//               {sortOptions.map((opt) => (
//                 <button
//                   key={opt.key}
//                   onClick={() => setSortBy(opt.key)}
//                   className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
//                     sortBy === opt.key
//                       ? 'bg-lavender/15 text-lavender border border-lavender/20'
//                       : 'text-white/40 hover:text-white/60'
//                   }`}
//                 >
//                   {opt.label}
//                 </button>
//               ))}
//             </div>
//           </div>

//           {/* Loading */}
//           {loading && (
//             <div className="flex items-center justify-center py-20">
//               <Loader2 className="animate-spin text-cyan" size={28} />
//             </div>
//           )}

//           {/* Error */}
//           {error && !loading && (
//             <GlassCard variant="surface" className="text-center py-12">
//               <p className="text-red-400 text-sm mb-3">{error}</p>
//               <GlassButton variant="ghost" size="sm" onClick={() => window.location.reload()}>
//                 Retry
//               </GlassButton>
//             </GlassCard>
//           )}

//           {/* Meeting list */}
//           {!loading && !error && (
//             <div className="space-y-3">
//               {visibleMeetings.map((meeting, i) => (
//                 <motion.div
//                   key={meeting.id}
//                   initial={{ opacity: 0, y: 10 }}
//                   animate={{ opacity: 1, y: 0 }}
//                   transition={{ delay: Math.min(i * 0.05, 0.5) }}
//                 >
//                   <MeetingCard meeting={meeting} />
//                 </motion.div>
//               ))}

//               {/* Load More */}
//               {hasMore && (
//                 <div className="text-center pt-4">
//                   <GlassButton variant="ghost" size="sm" onClick={() => setVisibleCount((c) => c + 20)}>
//                     Load More ({filteredMeetings.length - visibleCount} remaining)
//                   </GlassButton>
//                 </div>
//               )}

//               {/* Empty state */}
//               {filteredMeetings.length === 0 && (
//                 <GlassCard variant="surface" className="text-center py-16">
//                   <HistoryIcon className="text-white/15 mx-auto mb-4" size={48} />
//                   <p className="text-white/50 mb-1">
//                     {search ? 'No meetings match your search' : 'No meetings yet'}
//                   </p>
//                   <p className="text-xs text-white/30 mb-5">
//                     {search ? 'Try a different search term' : 'Create your first meeting to get started!'}
//                   </p>
//                   {!search && (
//                     <GlassButton variant="primary" size="md" icon={Plus} onClick={() => navigate('/create')}>
//                       Create Meeting
//                     </GlassButton>
//                   )}
//                 </GlassCard>
//               )}
//             </div>
//           )}
//         </motion.div>
//       </div>
//     </div>
//   );
// }
