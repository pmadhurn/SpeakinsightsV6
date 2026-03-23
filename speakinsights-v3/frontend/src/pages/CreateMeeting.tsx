import React, { useState, useEffect } from 'react';
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
  Globe, 
  Users, 
  Mic, 
  ShieldCheck,
  Sparkles
} from 'lucide-react';

// --- Theme Constants ---
const COLORS = {
  bg: '#020B10',
  glass: 'rgba(15, 23, 42, 0.6)',
  border: 'rgba(255, 255, 255, 0.08)',
  accent: '#06b6d4', // Cyan-500
  accentMuted: 'rgba(6, 182, 212, 0.2)',
};

// --- Mock API Service ---
const mockApi = {
  createMeeting: async (data) => {
    await new Promise(r => setTimeout(r, 1500)); // Simulate network
    return {
      id: Math.random().toString(36).substr(2, 9),
      code: Math.random().toString(36).toUpperCase().substr(2, 6),
      ...data
    };
  }
};

const LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
];

// --- Internal Glass UI Components ---

const GlassCard = ({ children, className = "", variant = "default" }) => {
  const variants = {
    default: "bg-slate-900/40 border-white/5",
    heavy: "bg-slate-950/80 border-white/10 shadow-2xl",
    gradient: "bg-gradient-to-br from-slate-900/60 to-black/40 border-cyan-500/20"
  };
  
  return (
    <div className={`backdrop-blur-xl rounded-3xl border p-6 md:p-8 ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
};

const GlassInput = ({ label, icon: Icon, textarea, ...props }) => (
  <div className="space-y-2 group">
    {label && <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest ml-1">{label}</label>}
    <div className="relative">
      {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" size={18} />}
      {textarea ? (
        <textarea 
          {...props} 
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all resize-none"
        />
      ) : (
        <input 
          {...props} 
          className={`w-full bg-white/5 border border-white/10 rounded-2xl ${Icon ? 'pl-12' : 'px-4'} py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all`}
        />
      )}
    </div>
  </div>
);

const GlassButton = ({ children, onClick, variant = "primary", icon: Icon, loading, disabled, fullWidth, className = "" }) => {
  const base = "relative flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none overflow-hidden";
  const variants = {
    primary: "bg-cyan-600 text-white hover:bg-cyan-500 shadow-lg shadow-cyan-900/20",
    secondary: "bg-white/5 text-white border border-white/10 hover:bg-white/10",
    ghost: "text-slate-400 hover:text-white hover:bg-white/5",
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <>
          {Icon && <Icon size={19} />}
          {children}
        </>
      )}
    </button>
  );
};

// --- Main Application ---

export default function App() {
  const navigate = useNavigate();
  const [view, setView] = useState('create'); // 'create' | 'success'
  const [form, setForm] = useState({
    title: '',
    description: '',
    host_name: '',
    language: 'en',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState(null);
  const [copiedType, setCopiedType] = useState(null);

  const handleCopy = (text, type) => {
    // navigator.clipboard is preferred, execCommand as legacy fallback
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedType(type);
        setTimeout(() => setCopiedType(null), 2000);
      });
    } else {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    }
  };

  const handleCreate = async () => {
    if (!form.title || !form.host_name) return;
    setIsCreating(true);
    try {
      const result = await mockApi.createMeeting(form);
      setCreatedMeeting(result);
      setView('success');
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen selection:bg-cyan-500/30 selection:text-cyan-200" style={{ backgroundColor: COLORS.bg }}>
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-blue-600/10 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-xl mx-auto px-6 pt-20 pb-20">
        
        {/* Navigation */}
        <button 
          onClick={() => navigate('/')}
          className="group flex items-center gap-2 mt-10 text-slate-500 hover:text-white mb-10 transition-colors"
        >
          <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
            <ArrowLeft size={16} />
          </div>
          <span className="text-sm font-medium">Back to dashboard</span>
        </button>

        <AnimatePresence mode="wait">
          {view === 'create' ? (
            <motion.div
              key="create-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <GlassCard variant="heavy">
                <header className="flex items-center gap-4 mb-10">
                  <div className="relative">
                    <div className="absolute inset-0 bg-cyan-400 blur-lg opacity-20" />
                    <div className="relative p-3.5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
                      <Video className="text-cyan-400" size={26} />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">New Meeting</h1>
                    <p className="text-slate-400 text-sm mt-0.5">Configure your space & invite others</p>
                  </div>
                </header>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <GlassInput 
                      label="Host Name" 
                      placeholder="e.g. Alex Rivera"
                      value={form.host_name}
                      onChange={e => setForm({...form, host_name: e.target.value})}
                    />
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest ml-1">Language</label>
                      <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <select 
                          className="w-full appearance-none bg-white/5 border border-white/10 rounded-2xl pl-12 pr-10 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                          value={form.language}
                          onChange={e => setForm({...form, language: e.target.value})}
                        >
                          {LANGUAGES.map(l => <option key={l.value} value={l.value} className="bg-slate-900">{l.label}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                      </div>
                    </div>
                  </div>

                  <GlassInput 
                    label="Meeting Title" 
                    placeholder="Project Synchronization"
                    value={form.title}
                    onChange={e => setForm({...form, title: e.target.value})}
                  />

                  <GlassInput 
                    label="Agenda (Optional)" 
                    textarea={true}
                    rows={3}
                    placeholder="Briefly describe what will be discussed..."
                    value={form.description}
                    onChange={e => setForm({...form, description: e.target.value})}
                  />

                  {/* Advanced Settings */}
                  <div className="pt-2">
                    <button 
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-cyan-400 transition-colors"
                    >
                      {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      Advanced Configuration
                    </button>
                    
                    <AnimatePresence>
                      {showAdvanced && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden mt-4"
                        >
                          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-500/10">
                                  <ShieldCheck className="text-emerald-500" size={16} />
                                </div>
                                <span className="text-sm text-slate-300">End-to-end Encryption</span>
                              </div>
                              <span className="text-[10px] font-bold text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase">Active</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-cyan-500/10">
                                  <Mic className="text-cyan-500" size={16} />
                                </div>
                                <span className="text-sm text-slate-300">AI Transcription</span>
                              </div>
                              <div className="w-10 h-5 bg-cyan-600 rounded-full relative cursor-pointer">
                                <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="pt-4">
                    <GlassButton 
                      fullWidth 
                      size="lg" 
                      loading={isCreating} 
                      onClick={handleCreate}
                      disabled={!form.title || !form.host_name}
                      icon={Sparkles}
                    >
                      Launch Meeting
                    </GlassButton>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ) : (
            <motion.div
              key="success-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", damping: 20 }}
            >
              <GlassCard variant="gradient">
                <div className="text-center mb-10">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                    className="inline-flex p-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6 relative"
                  >
                    <div className="absolute inset-0 bg-cyan-400 blur-xl opacity-20 animate-pulse" />
                    <Check className="text-cyan-400 relative" size={36} />
                  </motion.div>
                  <h2 className="text-3xl font-bold text-white mb-2">You're all set!</h2>
                  <p className="text-slate-400">The room is ready for your team.</p>
                </div>

                <div className="space-y-6">
                  {/* Meeting Code */}
                  <div className="group">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3 block text-center">Room Invite Code</label>
                    <div className="relative flex items-center gap-3 bg-black/40 border border-white/5 p-2 rounded-2xl group-hover:border-cyan-500/30 transition-all">
                      <div className="flex-1 text-center py-4 font-mono text-4xl font-black text-cyan-400 tracking-[0.25em] pl-10">
                        {createdMeeting?.code}
                      </div>
                      <GlassButton 
                        variant="ghost" 
                        className="!p-4"
                        onClick={() => handleCopy(createdMeeting?.code, 'code')}
                      >
                        {copiedType === 'code' ? <Check className="text-emerald-400" /> : <Copy size={20} />}
                      </GlassButton>
                    </div>
                  </div>

                  {/* Share Link */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Universal Access Link</label>
                    <div className="flex items-center gap-2 p-1.5 pl-4 rounded-2xl bg-white/[0.03] border border-white/5">
                      <span className="text-sm text-slate-400 truncate flex-1">
                        connect.vibe/join/{createdMeeting?.code.toLowerCase()}
                      </span>
                      <GlassButton 
                        variant="secondary" 
                        className="py-2 px-4 !rounded-xl text-sm"
                        onClick={() => handleCopy(`https://connect.vibe/join/${createdMeeting?.code}`, 'link')}
                      >
                        {copiedType === 'link' ? 'Link Copied' : 'Copy'}
                      </GlassButton>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-6">
                    <GlassButton variant="secondary" onClick={() => setView('create')}>
                      Cancel
                    </GlassButton>
                    <GlassButton icon={ExternalLink}>
                      Join Now
                    </GlassButton>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-center gap-4 text-slate-500">
                  <div className="flex -space-x-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center">
                        <Users size={12} />
                      </div>
                    ))}
                  </div>
                  <span className="text-xs font-medium">Auto-invite team members via Slack</span>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
