import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ScrollText,
    Search,
    Download,
    ArrowLeft,
    Users,
    Clock,
    ChevronDown,
    Filter,
    ArrowUpDown,
    Loader2,
    Play,
    Copy,
    CheckCircle2,
    CalendarDays,
    MessageSquare,
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import GlassButton from '@/components/ui/GlassButton';
import Avatar from '@/components/ui/Avatar';
import Loader from '@/components/ui/Loader';
import { meetings as meetingsApi, transcriptions } from '@/services/api';
import { formatDuration, formatTimestamp, formatDate } from '@/utils/formatTime';
import { getAvatarColor, getSentimentColor } from '@/utils/colors';
import { glassToast } from '@/components/ui/Toast';
import type { Meeting } from '@/types/meeting';
import type { TranscriptSegment } from '@/types/transcription';

type SortMode = 'time' | 'speaker';

export default function Transcription() {
    const { id: meetingId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const highlightTime = searchParams.get('t') ? parseFloat(searchParams.get('t')!) : null;

    const [meeting, setMeeting] = useState<Meeting | null>(null);
    const [segments, setSegments] = useState<TranscriptSegment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSpeakers, setSelectedSpeakers] = useState<Set<string>>(new Set());
    const [showSpeakerFilter, setShowSpeakerFilter] = useState(false);
    const [sortMode, setSortMode] = useState<SortMode>('time');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showSentiment, setShowSentiment] = useState(true);

    // Fetch meeting and transcript data
    useEffect(() => {
        if (!meetingId) return;
        setLoading(true);
        Promise.allSettled([
            meetingsApi.get(meetingId),
            transcriptions.getTranscript(meetingId),
        ])
            .then(([meetingResult, segmentsResult]) => {
                if (meetingResult.status === 'fulfilled') setMeeting(meetingResult.value);
                if (segmentsResult.status === 'fulfilled') setSegments(segmentsResult.value);
                else setError('Failed to load transcript');
            })
            .catch(() => setError('Failed to load data'))
            .finally(() => setLoading(false));
    }, [meetingId]);

    // Speaker list
    const speakers = useMemo(() => {
        const speakerMap = new Map<string, { count: number; duration: number; words: number }>();
        segments.forEach((s) => {
            const existing = speakerMap.get(s.speaker_name) || { count: 0, duration: 0, words: 0 };
            existing.count += 1;
            existing.duration += s.end_time - s.start_time;
            existing.words += s.text.split(' ').length;
            speakerMap.set(s.speaker_name, existing);
        });
        return Array.from(speakerMap.entries()).map(([name, stats]) => ({
            name,
            ...stats,
        }));
    }, [segments]);

    // Filtered & sorted segments
    const filteredSegments = useMemo(() => {
        let result = segments;

        if (selectedSpeakers.size > 0) {
            result = result.filter((s) => selectedSpeakers.has(s.speaker_name));
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (s) =>
                    s.text.toLowerCase().includes(q) ||
                    s.speaker_name.toLowerCase().includes(q)
            );
        }

        if (sortMode === 'speaker') {
            result = [...result].sort((a, b) => {
                const cmp = a.speaker_name.localeCompare(b.speaker_name);
                return cmp !== 0 ? cmp : a.start_time - b.start_time;
            });
        }

        return result;
    }, [segments, selectedSpeakers, searchQuery, sortMode]);

    // Group segments by speaker for speaker view
    const groupedBySpeaker = useMemo(() => {
        if (sortMode !== 'speaker') return null;
        const groups: Record<string, TranscriptSegment[]> = {};
        filteredSegments.forEach((s) => {
            if (!groups[s.speaker_name]) groups[s.speaker_name] = [];
            groups[s.speaker_name].push(s);
        });
        return groups;
    }, [filteredSegments, sortMode]);

    // Toggle speaker filter
    const toggleSpeaker = (speaker: string) => {
        setSelectedSpeakers((prev) => {
            const next = new Set(prev);
            if (next.has(speaker)) next.delete(speaker);
            else next.add(speaker);
            return next;
        });
    };

    // Copy segment text
    const handleCopy = useCallback((segment: TranscriptSegment) => {
        const text = `[${formatTimestamp(segment.start_time)}] ${segment.speaker_name}: ${segment.text}`;
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(segment.id);
            setTimeout(() => setCopiedId(null), 2000);
        });
    }, []);

    // Download full transcript
    const handleDownload = useCallback(() => {
        if (segments.length === 0) return;
        const text = segments
            .map(
                (s) =>
                    `[${formatTimestamp(s.start_time)} - ${formatTimestamp(s.end_time)}] ${s.speaker_name}: ${s.text}`
            )
            .join('\n\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcript-${meetingId}.txt`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
        glassToast.success('Transcript downloaded!');
    }, [segments, meetingId]);

    // Copy all
    const handleCopyAll = useCallback(() => {
        if (segments.length === 0) return;
        const text = segments
            .map(
                (s) =>
                    `[${formatTimestamp(s.start_time)}] ${s.speaker_name}: ${s.text}`
            )
            .join('\n');
        navigator.clipboard.writeText(text).then(() => {
            glassToast.success('Full transcript copied!');
        });
    }, [segments]);

    // Navigate to video at time
    const goToVideo = useCallback(
        (time: number) => {
            if (meetingId) {
                navigate(`/meeting/${meetingId}/review`, {
                    state: { jumpToTime: time },
                });
            }
        },
        [meetingId, navigate]
    );

    // Total duration
    const totalDuration = useMemo(() => {
        if (segments.length === 0) return 0;
        return Math.max(...segments.map((s) => s.end_time)) - Math.min(...segments.map((s) => s.start_time));
    }, [segments]);

    // Highlight matching text
    const highlightText = useCallback(
        (text: string): React.ReactNode => {
            if (!searchQuery.trim()) return text;
            const q = searchQuery.toLowerCase();
            const idx = text.toLowerCase().indexOf(q);
            if (idx === -1) return text;
            return (
                <>
                    {text.slice(0, idx)}
                    <mark className="bg-cyan/30 text-white rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
                    {text.slice(idx + q.length)}
                </>
            );
        },
        [searchQuery]
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader size="lg" text="Loading transcript..." />
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-20 pb-16">
            <div className="max-w-5xl mx-auto px-4">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    {/* ─── Header ─── */}
                    <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate(meetingId ? `/meeting/${meetingId}/review` : '/history')}
                                className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div>
                                <div className="flex items-center gap-2">
                                    <ScrollText size={20} className="text-cyan" />
                                    <h1 className="text-xl font-bold text-white/90">Transcript</h1>
                                </div>
                                {meeting && (
                                    <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                                        <span className="font-medium text-white/60">{meeting.title}</span>
                                        {meeting.created_at && (
                                            <span className="flex items-center gap-1">
                                                <CalendarDays size={11} />
                                                {formatDate(meeting.created_at)}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <Clock size={11} />
                                            {formatDuration(totalDuration)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <MessageSquare size={11} />
                                            {segments.length} segments
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                            <GlassButton
                                variant="ghost"
                                size="sm"
                                icon={Copy}
                                onClick={handleCopyAll}
                                disabled={segments.length === 0}
                            >
                                Copy All
                            </GlassButton>
                            <GlassButton
                                variant="ghost"
                                size="sm"
                                icon={Download}
                                onClick={handleDownload}
                                disabled={segments.length === 0}
                            >
                                Download
                            </GlassButton>
                        </div>
                    </div>

                    {/* ─── Error State ─── */}
                    {error && (
                        <GlassCard variant="surface" className="text-center py-12 mb-6">
                            <p className="text-red-400 text-sm mb-3">{error}</p>
                            <GlassButton variant="ghost" size="sm" onClick={() => window.location.reload()}>
                                Retry
                            </GlassButton>
                        </GlassCard>
                    )}

                    {/* ─── Speaker Stats ─── */}
                    {speakers.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                            {speakers.map((speaker) => {
                                const color = getAvatarColor(speaker.name);
                                const isSelected = selectedSpeakers.has(speaker.name);
                                return (
                                    <motion.button
                                        key={speaker.name}
                                        whileHover={{ scale: 1.02, y: -2 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => toggleSpeaker(speaker.name)}
                                        className={`rounded-2xl p-3 text-left transition-all border ${isSelected
                                                ? 'bg-white/[0.08] border-cyan/30 shadow-[0_0_20px_rgba(34,211,238,0.08)]'
                                                : selectedSpeakers.size === 0
                                                    ? 'bg-white/[0.04] border-white/10 hover:bg-white/[0.06] hover:border-white/15'
                                                    : 'bg-white/[0.02] border-white/5 opacity-50 hover:opacity-75'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <div
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                                style={{ backgroundColor: `${color}20`, color }}
                                            >
                                                {speaker.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-xs font-semibold text-white/90 truncate">{speaker.name}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-white/40">
                                            <span>{speaker.count} seg</span>
                                            <span>{speaker.words} words</span>
                                            <span>{formatDuration(speaker.duration)}</span>
                                        </div>
                                    </motion.button>
                                );
                            })}
                        </div>
                    )}

                    {/* ─── Search + Controls ─── */}
                    <div className="flex items-center gap-3 mb-5 flex-wrap">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                            <input
                                type="text"
                                placeholder="Search transcript..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white/80 placeholder-white/25 outline-none focus:border-cyan/40 transition-colors backdrop-blur-xl"
                            />
                            {searchQuery && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30">
                                    {filteredSegments.length} results
                                </span>
                            )}
                        </div>

                        {/* Sort toggle */}
                        <div className="flex items-center gap-1">
                            <ArrowUpDown size={12} className="text-white/30" />
                            {(['time', 'speaker'] as SortMode[]).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setSortMode(mode)}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all capitalize ${sortMode === mode
                                            ? 'bg-lavender/15 text-lavender border border-lavender/20'
                                            : 'text-white/40 hover:text-white/60'
                                        }`}
                                >
                                    {mode === 'time' ? 'By Time' : 'By Speaker'}
                                </button>
                            ))}
                        </div>

                        {/* Sentiment toggle */}
                        <button
                            onClick={() => setShowSentiment(!showSentiment)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${showSentiment
                                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                    : 'text-white/40 hover:text-white/60'
                                }`}
                        >
                            Sentiment
                        </button>
                    </div>

                    {/* ─── Transcript Content ─── */}
                    {segments.length === 0 && !error ? (
                        <GlassCard variant="surface" className="text-center py-16">
                            <ScrollText className="text-white/10 mx-auto mb-4" size={56} />
                            <p className="text-white/50 mb-1 text-lg">No transcript available</p>
                            <p className="text-xs text-white/30">
                                Transcript will appear after the meeting has been processed
                            </p>
                        </GlassCard>
                    ) : sortMode === 'speaker' && groupedBySpeaker ? (
                        /* ── Speaker Grouped View ── */
                        <div className="space-y-6">
                            {Object.entries(groupedBySpeaker).map(([speaker, segs]) => {
                                const color = getAvatarColor(speaker);
                                return (
                                    <motion.div
                                        key={speaker}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                    >
                                        <div className="flex items-center gap-2 mb-3 sticky top-20 bg-navy/90 backdrop-blur-lg z-10 py-2">
                                            <div
                                                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                                                style={{ backgroundColor: `${color}20`, color }}
                                            >
                                                {speaker.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-sm font-semibold" style={{ color }}>
                                                {speaker}
                                            </span>
                                            <span className="text-[10px] text-white/30">{segs.length} segments</span>
                                        </div>
                                        <div className="space-y-1.5 pl-4 border-l-2 border-white/5">
                                            {segs.map((seg) => (
                                                <SegmentRow
                                                    key={seg.id}
                                                    segment={seg}
                                                    showSpeaker={false}
                                                    showSentiment={showSentiment}
                                                    searchQuery={searchQuery}
                                                    highlightText={highlightText}
                                                    onCopy={handleCopy}
                                                    copiedId={copiedId}
                                                    onGoToVideo={goToVideo}
                                                    highlightTime={highlightTime}
                                                />
                                            ))}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    ) : (
                        /* ── Timeline View ── */
                        <div className="space-y-1">
                            {filteredSegments.map((seg, i) => (
                                <motion.div
                                    key={seg.id || i}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: Math.min(i * 0.015, 0.3) }}
                                >
                                    <SegmentRow
                                        segment={seg}
                                        showSpeaker
                                        showSentiment={showSentiment}
                                        searchQuery={searchQuery}
                                        highlightText={highlightText}
                                        onCopy={handleCopy}
                                        copiedId={copiedId}
                                        onGoToVideo={goToVideo}
                                        highlightTime={highlightTime}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}

/* ─── Segment Row Component ─── */
interface SegmentRowProps {
    segment: TranscriptSegment;
    showSpeaker: boolean;
    showSentiment: boolean;
    searchQuery: string;
    highlightText: (text: string) => React.ReactNode;
    onCopy: (segment: TranscriptSegment) => void;
    copiedId: string | null;
    onGoToVideo: (time: number) => void;
    highlightTime: number | null;
}

function SegmentRow({
    segment,
    showSpeaker,
    showSentiment,
    searchQuery,
    highlightText,
    onCopy,
    copiedId,
    onGoToVideo,
    highlightTime,
}: SegmentRowProps) {
    const color = getAvatarColor(segment.speaker_name);
    const sentColor =
        showSentiment && segment.sentiment_score != null
            ? getSentimentColor(segment.sentiment_score)
            : null;

    const isHighlighted =
        highlightTime !== null &&
        segment.start_time <= highlightTime &&
        segment.end_time >= highlightTime;

    return (
        <div
            className={`group relative rounded-xl px-4 py-3 transition-all flex gap-3 ${isHighlighted
                    ? 'bg-cyan/[0.08] border border-cyan/20 shadow-[0_0_20px_rgba(34,211,238,0.06)]'
                    : 'bg-white/[0.02] hover:bg-white/[0.04] border border-transparent hover:border-white/5'
                }`}
        >
            {/* Timestamp */}
            <button
                onClick={() => onGoToVideo(segment.start_time)}
                className="flex-shrink-0 flex items-center gap-1 text-[11px] font-mono text-white/30 hover:text-cyan transition-colors mt-0.5 group/ts"
                title="Jump to video"
            >
                <Play size={9} className="opacity-0 group-hover/ts:opacity-100 transition-opacity" />
                {formatTimestamp(segment.start_time)}
            </button>

            {/* Speaker avatar */}
            {showSpeaker && (
                <div
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                    style={{ backgroundColor: `${color}20`, color }}
                >
                    {segment.speaker_name.charAt(0).toUpperCase()}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
                {showSpeaker && (
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold" style={{ color }}>
                            {segment.speaker_name}
                        </span>
                        {sentColor && (
                            <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: sentColor }}
                                title={`Sentiment: ${segment.sentiment_label || segment.sentiment_score?.toFixed(2)}`}
                            />
                        )}
                    </div>
                )}
                <p className="text-sm text-white/70 leading-relaxed">{highlightText(segment.text)}</p>
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => onCopy(segment)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
                    title="Copy segment"
                >
                    {copiedId === segment.id ? (
                        <CheckCircle2 size={14} className="text-green-400" />
                    ) : (
                        <Copy size={14} />
                    )}
                </button>
            </div>
        </div>
    );
}
