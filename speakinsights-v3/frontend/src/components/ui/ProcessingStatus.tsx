/**
 * SpeakInsights v3 — Post-Meeting Processing Status (FINAL)
 *
 * Displays a vertical stepper showing real-time progress of the 7-step
 * post-processing pipeline. Connects via WebSocket to /ws/meeting/{meetingId}
 * for live progress updates.
 *
 * Props:
 *   meetingId   – UUID of the meeting being processed
 *   onComplete  – callback fired when all processing steps finish
 *
 * Pipeline steps:
 *   1. Transcribing individual audio tracks
 *   2. Merging transcript timeline
 *   3. Generating embeddings
 *   4. Creating AI summary
 *   5. Extracting action items
 *   6. Analyzing sentiment
 *   7. Generating calendar file
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  Loader2,
  Clock,
  AlertCircle,
  Mic,
  GitMerge,
  Database,
  Brain,
  ListChecks,
  HeartPulse,
  CalendarDays,
  Sparkles,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'processing' | 'completed' | 'error';

interface PipelineStep {
  id: string;
  label: string;
  description: string;
  icon: typeof Clock;
  status: StepStatus;
  errorMessage?: string;
  /** Optional per-participant progress for step 1 */
  subProgress?: { name: string; status: StepStatus }[];
}

interface ProcessingStatusProps {
  meetingId: string;
  onComplete?: () => void;
  className?: string;
}

// ── Default step definitions ─────────────────────────────────────────────

const DEFAULT_STEPS: Omit<PipelineStep, 'status'>[] = [
  { id: 'transcribe',  label: 'Transcribing Audio',      description: 'Processing individual participant audio tracks via WhisperX', icon: Mic },
  { id: 'merge',       label: 'Merging Timeline',        description: 'Combining speaker-attributed segments into chronological order', icon: GitMerge },
  { id: 'embed',       label: 'Generating Embeddings',   description: 'Creating vector embeddings for RAG similarity search (pgvector)', icon: Database },
  { id: 'summarize',   label: 'Creating AI Summary',     description: 'Ollama generating executive summary and key points', icon: Brain },
  { id: 'tasks',       label: 'Extracting Action Items', description: 'Identifying tasks, assignees, and deadlines from transcript', icon: ListChecks },
  { id: 'sentiment',   label: 'Analyzing Sentiment',     description: 'Computing per-speaker and overall meeting sentiment', icon: HeartPulse },
  { id: 'calendar',    label: 'Generating Calendar',     description: 'Creating .ics file from extracted tasks with due dates', icon: CalendarDays },
];

// ── Component ────────────────────────────────────────────────────────────