// import { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { motion, AnimatePresence } from 'framer-motion';
// import {
//   ArrowLeft,
//   Video,
//   Copy,
//   ExternalLink,
//   Check,
//   ChevronDown,
//   ChevronUp,
// } from 'lucide-react';
// import GlassCard from '@/components/ui/GlassCard';
// import GlassButton from '@/components/ui/GlassButton';
// import GlassInput from '@/components/ui/GlassInput';
// import { glassToast } from '@/components/ui/Toast';
// import { meetings } from '@/services/api';
// import type { CreateMeetingResponse } from '@/types/meeting';

// const LANGUAGES = [
//   { value: 'auto', label: 'Auto-detect' },
//   { value: 'en', label: 'English' },
//   { value: 'es', label: 'Spanish' },
//   { value: 'fr', label: 'French' },
//   { value: 'de', label: 'German' },
//   { value: 'zh', label: 'Chinese' },
//   { value: 'ja', label: 'Japanese' },
//   { value: 'ko', label: 'Korean' },
//   { value: 'hi', label: 'Hindi' },
//   { value: 'ar', label: 'Arabic' },
//   { value: 'pt', label: 'Portuguese' },
//   { value: 'ru', label: 'Russian' },
// ];

// export default function CreateMeeting() {
//   const navigate = useNavigate();
//   const [form, setForm] = useState({
//     title: '',
//     description: '',
//     host_name: '',
//     language: 'en',
//   });
//   const [isCreating, setIsCreating] = useState(false);
//   const [showAdvanced, setShowAdvanced] = useState(false);
//   const [createdMeeting, setCreatedMeeting] = useState<CreateMeetingResponse | null>(null);
//   const [copied, setCopied] = useState<'code' | 'link' | null>(null);

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
//     setForm({ ...form, [e.target.name]: e.target.value });
//   };

