import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  CalendarDays,
  FileText,
  Brain,
  CheckSquare,
  BarChart3,
  ArrowLeft,
  Users,
  Clock,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import GlassButton from '@/components/ui/GlassButton';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Loader from '@/components/ui/Loader';
import { VideoPlayer } from '@/components/history/VideoPlayer';
import { TranscriptViewer } from '@/components/transcription/TranscriptViewer';
import { SummaryCard } from '@/components/summary/SummaryCard';
import { TaskList } from '@/components/summary/TaskList';
import { SentimentChart } from '@/components/summary/SentimentChart';
import { meetings as meetingsApi, transcriptions, summaries, recordings, calendar } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { formatDuration, formatDate } from '@/utils/formatTime';
import { glassToast } from '@/components/ui/Toast';
import type { Meeting } from '@/types/meeting';
import type { TranscriptSegment } from '@/types/transcription';
import type { Summary, Task, SentimentData } from '@/types/summary';

type ReviewTab = 'summary' | 'tasks' | 'sentiment';

/** Simple inline processing step indicator */
function ProcessingStatus({ status, label }: { status: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'completed' ? (
        <CheckCircle2 size={14} className="text-green-400" />
      ) : status === 'processing' ? (
        <Loader2 size={14} className="animate-spin text-cyan" />
      ) : (
        <Clock size={14} className="text-white/30" />
      )}
      <span className={status === 'pending' ? 'text-white/40' : 'text-white/80'}>{label}</span>
    </div>
  );
}

