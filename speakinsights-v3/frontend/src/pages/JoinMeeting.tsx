import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Clock, CheckCircle2, XCircle, ArrowLeft, Loader2 } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import GlassButton from '@/components/ui/GlassButton';
import GlassInput from '@/components/ui/GlassInput';
import { glassToast } from '@/components/ui/Toast';
import { meetings } from '@/services/api';
import { useLobby } from '@/hooks/useLobby';
import type { Meeting } from '@/types/meeting';

type JoinStep = 'loading' | 'enter-name' | 'waiting' | 'approved' | 'declined' | 'error';

export default function JoinMeeting() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [step, setStep] = useState<JoinStep>('loading');
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // ─── Lobby WebSocket ───
  const lobby = useLobby({
    meetingId: meeting?.id || '',
    participantId: participantId || '',
    role: 'participant',
    autoConnect: false,
  });

  // ─── Fetch meeting info by code ───
  useEffect(() => {
    if (!code) {
      setStep('error');
      setErrorMessage('No meeting code provided');
      return;
    }

    const fetchMeeting = async () => {
      try {
        const result = await meetings.getByCode(code);
        setMeeting(result);
        if (result.status === 'completed' || result.status === 'cancelled') {
          setStep('error');
          setErrorMessage('This meeting has already ended.');
        } else {
          setStep('enter-name');
        }
      } catch {
        setStep('error');
        setErrorMessage('Meeting not found. Please check the code and try again.');
      }
    };

    fetchMeeting();
  }, [code]);

  // ─── Watch lobby status for transitions ───
  useEffect(() => {
    if (lobby.status === 'approved' && lobby.token) {
      setStep('approved');
      // Auto-redirect after showing success
      const timer = setTimeout(() => {
        navigate(`/meeting/${meeting?.id}`, {
          state: {
            token: lobby.token,
            roomId: lobby.roomId,
            livekitUrl: lobby.livekitUrl,
            participantName: name,
          },
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
    if (lobby.status === 'declined') {
      setStep('declined');
    }
    if (lobby.status === 'error') {
      glassToast.error(lobby.errorMessage || 'Connection error');
    }
  }, [lobby.status, lobby.token, lobby.roomId, lobby.livekitUrl, lobby.errorMessage, meeting?.id, name, navigate]);

  // ─── Request to join ───
  const handleJoin = useCallback(async () => {
    if (!name.trim() || !meeting) return;

    setIsJoining(true);
    try {
      const result = await meetings.join(meeting.id, name.trim());

      // Host auto-approved (name matches host)
      if (result.token && result.room_id) {
        setStep('approved');
        glassToast.success("You're in!");
        setTimeout(() => {
          navigate(`/meeting/${meeting.id}`, {
            state: {
              token: result.token,
              roomId: result.room_id,
              livekitUrl: result.livekit_url,
              participantName: name,
            },
          });
        }, 1000);
        return;
      }

      // Regular participant — waiting for approval
      if (result.participant_id) {
        setParticipantId(result.participant_id);
        setStep('waiting');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to join meeting';
      glassToast.error(msg);
    } finally {
      setIsJoining(false);
    }
  }, [name, meeting, navigate]);

  // ─── Connect lobby WS when we have a participantId ───
  useEffect(() => {
    if (participantId && meeting?.id && step === 'waiting') {
      lobby.connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId, meeting?.id, step]);

  // ─── Cleanup ───
  useEffect(() => {
    return () => {
      lobby.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Render helpers ───
  const renderStep = () => {
    switch (step) {
      case 'loading':
        return (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            <Loader2 className="animate-spin text-cyan mx-auto mb-4" size={32} />
            <p className="text-white/50 text-sm">Loading meeting info...</p>
          </motion.div>
        );

      case 'enter-name':
        return (
          <motion.div
            key="enter-name"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="p-3 rounded-glass-lg bg-cyan/10 w-fit mx-auto mb-6">
              <UserPlus className="text-cyan" size={28} />
            </div>
            <h1 className="text-2xl font-bold text-white/90 mb-2">Join Meeting</h1>
            {meeting && (
              <p className="text-base text-white/70 mb-1 font-medium">{meeting.title}</p>
            )}
            <p className="text-sm text-white/40 mb-8">
              Code: <span className="text-cyan font-mono">{code}</span>
              {meeting?.host_name && (
                <span> &middot; Hosted by {meeting.host_name}</span>
              )}
            </p>

            <div className="space-y-4">
              <GlassInput
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <GlassButton
                variant="primary"
                size="lg"
                fullWidth
                icon={UserPlus}
                onClick={handleJoin}
                loading={isJoining}
                disabled={!name.trim()}
              >
                Request to Join
              </GlassButton>
            </div>
          </motion.div>
        );

      case 'waiting':
        return (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="p-3 rounded-glass-lg bg-lavender/10 w-fit mx-auto mb-6">
              <Clock className="text-lavender" size={28} />
            </div>
            <h2 className="text-xl font-bold text-white/90 mb-2">Waiting for Approval</h2>
            <p className="text-sm text-white/50 mb-2">
              The host will let you in shortly...
            </p>
            <p className="text-xs text-white/30 mb-6">
              Joined as <span className="text-white/60">{name}</span>
              {lobby.position && (
                <span> &middot; Position #{lobby.position}</span>
              )}
            </p>

            {/* Pulsing ring animation */}
            <div className="flex justify-center mb-8">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-cyan/30 animate-ping" />
                <div className="absolute inset-1 rounded-full border-2 border-cyan/20 animate-pulse" />
                <div className="absolute inset-3 rounded-full bg-cyan/10 flex items-center justify-center">
                  <Loader2 className="animate-spin text-cyan" size={20} />
                </div>
              </div>
            </div>

            <GlassButton
              variant="ghost"
              size="md"
              fullWidth
              onClick={() => {
                lobby.disconnect();
                navigate('/');
              }}
            >
              Leave
            </GlassButton>
          </motion.div>
        );

      case 'approved':
        return (
          <motion.div
            key="approved"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle2 className="text-emerald-400" size={32} />
            </motion.div>
            <h2 className="text-xl font-bold text-white/90 mb-2">You're In!</h2>
            <p className="text-sm text-white/50 mb-6">Joining the meeting...</p>
            <Loader2 className="animate-spin text-cyan mx-auto" size={20} />
          </motion.div>
        );

      case 'declined':
        return (
          <motion.div
            key="declined"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
              <XCircle className="text-red-400" size={32} />
            </div>
            <h2 className="text-xl font-bold text-red-400 mb-2">Request Declined</h2>
            <p className="text-sm text-white/50 mb-6">
              The host has declined your request to join.
            </p>
            <div className="flex gap-3">
              <GlassButton variant="ghost" fullWidth onClick={() => navigate('/')}>
                Back to Home
              </GlassButton>
              <GlassButton
                variant="primary"
                fullWidth
                onClick={() => {
                  setStep('enter-name');
                  setName('');
                  setParticipantId(null);
                }}
              >
                Try Again
              </GlassButton>
            </div>
          </motion.div>
        );

      case 'error':
        return (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
              <XCircle className="text-red-400" size={32} />
            </div>
            <h2 className="text-xl font-bold text-red-400 mb-2">Oops!</h2>
            <p className="text-sm text-white/50 mb-6">{errorMessage}</p>
            <GlassButton variant="ghost" fullWidth onClick={() => navigate('/')}>
              Back to Home
            </GlassButton>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 flex items-center justify-center">
      <div className="w-full max-w-md px-4">
        {step !== 'loading' && step !== 'enter-name' ? null : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-white/50 hover:text-white/80 mb-6 text-sm transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Home
            </button>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard variant="heavy" padding="lg" className="text-center">
            <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