//   const handleCreate = async () => {
//     if (!form.title.trim() || !form.host_name.trim()) return;

//     setIsCreating(true);
//     try {
//       const result = await meetings.create({
//         title: form.title.trim(),
//         description: form.description.trim() || undefined,
//         language: form.language,
//         host_name: form.host_name.trim(),
//       });
//       setCreatedMeeting(result);
//       glassToast.success('Meeting created successfully!');
//     } catch (err: unknown) {
//       const msg =
//         (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
//         'Failed to create meeting';
//       glassToast.error(msg);
//     } finally {
//       setIsCreating(false);
//     }
//   };

//   const getShareableLink = () => {
//     if (!createdMeeting) return '';
//     return `${window.location.origin}/join/${createdMeeting.code}`;
//   };

//   const copyToClipboard = async (text: string, type: 'code' | 'link') => {
//     try {
//       await navigator.clipboard.writeText(text);
//       setCopied(type);
//       glassToast.success(type === 'code' ? 'Code copied!' : 'Link copied!');
//       setTimeout(() => setCopied(null), 2000);
//     } catch {
//       glassToast.error('Failed to copy');
//     }
//   };



//   const handleStartMeeting = async () => {
//     if (!createdMeeting) return;
//     try {
//       const joinResult = await meetings.join(createdMeeting.id, form.host_name.trim());
//       navigate(`/meeting/${createdMeeting.id}`, {
//         state: {
//           token: joinResult.token,
//           roomId: joinResult.room_id,
//           livekitUrl: joinResult.livekit_url,
//           participantName: form.host_name.trim(),
//           isHost: true,
//           meetingTitle: createdMeeting.title,
//         },
//       });
//     } catch {
//       glassToast.error('Failed to join meeting. Please try again.');
//     }
//   };

