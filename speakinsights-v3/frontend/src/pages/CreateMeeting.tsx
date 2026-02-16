import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Video,
  Copy,
  ExternalLink,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import GlassButton from '@/components/ui/GlassButton';
import GlassInput from '@/components/ui/GlassInput';
import { glassToast } from '@/components/ui/Toast';
import { meetings } from '@/services/api';
import type { CreateMeetingResponse } from '@/types/meeting';

const LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ar', label: 'Arabic' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
];

export default function CreateMeeting() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    host_name: '',
    language: 'en',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState<CreateMeetingResponse | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.host_name.trim()) return;

    setIsCreating(true);
    try {
      const result = await meetings.create({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        language: form.language,
        host_name: form.host_name.trim(),
      });
      setCreatedMeeting(result);
      glassToast.success('Meeting created successfully!');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to create meeting';
      glassToast.error(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const getShareableLink = () => {
    if (!createdMeeting) return '';
    return `${window.location.origin}/join/${createdMeeting.code}`;
  };

  const copyToClipboard = async (text: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      glassToast.success(type === 'code' ? 'Code copied!' : 'Link copied!');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      glassToast.error('Failed to copy');
    }
  };

  const handleStartMeeting = async () => {
    if (!createdMeeting) return;
    try {
      const joinResult = await meetings.join(createdMeeting.id, form.host_name.trim());
      navigate(`/meeting/${createdMeeting.id}`, {
        state: {
          token: joinResult.token,
          roomId: joinResult.room_id,
          livekitUrl: joinResult.livekit_url,
          participantName: form.host_name.trim(),
          isHost: true,
          meetingTitle: createdMeeting.title,
        },
      });
    } catch {
      glassToast.error('Failed to join meeting. Please try again.');
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-lg mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/50 hover:text-white/80 mb-6 text-sm transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <AnimatePresence mode="wait">
            {!createdMeeting ? (
              /* ─── Create Form ─── */
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <GlassCard variant="heavy" padding="lg">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 rounded-glass bg-cyan/10">
                      <Video className="text-cyan" size={22} />
                    </div>
                    <h1 className="text-2xl font-bold text-white/90">Create Meeting</h1>
                  </div>

                  <div className="space-y-5">
                    <GlassInput
                      label="Your Name"
                      name="host_name"
                      placeholder="Enter your name"
                      value={form.host_name}
                      onChange={handleChange}
                    />
                    <GlassInput
                      label="Meeting Title"
                      name="title"
                      placeholder="Team standup, client review..."
                      value={form.title}
                      onChange={handleChange}
                    />
                    <GlassInput
                      label="Description (optional)"
                      name="description"
                      placeholder="What's this meeting about?"
                      value={form.description}
                      onChange={handleChange}
                      textarea
                      rows={3}
                    />

                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-white/60">Language</label>
                      <select
                        value={form.language}
                        onChange={(e) => setForm({ ...form, language: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white/90 focus:outline-none focus:border-cyan transition-colors"
                      >
                        {LANGUAGES.map((lang) => (
                          <option key={lang.value} value={lang.value}>
                            {lang.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Advanced Settings */}
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center gap-2 text-sm text-white/50 hover:text-white/70 transition-colors"
                    >
                      {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      Advanced Settings
                    </button>

                    <AnimatePresence>
                      {showAdvanced && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden space-y-4"
                        >
                          <div className="p-4 rounded-glass bg-white/5 border border-white/10 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-white/60">Auto-record</span>
                              <span className="text-sm text-cyan">Enabled</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-white/60">Max participants</span>
                              <span className="text-sm text-white/80">20</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <GlassButton
                      variant="primary"
                      size="lg"
                      fullWidth
                      loading={isCreating}
                      icon={Video}
                      onClick={handleCreate}
                      disabled={!form.title.trim() || !form.host_name.trim()}
                    >
                      Create Meeting
                    </GlassButton>
                  </div>
                </GlassCard>
              </motion.div>
            ) : (
              /* ─── Success State ─── */
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <GlassCard variant="gradient" padding="lg">
                  <div className="text-center mb-8">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                      className="w-16 h-16 rounded-full bg-cyan/20 border border-cyan/30 flex items-center justify-center mx-auto mb-4"
                    >
                      <Check className="text-cyan" size={32} />
                    </motion.div>
                    <h2 className="text-2xl font-bold text-white/90 mb-1">Meeting Created!</h2>
                    <p className="text-sm text-white/50">
                      Share the code or link with participants
                    </p>
                  </div>

                  {/* Meeting Code */}
                  <div className="mb-6">
                    <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">
                      Meeting Code
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-center">
                        <span className="text-2xl font-mono font-bold text-cyan tracking-widest">
                          {createdMeeting.code}
                        </span>
                      </div>
                      <GlassButton
                        variant="ghost"
                        size="md"
                        icon={copied === 'code' ? Check : Copy}
                        onClick={() => copyToClipboard(createdMeeting.code, 'code')}
                      >
                        {copied === 'code' ? 'Copied' : 'Copy'}
                      </GlassButton>
                    </div>
                  </div>

                  {/* Shareable Link */}
                  <div className="mb-8">
                    <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">
                      Shareable Link
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-white/5 border border-white/10 rounded-glass px-4 py-3 overflow-hidden">
                        <span className="text-sm text-white/70 truncate block">
                          {getShareableLink()}
                        </span>
                      </div>
                      <GlassButton
                        variant="ghost"
                        size="md"
                        icon={copied === 'link' ? Check : Copy}
                        onClick={() => copyToClipboard(getShareableLink(), 'link')}
                      >
                        {copied === 'link' ? 'Copied' : 'Copy'}
                      </GlassButton>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <GlassButton
                      variant="ghost"
                      size="lg"
                      className="flex-1"
                      onClick={() => navigate('/')}
                    >
                      Back to Home
                    </GlassButton>
                    <GlassButton
                      variant="primary"
                      size="lg"
                      icon={ExternalLink}
                      className="flex-1"
                      onClick={handleStartMeeting}
                    >
                      Start Meeting
                    </GlassButton>
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