export default function MeetingReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Meeting data
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | undefined>();

  // UI state
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReviewTab>('summary');
  const [videoTime, setVideoTime] = useState(0);
  const [processingSteps, setProcessingSteps] = useState<string[]>([]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const meetingData = await meetingsApi.get(id);
      setMeeting(meetingData);

      // Fetch all data in parallel
      const results = await Promise.allSettled([
        transcriptions.getTranscript(id),
        summaries.get(id),
        summaries.getTasks(id),
        summaries.getSentiment(id),
        recordings.getCompositeUrl(id),
      ]);

      if (results[0].status === 'fulfilled') setSegments(results[0].value);
      if (results[1].status === 'fulfilled') setSummary(results[1].value);
      if (results[2].status === 'fulfilled') setTasks(results[2].value);
      if (results[3].status === 'fulfilled') setSentiment(results[3].value);
      if (results[4].status === 'fulfilled') setRecordingUrl(results[4].value.url);
    } catch {
      // Meeting might not exist
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // WebSocket for processing updates
  const handleProcessingMessage = useCallback(
    (data: unknown) => {
      const msg = data as Record<string, unknown>;
      if (msg.type === 'processing_update') {
        const step = msg.step as string;
        setProcessingSteps((prev) => [...prev, step]);
      }
      if (msg.type === 'processing_complete') {
        glassToast.success('Processing complete!');
        fetchData(); // Reload all data
      }
    },
    [fetchData]
  );

  const { connect: connectProcessingWs } = useWebSocket(undefined, {
    onMessage: handleProcessingMessage,
    autoReconnect: true,
  });

  // Connect processing WS if meeting is processing
  useEffect(() => {
    if (meeting?.status === 'processing' && id) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      connectProcessingWs(`${protocol}//${host}/ws/meeting/${id}`);
    }
  }, [meeting?.status, id, connectProcessingWs]);

  // Handle task update
  const handleUpdateTask = useCallback(
    async (taskId: string, updates: Partial<Task>) => {
      if (!id) return;
      try {
        const updated = await summaries.updateTask(id, taskId, updates);
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      } catch {
        glassToast.error('Failed to update task');
      }
    },
    [id]
  );

  // Handle regenerate summary
  const handleRegenerateSummary = useCallback(async () => {
    if (!id) return;
    try {
      glassToast.info('Regenerating summary...');
      const newSummary = await summaries.generate(id);
      setSummary(newSummary);
      glassToast.success('Summary regenerated!');
    } catch {
      glassToast.error('Failed to regenerate summary');
    }
  }, [id]);

  // Download handlers
  const handleDownloadRecording = useCallback(() => {
    if (recordingUrl) window.open(recordingUrl, '_blank');
  }, [recordingUrl]);

  const handleExportCalendar = useCallback(async () => {
    if (!id) return;
    try {
      const blob = await calendar.getIcs(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-${id}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      glassToast.error('Failed to export calendar');
    }
  }, [id]);

  const handleDownloadTranscript = useCallback(() => {
    if (segments.length === 0) return;
    const text = segments
      .map((s) => `[${Math.floor(s.start_time / 60)}:${String(Math.floor(s.start_time % 60)).padStart(2, '0')}] ${s.speaker_name}: ${s.text}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [segments, id]);

  // Handle segment click -> jump video
  const handleSegmentClick = useCallback((startTime: number) => {
    setVideoTime(startTime);
  }, []);

  const tabs: { key: ReviewTab; label: string; icon: typeof Brain }[] = [
    { key: 'summary', label: 'Summary', icon: Brain },
    { key: 'tasks', label: 'Tasks', icon: CheckSquare },
    { key: 'sentiment', label: 'Sentiment', icon: BarChart3 },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size="lg" text="Loading meeting review..." />
      </div>
    );
  }

  const isProcessing = meeting?.status === 'processing';
  const meetingDuration = meeting?.duration || 0;

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-[1400px] mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* ─── Top info bar ─── */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/history')}
                className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white/90">
                  {meeting?.title || 'Meeting Review'}
                </h1>
                <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                  {meeting?.created_at && (
                    <span className="flex items-center gap-1">
                      <CalendarDays size={11} />
                      {formatDate(meeting.created_at)}
                    </span>
                  )}
                  {meetingDuration > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {formatDuration(meetingDuration)}
                    </span>
                  )}
                  {meeting?.participant_count && (
                    <span className="flex items-center gap-1">
                      <Users size={11} />
                      {meeting.participant_count} participants
                    </span>
                  )}
                  {meeting?.host_name && (
                    <span className="flex items-center gap-1">
                      <Avatar name={meeting.host_name} size="sm" className="!w-4 !h-4 !text-[8px]" />
                      {meeting.host_name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <GlassButton variant="ghost" size="sm" icon={Download} onClick={handleDownloadRecording} disabled={!recordingUrl}>
                Recording
              </GlassButton>
              <GlassButton variant="ghost" size="sm" icon={CalendarDays} onClick={handleExportCalendar}>
                Export .ics
              </GlassButton>
              <GlassButton variant="ghost" size="sm" icon={FileText} onClick={handleDownloadTranscript} disabled={segments.length === 0}>
                Transcript
              </GlassButton>
            </div>
          </div>

          {/* ─── Main content ─── */}
          <div className="flex gap-5 items-start">
            {/* LEFT SIDE (65%) — Video + Tabs */}
            <div className="flex-[65] min-w-0 space-y-5">
              {/* Video Player */}
              <VideoPlayer
                recordingUrl={recordingUrl}
                currentTime={videoTime}
                onTimeUpdate={setVideoTime}
                sentimentArc={sentiment?.arc}
              />

              {/* Processing status */}
              {isProcessing && (
                <GlassCard variant="surface" glow="lavender">
                  <div className="flex items-center gap-3 mb-4">
                    <Loader2 size={18} className="animate-spin text-lavender" />
                    <h3 className="text-sm font-semibold text-white/90">Processing Meeting...</h3>
                  </div>
                  <div className="space-y-2">
                    <ProcessingStatus
                      status={processingSteps.includes('transcription') ? 'completed' : 'processing'}
                      label="Transcribing audio"
                    />
                    <ProcessingStatus
                      status={
                        processingSteps.includes('summary')
                          ? 'completed'
                          : processingSteps.includes('transcription')
                          ? 'processing'
                          : 'pending'
                      }
                      label="Generating summary"
                    />
                    <ProcessingStatus
                      status={
                        processingSteps.includes('tasks')
                          ? 'completed'
                          : processingSteps.includes('summary')
                          ? 'processing'
                          : 'pending'
                      }
                      label="Extracting tasks"
                    />
                    <ProcessingStatus
                      status={
                        processingSteps.includes('sentiment')
                          ? 'completed'
                          : processingSteps.includes('tasks')
                          ? 'processing'
                          : 'pending'
                      }
                      label="Analyzing sentiment"
                    />
                  </div>
                </GlassCard>
              )}

              {/* Tabs */}
              {!isProcessing && (
                <>
                  <div className="flex gap-1">
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${
                            activeTab === tab.key
                              ? 'bg-cyan/15 text-cyan border border-cyan/30'
                              : 'bg-white/5 text-white/50 border border-transparent hover:bg-white/10 hover:text-white/70'
                          }`}
                        >
                          <Icon size={14} />
                          {tab.label}
                          {tab.key === 'tasks' && tasks.length > 0 && (
                            <Badge text={String(tasks.length)} variant="cyan" className="ml-1 text-[9px] px-1.5 py-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab content */}
                  <AnimatePresence mode="wait">
                    {activeTab === 'summary' && (
                      <motion.div key="summary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <SummaryCard
                          summary={summary}
                          onRegenerate={handleRegenerateSummary}
                        />
                      </motion.div>
                    )}
                    {activeTab === 'tasks' && (
                      <motion.div key="tasks" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <TaskList
                          tasks={tasks}
                          onUpdateTask={handleUpdateTask}
                          meetingId={id || ''}
                        />
                      </motion.div>
                    )}
                    {activeTab === 'sentiment' && (
                      <motion.div key="sentiment" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <SentimentChart sentiment={sentiment} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>

            {/* RIGHT SIDE (35%) — Transcript */}
            <div className="flex-[35] min-w-0 sticky top-24" style={{ maxHeight: 'calc(100vh - 120px)' }}>
              <TranscriptViewer
                segments={segments}
                currentVideoTime={videoTime}
                onSegmentClick={handleSegmentClick}
                meetingId={id || ''}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