//   return (
//     <div className="min-h-screen pt-24 pb-16">
//       <div className="max-w-lg mx-auto px-4">
//         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
//           <button
//             onClick={() => navigate(-1)}
//             className="flex items-center gap-2 text-white/50 hover:text-white/80 mb-6 text-sm transition-colors"
//           >
//             <ArrowLeft size={16} />
//             Back
//           </button>

//           <AnimatePresence mode="wait">
//             {!createdMeeting ? (
//               /* ─── Create Form ─── */
//               <motion.div
//                 key="form"
//                 initial={{ opacity: 0, y: 20 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 exit={{ opacity: 0, y: -20 }}
//               >
//                 <GlassCard variant="heavy" padding="lg">
//                   <div className="flex items-center gap-3 mb-8">
//                     <div className="p-2.5 rounded-glass bg-cyan/10">
//                       <Video className="text-cyan" size={22} />
//                     </div>
//                     <h1 className="text-2xl font-bold text-white/90">Create Meeting</h1>
//                   </div>

//                   <div className="space-y-5">
//                     <GlassInput
//                       label="Your Name"
//                       name="host_name"
//                       placeholder="Enter your name"
//                       value={form.host_name}
//                       onChange={handleChange}
//                     />
//                     <GlassInput
//                       label="Meeting Title"
//                       name="title"
//                       placeholder="Team standup, client review..."
//                       value={form.title}
//                       onChange={handleChange}
//                     />
//                     <GlassInput
//                       label="Description (optional)"
//                       name="description"
//                       placeholder="What's this meeting about?"
//                       value={form.description}
//                       onChange={handleChange}
//                       textarea
//                       rows={3}
//                     />

//                     <div className="space-y-1.5">
//                       <label className="block text-sm font-medium text-white/60">Language</label>
//                       <select
//                         value={form.language}
//                         onChange={(e) => setForm({ ...form, language: e.target.value })}
//                         className="w-full bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white/90 focus:outline-none focus:border-cyan transition-colors"
//                       >
//                         {LANGUAGES.map((lang) => (
//                           <option key={lang.value} value={lang.value}>
//                             {lang.label}
//                           </option>
//                         ))}
//                       </select>
//                     </div>

//                     {/* Advanced Settings */}
//                     <button
//                       type="button"
//                       onClick={() => setShowAdvanced(!showAdvanced)}
//                       className="flex items-center gap-2 text-sm text-white/50 hover:text-white/70 transition-colors"
//                     >
//                       {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
//                       Advanced Settings
//                     </button>

//                     <AnimatePresence>
//                       {showAdvanced && (
//                         <motion.div
//                           initial={{ height: 0, opacity: 0 }}
//                           animate={{ height: 'auto', opacity: 1 }}
//                           exit={{ height: 0, opacity: 0 }}
//                           className="overflow-hidden space-y-4"
//                         >
//                           <div className="p-4 rounded-glass bg-white/5 border border-white/10 space-y-3">
//                             <div className="flex items-center justify-between">
//                               <span className="text-sm text-white/60">Auto-record</span>
//                               <span className="text-sm text-cyan">Enabled</span>
//                             </div>
//                             <div className="flex items-center justify-between">
//                               <span className="text-sm text-white/60">Max participants</span>
//                               <span className="text-sm text-white/80">20</span>
//                             </div>
//                           </div>
//                         </motion.div>
//                       )}
//                     </AnimatePresence>

