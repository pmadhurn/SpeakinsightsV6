import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History as HistoryIcon,
  Search,
  ArrowUpDown,
  Plus,
  Loader2,
  Upload,
  X,
  FileAudio,
  FileVideo,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import GlassInput from '@/components/ui/GlassInput';
import GlassButton from '@/components/ui/GlassButton';
import { MeetingCard } from '@/components/history/MeetingCard';
import { useNavigate } from 'react-router-dom';
import { meetings as meetingsApi, upload as uploadApi } from '@/services/api';
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

  // Upload modal state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadHost, setUploadHost] = useState('');
  const [uploadLang, setUploadLang] = useState('auto');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_FORMATS = '.wav,.mp3,.flac,.ogg,.m4a,.webm,.wma,.aac,.opus,.mp4,.mkv,.avi,.mov,.3gp,.amr';

  // Fetch meetings (reusable)
  const fetchMeetings = useCallback(() => {
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

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Upload handlers
  const handleFileSelect = useCallback((file: File) => {
    setUploadFile(file);
    // Auto-fill title from filename (strip extension)
    if (!uploadTitle) {
      const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      setUploadTitle(name.charAt(0).toUpperCase() + name.slice(1));
    }
    setUploadResult(null);
  }, [uploadTitle]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const resetUploadForm = useCallback(() => {
    setUploadFile(null);
    setUploadTitle('');
    setUploadHost('');
    setUploadLang('auto');
    setUploadResult(null);
    setUploading(false);
  }, []);

  const closeUploadModal = useCallback(() => {
    setShowUpload(false);
    // Delay reset so exit animation completes
    setTimeout(resetUploadForm, 300);
  }, [resetUploadForm]);

  const handleUploadSubmit = useCallback(async () => {
    if (!uploadFile || !uploadTitle.trim()) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const result = await uploadApi.meeting(
        uploadFile,
        uploadTitle.trim(),
        uploadHost.trim() || undefined,
        uploadLang || undefined,
      );
      setUploadResult({
        status: 'success',
        message: `"${result.title}" uploaded (${result.file_size_mb} MB). Processing started!`,
      });
      // Refresh the meeting list after a brief delay
      setTimeout(() => {
        fetchMeetings();
      }, 1000);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'Upload failed';
      setUploadResult({ status: 'error', message: detail });
    } finally {
      setUploading(false);
    }
  }, [uploadFile, uploadTitle, uploadHost, uploadLang, fetchMeetings]);

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
            <button
              id="upload-meeting-btn"
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-sm font-bold uppercase tracking-wider
                bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-white/10
                hover:from-purple-500/30 hover:to-cyan-500/30 hover:border-cyan-500/30
                text-cyan-400 hover:text-cyan-300
                shadow-[0_0_20px_rgba(6,182,212,0.1)] hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]
                transition-all duration-300 cursor-pointer"
            >
              <Upload size={16} />
              Upload
            </button>
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

      {/* ── Upload Modal ── */}
      <AnimatePresence>
        {showUpload && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={closeUploadModal}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg bg-[#0a0f1a]/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl shadow-cyan-500/5 overflow-hidden"
            >
              {/* Ambient glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[2px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

              {/* Header */}
              <div className="flex items-center justify-between px-7 pt-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/5">
                    <Upload className="text-cyan-400" size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Upload Meeting</h2>
                    <p className="text-[11px] text-white/40 uppercase tracking-widest font-medium">Audio or video file</p>
                  </div>
                </div>
                <button
                  onClick={closeUploadModal}
                  className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="px-7 pb-7 space-y-5">

                {/* Drop Zone */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_FORMATS}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                  className="hidden"
                  id="upload-file-input"
                />
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center py-10 px-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 ${
                    isDragging
                      ? 'border-cyan-500/60 bg-cyan-500/10 shadow-[0_0_30px_rgba(6,182,212,0.15)]'
                      : uploadFile
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                  }`}
                >
                  {uploadFile ? (
                    <div className="flex items-center gap-3 text-center">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        {uploadFile.type.startsWith('video/') ? (
                          <FileVideo className="text-emerald-400" size={22} />
                        ) : (
                          <FileAudio className="text-emerald-400" size={22} />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-white/90 truncate max-w-[250px]">{uploadFile.name}</p>
                        <p className="text-[11px] text-white/40 mt-0.5">
                          {(uploadFile.size / (1024 * 1024)).toFixed(1)} MB · Click to change
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 mb-4">
                        <Upload className={`${isDragging ? 'text-cyan-400' : 'text-white/20'} transition-colors`} size={28} />
                      </div>
                      <p className="text-sm font-semibold text-white/60 mb-1">
                        {isDragging ? 'Drop your file here' : 'Drag & drop or click to browse'}
                      </p>
                      <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
                        MP4 · MP3 · WAV · WEBM · OGG · FLAC · MKV · AVI · MOV
                      </p>
                    </>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="block text-[11px] text-white/40 uppercase tracking-widest font-bold mb-2">
                    Meeting Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="upload-title-input"
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Sprint Planning — April 30"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm
                      placeholder:text-white/20 focus:outline-none focus:border-cyan-500/40 focus:bg-white/[0.06]
                      transition-all font-medium tracking-wide"
                  />
                </div>

                {/* Host + Language row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-white/40 uppercase tracking-widest font-bold mb-2">
                      Host Name
                    </label>
                    <input
                      id="upload-host-input"
                      type="text"
                      value={uploadHost}
                      onChange={(e) => setUploadHost(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm
                        placeholder:text-white/20 focus:outline-none focus:border-cyan-500/40 focus:bg-white/[0.06]
                        transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/40 uppercase tracking-widest font-bold mb-2">
                      Language
                    </label>
                    <select
                      id="upload-language-select"
                      value={uploadLang}
                      onChange={(e) => setUploadLang(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm
                        focus:outline-none focus:border-cyan-500/40 focus:bg-white/[0.06]
                        transition-all font-medium cursor-pointer appearance-none"
                    >
                      <option value="auto" className="bg-[#0a0f1a]">Auto Detect</option>
                      <option value="en" className="bg-[#0a0f1a]">English</option>
                      <option value="es" className="bg-[#0a0f1a]">Spanish</option>
                      <option value="fr" className="bg-[#0a0f1a]">French</option>
                      <option value="de" className="bg-[#0a0f1a]">German</option>
                      <option value="zh" className="bg-[#0a0f1a]">Chinese</option>
                      <option value="ja" className="bg-[#0a0f1a]">Japanese</option>
                      <option value="ko" className="bg-[#0a0f1a]">Korean</option>
                      <option value="hi" className="bg-[#0a0f1a]">Hindi</option>
                      <option value="pt" className="bg-[#0a0f1a]">Portuguese</option>
                      <option value="ar" className="bg-[#0a0f1a]">Arabic</option>
                    </select>
                  </div>
                </div>

                {/* Result Feedback */}
                <AnimatePresence>
                  {uploadResult && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className={`flex items-start gap-3 p-4 rounded-xl border ${
                        uploadResult.status === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/10 border-red-500/20 text-red-400'
                      }`}
                    >
                      {uploadResult.status === 'success' ? (
                        <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                      )}
                      <p className="text-sm font-medium leading-relaxed">{uploadResult.message}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    onClick={closeUploadModal}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white/50 hover:text-white/80 hover:bg-white/5
                      transition-all uppercase tracking-wider cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="upload-submit-btn"
                    onClick={handleUploadSubmit}
                    disabled={!uploadFile || !uploadTitle.trim() || uploading}
                    className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider
                      transition-all duration-300 ${
                        !uploadFile || !uploadTitle.trim() || uploading
                          ? 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
                          : 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 border border-cyan-500/30 hover:from-cyan-500/30 hover:to-purple-500/30 hover:border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:shadow-[0_0_30px_rgba(6,182,212,0.25)] cursor-pointer'
                      }`}
                  >
                    {uploading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Uploading…
                      </>
                    ) : uploadResult?.status === 'success' ? (
                      <>
                        <CheckCircle2 size={15} />
                        Done
                      </>
                    ) : (
                      <>
                        <Upload size={15} />
                        Upload & Process
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