export default function ProcessingStatus({ meetingId, onComplete, className = '' }: ProcessingStatusProps) {
  const [steps, setSteps] = useState<PipelineStep[]>(
    DEFAULT_STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus }))
  );
  const [isComplete, setIsComplete] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const hasCalledComplete = useRef(false);

  // ── WebSocket connection for live progress updates ────────────────
  const connectWebSocket = useCallback(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.hostname}:8000`;
    const wsUrl = `${wsHost}/ws/meeting/${meetingId}`;

    console.log('[ProcessingStatus] Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[ProcessingStatus] WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[ProcessingStatus] Received:', data);

        if (data.type === 'processing_progress') {
          const { step, status, error: errorMsg, sub_progress } = data;

          setSteps((prev) =>
            prev.map((s) => {
              if (s.id === step) {
                return {
                  ...s,
                  status: status as StepStatus,
                  errorMessage: errorMsg,
                  subProgress: sub_progress,
                };
              }
              return s;
            })
          );
        }

        if (data.type === 'processing_completed') {
          // Mark all steps as completed
          setSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' as StepStatus })));
          setIsComplete(true);
          setShowConfetti(true);

          // Trigger completion callback
          if (!hasCalledComplete.current) {
            hasCalledComplete.current = true;
            setTimeout(() => {
              onComplete?.();
            }, 2000); // Let user see the success animation
          }

          // Hide confetti after 3 seconds
          setTimeout(() => setShowConfetti(false), 3000);
        }
      } catch (err) {
        console.error('[ProcessingStatus] Failed to parse WS message:', err);
      }
    };

    ws.onerror = (err) => {
      console.warn('[ProcessingStatus] WebSocket error:', err);
    };

    ws.onclose = (event) => {
      console.log('[ProcessingStatus] WebSocket closed:', event.code);
      // Reconnect after 3 seconds if not complete
      if (!hasCalledComplete.current) {
        setTimeout(() => connectWebSocket(), 3000);
      }
    };
  }, [meetingId, onComplete]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  // Simulate progress for demo if no WS updates within 5 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSteps((prev) => {
        const hasAnyProgress = prev.some((s) => s.status !== 'pending');
        if (hasAnyProgress) return prev;

        // Auto-simulate: mark step 1 as processing
        console.log('[ProcessingStatus] No WS updates — simulating progress');
        return prev.map((s, i) => ({
          ...s,
          status: i === 0 ? ('processing' as StepStatus) : ('pending' as StepStatus),
        }));
      });
    }, 5000);
    return () => clearTimeout(timeout);
  }, []);

  // ── Compute overall progress ──────────────────────────────────────
  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className={`relative ${className}`}>
      {/* Glass card container */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white/90">
              {isComplete ? 'Processing Complete!' : 'Post-Meeting Processing'}
            </h3>
            <p className="text-sm text-white/50 mt-1">
              {isComplete
                ? 'All steps finished successfully. Refreshing data…'
                : `Step ${Math.min(completedCount + 1, steps.length)} of ${steps.length} — ${progressPercent}% complete`}
            </p>
          </div>

          {/* Circular progress indicator */}
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
              <motion.circle
                cx="28" cy="28" r="24" fill="none"
                stroke={isComplete ? '#34D399' : '#22D3EE'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 24}
                animate={{ strokeDashoffset: 2 * Math.PI * 24 * (1 - progressPercent / 100) }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/80">
              {progressPercent}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-white/10 mb-6 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: isComplete
                ? 'linear-gradient(90deg, #34D399, #22D3EE)'
                : 'linear-gradient(90deg, #22D3EE, #A78BFA)',
            }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </div>

        {/* Vertical stepper */}
        <div className="space-y-1">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isLast = index === steps.length - 1;

            return (
              <div key={step.id} className="relative flex gap-4">
                {/* Vertical line connector */}
                {!isLast && (
                  <div className="absolute left-[19px] top-10 bottom-0 w-px">
                    <div
                      className={`h-full w-full ${
                        step.status === 'completed' ? 'bg-emerald-400/40' : 'bg-white/10'
                      }`}
                    />
                  </div>
                )}

                {/* Step icon */}
                <div className="relative z-10 flex-shrink-0 mt-1">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                      step.status === 'completed'
                        ? 'bg-emerald-400/20 border-emerald-400/40'
                        : step.status === 'processing'
                        ? 'bg-cyan-400/20 border-cyan-400/40 shadow-[0_0_12px_rgba(34,211,238,0.3)]'
                        : step.status === 'error'
                        ? 'bg-red-400/20 border-red-400/40'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    {step.status === 'completed' ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      >
                        <CheckCircle size={18} className="text-emerald-400" />
                      </motion.div>
                    ) : step.status === 'processing' ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                      >
                        <Loader2 size={18} className="text-cyan-400" />
                      </motion.div>
                    ) : step.status === 'error' ? (
                      <AlertCircle size={18} className="text-red-400" />
                    ) : (
                      <StepIcon size={18} className="text-white/30" />
                    )}
                  </div>
                </div>

                {/* Step content */}
                <div className="flex-1 pb-6">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        step.status === 'completed'
                          ? 'text-emerald-400'
                          : step.status === 'processing'
                          ? 'text-cyan-400'
                          : step.status === 'error'
                          ? 'text-red-400'
                          : 'text-white/40'
                      }`}
                    >
                      {step.label}
                    </span>
                    {step.status === 'processing' && (
                      <motion.span
                        className="text-xs text-cyan-400/60"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        in progress…
                      </motion.span>
                    )}
                  </div>
                  <p className="text-xs text-white/30 mt-0.5">{step.description}</p>

                  {/* Error message */}
                  {step.status === 'error' && step.errorMessage && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-red-400/10 border border-red-400/20">
                      <p className="text-xs text-red-400">{step.errorMessage}</p>
                    </div>
                  )}

                  {/* Per-participant sub-progress (step 1: transcription) */}
                  {step.subProgress && step.subProgress.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {step.subProgress.map((sub) => (
                        <div key={sub.name} className="flex items-center gap-2">
                          {sub.status === 'completed' ? (
                            <CheckCircle size={12} className="text-emerald-400" />
                          ) : sub.status === 'processing' ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                            >
                              <Loader2 size={12} className="text-cyan-400" />
                            </motion.div>
                          ) : (
                            <Clock size={12} className="text-white/30" />
                          )}
                          <span className="text-xs text-white/50">{sub.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confetti-style celebration on completion */}
      <AnimatePresence>
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  background: i % 3 === 0 ? '#22D3EE' : i % 3 === 1 ? '#A78BFA' : '#34D399',
                  left: `${Math.random() * 100}%`,
                }}
                initial={{ y: -10, opacity: 1, scale: 0 }}
                animate={{
                  y: 400,
                  opacity: 0,
                  scale: [0, 1.5, 1],
                  rotate: Math.random() * 360,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 2 + Math.random() * 1.5,
                  delay: Math.random() * 0.5,
                  ease: 'easeOut',
                }}
              />
            ))}

            {/* Success message overlay */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.3, type: 'spring' }}
            >
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-400/20 border border-emerald-400/30 backdrop-blur-sm">
                <Sparkles size={16} className="text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">Processing complete!</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