//                     <GlassButton
//                       variant="primary"
//                       size="lg"
//                       fullWidth
//                       loading={isCreating}
//                       icon={Video}
//                       onClick={handleCreate}
//                       disabled={!form.title.trim() || !form.host_name.trim()}
//                     >
//                       Create Meeting
//                     </GlassButton>
//                   </div>
//                 </GlassCard>
//               </motion.div>
//             ) : (
//               /* ─── Success State ─── */
//               <motion.div
//                 key="success"
//                 initial={{ opacity: 0, y: 20 }}
//                 animate={{ opacity: 1, y: 0 }}
//               >
//                 <GlassCard variant="gradient" padding="lg">
//                   <div className="text-center mb-8">
//                     <motion.div
//                       initial={{ scale: 0 }}
//                       animate={{ scale: 1 }}
//                       transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
//                       className="w-16 h-16 rounded-full bg-cyan/20 border border-cyan/30 flex items-center justify-center mx-auto mb-4"
//                     >
//                       <Check className="text-cyan" size={32} />
//                     </motion.div>
//                     <h2 className="text-2xl font-bold text-white/90 mb-1">Meeting Created!</h2>
//                     <p className="text-sm text-white/50">
//                       Share the code or link with participants
//                     </p>
//                   </div>

//                   {/* Meeting Code */}
//                   <div className="mb-6">
//                     <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">
//                       Meeting Code
//                     </label>
//                     <div className="flex items-center gap-3">
//                       <div className="flex-1 bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-center">
//                         <span className="text-2xl font-mono font-bold text-cyan tracking-widest">
//                           {createdMeeting.code}
//                         </span>
//                       </div>
//                       <GlassButton
//                         variant="ghost"
//                         size="md"
//                         icon={copied === 'code' ? Check : Copy}
//                         onClick={() => copyToClipboard(createdMeeting.code, 'code')}
//                       >
//                         {copied === 'code' ? 'Copied' : 'Copy'}
//                       </GlassButton>
//                     </div>
//                   </div>

//                   {/* Shareable Link */}
//                   <div className="mb-8">
//                     <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">
//                       Shareable Link
//                     </label>
//                     <div className="flex items-center gap-3">
//                       <div className="flex-1 bg-white/5 border border-white/10 rounded-glass px-4 py-3 overflow-hidden">
//                         <span className="text-sm text-white/70 truncate block">
//                           {getShareableLink()}
//                         </span>
//                       </div>
//                       <GlassButton
//                         variant="ghost"
//                         size="md"
//                         icon={copied === 'link' ? Check : Copy}
//                         onClick={() => copyToClipboard(getShareableLink(), 'link')}
//                       >
//                         {copied === 'link' ? 'Copied' : 'Copy'}
//                       </GlassButton>
//                     </div>
//                   </div>

//                   {/* Actions */}
//                   <div className="flex gap-3">
//                     <GlassButton
//                       variant="ghost"
//                       size="lg"
//                       className="flex-1"
//                       onClick={() => navigate('/')}
//                     >
//                       Back to Home
//                     </GlassButton>
//                     <GlassButton
//                       variant="primary"
//                       size="lg"
//                       icon={ExternalLink}
//                       className="flex-1"
//                       onClick={handleStartMeeting}
//                     >
//                       Start Meeting
//                     </GlassButton>
//                   </div>
//                 </GlassCard>
//               </motion.div>
//             )}
//           </AnimatePresence>
//         </motion.div>
//       </div>
//     </div>
//   );
// }
