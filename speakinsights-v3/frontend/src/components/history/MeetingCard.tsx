import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Users,
  Clock,
  ChevronRight,
  FileText,
  Film,
  Brain,
  Loader2,
  MoreVertical,
  Trash2,
  Download,
  StopCircle,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import { formatDate } from '@/utils/formatTime';
import { meetings as meetingsApi, recordings as recordingsApi } from '@/services/api';
import { glassToast } from '@/components/ui/Toast';
import type { Meeting } from '@/types/meeting';

interface MeetingCardProps {
  meeting: Meeting;
  onDeleted?: (id: string) => void;
  onUpdated?: (meeting: Meeting) => void;
}

export function MeetingCard({ meeting, onDeleted, onUpdated }: MeetingCardProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click outside to close menu
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await meetingsApi.delete(meeting.id);
      glassToast.success('Meeting deleted');
      onDeleted?.(meeting.id);
    } catch {
      glassToast.error('Failed to delete meeting');
    }
    setDeleting(false);
    setMenuOpen(false);
    setConfirmDelete(false);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = recordingsApi.getDownloadUrl(meeting.id);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.title.replace(/\s+/g, '_')}_recording`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    glassToast.success('Download started');
    setMenuOpen(false);
  };

  const handleStopProcessing = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setStopping(true);
    try {
      await meetingsApi.stopProcessing(meeting.id);
      glassToast.success('Processing stopped');
      onUpdated?.({ ...meeting, status: 'completed' });
    } catch {
      glassToast.error('Failed to stop processing');
    }
    setStopping(false);
    setMenuOpen(false);
  };

  const statusBadge = () => {
    switch (meeting.status) {
      case 'completed':
        return <Badge text="Ended" variant="green" />;
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/30">
            <Loader2 size={10} className="animate-spin" />
            Processing
          </span>
        );
      case 'active':
        return <Badge text="Active" variant="cyan" />;
      case 'cancelled':
        return <Badge text="Archived" variant="gray" />;
      default:
        return <Badge text={meeting.status} variant="gray" />;
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.005, y: -2 }}
      whileTap={{ scale: 0.995 }}
      onClick={() => navigate(`/meeting/${meeting.id}/review`)}
      className={`group relative rounded-2xl p-4 bg-white/[0.06] backdrop-blur-xl border border-white/10 
        hover:border-cyan/30 hover:shadow-[0_0_30px_rgba(34,211,238,0.08)] 
        transition-all duration-300 cursor-pointer ${menuOpen ? 'z-50' : 'z-0'}`}
    >
      <div className="flex items-start gap-4">
        {/* LEFT: Date + Duration */}
        <div className="flex-shrink-0 text-center w-16">
          <div className="text-[10px] text-white/30 uppercase tracking-wider">
            {new Date(meeting.created_at).toLocaleDateString('en-US', { month: 'short' })}
          </div>
          <div className="text-2xl font-bold text-white/80 leading-tight">
            {new Date(meeting.created_at).getDate()}
          </div>
          <div className="mt-1.5 px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-white/40">
            {formatDuration(meeting.duration)}
          </div>
        </div>

        {/* CENTER: Title, description, host */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white/90 truncate group-hover:text-cyan transition-colors">
            {meeting.title}
          </h3>
          {meeting.description && (
            <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{meeting.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40">
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {formatDate(meeting.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <Users size={11} />
              {meeting.participant_count || 0}
            </span>
            {meeting.host_name && (
              <span className="flex items-center gap-1">
                <Avatar name={meeting.host_name} size="sm" className="!w-4 !h-4 !text-[8px]" />
                {meeting.host_name}
              </span>
            )}
          </div>
        </div>

        {/* RIGHT: Status + Action Menu */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {statusBadge()}
          <div className="flex items-center gap-1.5 text-white/20">
            <Film size={13} />
            <Brain size={13} />
            <FileText size={13} />
          </div>

          {/* Three-dot action menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
                setConfirmDelete(false);
              }}
              className="p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/10 transition-all"
              title="Actions"
            >
              <MoreVertical size={14} />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 bottom-full mb-1 w-52 bg-[#0c0e14]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Download Recording */}
                  {meeting.has_recording && (
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-3 w-full px-4 py-3 text-xs font-medium text-white/70 hover:text-cyan-400 hover:bg-white/5 transition-all"
                    >
                      <Download size={14} />
                      Download Recording
                    </button>
                  )}

                  {/* Stop Processing (only show if meeting is processing) */}
                  {meeting.status === 'processing' && (
                    <button
                      onClick={handleStopProcessing}
                      disabled={stopping}
                      className="flex items-center gap-3 w-full px-4 py-3 text-xs font-medium text-amber-400/80 hover:text-amber-400 hover:bg-amber-500/5 transition-all disabled:opacity-50"
                    >
                      {stopping ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <StopCircle size={14} />
                      )}
                      Stop Processing
                    </button>
                  )}

                  {/* Divider */}
                  <div className="h-px bg-white/5 mx-3" />

                  {/* Delete */}
                  {!confirmDelete ? (
                    <button
                      onClick={handleDelete}
                      className="flex items-center gap-3 w-full px-4 py-3 text-xs font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-all"
                    >
                      <Trash2 size={14} />
                      Delete Meeting
                    </button>
                  ) : (
                    <div className="px-3 py-2">
                      <div className="flex items-center gap-2 text-red-400 mb-2">
                        <AlertTriangle size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Confirm Delete?
                        </span>
                      </div>
                      <p className="text-[10px] text-white/40 mb-2">
                        This will permanently delete the meeting, recordings, and all data.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(false);
                          }}
                          className="flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white/50 bg-white/5 hover:bg-white/10 transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={deleting}
                          className="flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {deleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default MeetingCard;
