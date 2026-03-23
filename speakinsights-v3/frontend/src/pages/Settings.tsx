import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Globe,
  Cpu,
  Video,
  Eye,
  HardDrive,
  Trash2,
  MessageSquare,
  Save,
  CheckCircle,
  Bell,
  Mic,
  Monitor,
  Zap,
  Info,
  ChevronRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

// --- Internal UI Components (Simulating the user's library) ---

const GlassCard = ({ children, className = "" }) => (
  <div className={`backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 overflow-hidden ${className}`}>
    {children}
  </div>
);

const GlassButton = ({ children, variant = 'primary', size = 'md', icon: Icon, onClick, loading, className = "" }) => {
  const variants = {
    primary: "bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border-cyan-500/30",
    danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20",
    ghost: "bg-white/5 hover:bg-white/10 text-white/70 border-white/10",
    outline: "bg-transparent border border-white/10 text-white/60 hover:border-white/20 hover:text-white"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-3.5 text-base"
  };

  return (
    <button 
      onClick={onClick}
      disabled={loading}
      className={`flex items-center justify-center gap-2 font-medium rounded-xl border transition-all duration-300 disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading ? <RefreshCw className="animate-spin" size={18} /> : Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

const CustomSwitch = ({ checked, onChange, label, sublabel }) => (
  <div className="flex items-center justify-between py-3 group cursor-pointer" onClick={() => onChange(!checked)}>
    <div className="flex-1">
      <h4 className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">{label}</h4>
      {sublabel && <p className="text-xs text-white/40 mt-0.5">{sublabel}</p>}
    </div>
    <div className={`w-12 h-6 rounded-full transition-all duration-500 relative ${checked ? 'bg-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]' : 'bg-white/10'}`}>
      <motion.div 
        animate={{ x: checked ? 26 : 4 }}
        initial={false}
        className="w-4 h-4 rounded-full bg-white absolute top-1 shadow-sm"
      />
    </div>
  </div>
);

// --- Constants ---

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
];

const CAPTION_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Med' },
  { value: 'large', label: 'Large' },
];

const TRANSCRIPTION_QUALITY = [
  { value: 'standard', label: 'Standard', desc: 'Fast, lower CPU' },
  { value: 'high', label: 'High Precision', desc: 'Best for multiple speakers' }
];

// --- Main Application ---

export default function App() {
  // State from User's Logic
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  const [defaultModel, setDefaultModel] = useState('gpt-4o-mini');
  const [installedModels, setInstalledModels] = useState([{ name: 'gpt-4o' }, { name: 'gpt-4o-mini' }, { name: 'claude-3-haiku' }]);
  const [chatModel, setChatModel] = useState('gpt-4o-mini');
  const [autoRecord, setAutoRecord] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [captionSize, setCaptionSize] = useState('medium');
  const [saved, setSaved] = useState(false);
  
  // New Features State
  const [notifications, setNotifications] = useState(true);
  const [transQuality, setTransQuality] = useState('high');
  const [autoSave, setAutoSave] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  // Smooth Save Interaction
  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const sectionHeader = (Icon, title, colorClass) => (
    <div className="flex items-center gap-3 mb-6">
      <div className={`p-2 rounded-xl bg-${colorClass}/10 border border-${colorClass}/20`}>
        <Icon className={`text-${colorClass}`} size={20} />
      </div>
      <h3 className="text-lg font-semibold text-white/90">{title}</h3>
    </div>
  );

  return (
    <div className="min-h-screen text-white font-sans selection:bg-cyan-500/30" style={{ backgroundColor: '#02060B' }}>
      
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-cyan-500/5 blur-[120px] rounded-full" />
        <div className="absolute top-[40%] -right-[10%] w-[30%] h-[30%] bg-purple-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 pt-24 pb-32">
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <SettingsIcon className="text-white/80" size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                Preferences
              </h1>
              <p className="text-sm text-white/40 mt-1">Manage your meeting and AI behavior</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">Privacy Secured</span>
          </div>
        </motion.header>

        <div className="space-y-6">
          
          {/* Section: Meeting & Audio */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <GlassCard>
              {sectionHeader(Globe, "Meeting Defaults", "cyan-400")}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Default Language</label>
                  <select 
                    value={defaultLanguage}
                    onChange={(e) => setDefaultLanguage(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all"
                  >
                    {LANGUAGES.map(l => <option key={l.value} value={l.value} className="bg-[#0f172a]">{l.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Max Participants</label>
                  <div className="relative">
                    <input 
                      type="number"
                      value={maxParticipants}
                      onChange={(e) => setMaxParticipants(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all"
                    />
                    <span className="absolute right-4 top-3.5 text-xs text-white/20">Users</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1 divide-y divide-white/5">
                <CustomSwitch 
                  checked={autoRecord} 
                  onChange={setAutoRecord} 
                  label="Instant Recording" 
                  sublabel="Start transcribing as soon as you join a call"
                />
                <CustomSwitch 
                  checked={notifications} 
                  onChange={setNotifications} 
                  label="Meeting Alerts" 
                  sublabel="Sound notifications for key insights during live calls"
                />
              </div>
            </GlassCard>
          </motion.section>

          {/* Section: AI Configuration */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <GlassCard>
              {sectionHeader(Cpu, "AI Intelligence", "purple-400")}
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <label className="flex items-center gap-2 text-xs font-bold text-white/40 uppercase mb-3">
                      <Zap size={12} className="text-amber-400" />
                      Summarization Model
                    </label>
                    <select 
                      value={defaultModel}
                      onChange={(e) => setDefaultModel(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-purple-500/50 transition-colors"
                    >
                      {installedModels.map(m => <option key={m.name} value={m.name} className="bg-[#0f172a]">{m.name}</option>)}
                    </select>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <label className="flex items-center gap-2 text-xs font-bold text-white/40 uppercase mb-3">
                      <MessageSquare size={12} className="text-cyan-400" />
                      Chat Assistant
                    </label>
                    <select 
                      value={chatModel}
                      onChange={(e) => setChatModel(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-cyan-500/50 transition-colors"
                    >
                      {installedModels.map(m => <option key={m.name} value={m.name} className="bg-[#0f172a]">{m.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Transcription Accuracy</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {TRANSCRIPTION_QUALITY.map((q) => (
                      <button
                        key={q.value}
                        onClick={() => setTransQuality(q.value)}
                        className={`text-left p-3 rounded-xl border transition-all duration-300 ${
                          transQuality === q.value 
                          ? 'bg-purple-500/10 border-purple-500/30 ring-1 ring-purple-500/20' 
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="text-sm font-medium text-white/90">{q.label}</div>
                        <div className="text-[10px] text-white/40 mt-0.5">{q.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.section>

          {/* Section: Experience */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <GlassCard>
              {sectionHeader(Eye, "Visual Experience", "emerald-400")}
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Caption Text Size</label>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded uppercase">Preview</span>
                  </div>
                  <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl">
                    {CAPTION_SIZES.map(s => (
                      <button 
                        key={s.value}
                        onClick={() => setCaptionSize(s.value)}
                        className={`flex-1 py-2 text-sm font-medium rounded-xl transition-all ${
                          captionSize === s.value 
                          ? 'bg-white/10 text-white shadow-inner' 
                          : 'text-white/40 hover:text-white/60'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1 divide-y divide-white/5">
                  <CustomSwitch 
                    checked={reduceMotion} 
                    onChange={setReduceMotion} 
                    label="Reduce Motion" 
                    sublabel="Simplify animations for improved performance"
                  />
                  <CustomSwitch 
                    checked={autoSave} 
                    onChange={setAutoSave} 
                    label="Cloud Auto-Save" 
                    sublabel="Sync changes instantly across all your devices"
                  />
                </div>
              </div>
            </GlassCard>
          </motion.section>

          {/* Data Control */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex flex-col md:flex-row gap-4">
              <GlassCard className="flex-1 !p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <HardDrive className="text-red-400" size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Data Storage</h4>
                      <p className="text-[10px] text-white/40">Clean local cache & history</p>
                    </div>
                  </div>
                  <GlassButton variant="danger" size="sm" icon={Trash2} onClick={() => setShowClearModal(true)}>
                    Clear
                  </GlassButton>
                </div>
              </GlassCard>
              
              <GlassCard className="flex-1 !p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Info className="text-blue-400" size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">App Version</h4>
                      <p className="text-[10px] text-white/40">v2.4.0 • Enterprise Edition</p>
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-white/20 uppercase tracking-tighter">Up to date</div>
                </div>
              </GlassCard>
            </div>
          </motion.section>
        </div>

        {/* Floating Save Footer */}
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-4 backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl shadow-2xl flex items-center gap-8 ring-1 ring-white/10"
        >
          <div className="hidden sm:flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-xs font-medium text-white/60">Unsaved changes detected</span>
          </div>
          <div className="flex items-center gap-3">
            <GlassButton variant="outline" size="md">Discard</GlassButton>
            <GlassButton 
              variant="primary" 
              size="md" 
              icon={saved ? CheckCircle : Save} 
              onClick={handleSave}
              className={saved ? "!bg-emerald-500/20 !border-emerald-500/30 !text-emerald-400" : ""}
            >
              {saved ? 'Changes Applied' : 'Save Preferences'}
            </GlassButton>
          </div>
        </motion.div>
      </div>

      {/* Custom Modal Backdrop */}
      <AnimatePresence>
        {showClearModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClearModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-[#0a1118] border border-white/10 p-8 rounded-[32px] shadow-3xl"
            >
              <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
                <Trash2 className="text-red-400" size={32} />
              </div>
              <h2 className="text-xl font-bold text-center mb-2">Clear History?</h2>
              <p className="text-sm text-white/40 text-center mb-8">
                This action is permanent. All transciptions, chat context, and local records will be wiped.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <GlassButton variant="outline" onClick={() => setShowClearModal(false)}>Cancel</GlassButton>
                <GlassButton 
                  variant="danger" 
                  loading={isClearing}
                  onClick={() => {
                    setIsClearing(true);
                    setTimeout(() => {
                      setIsClearing(false);
                      setShowClearModal(false);
                    }, 1500);
                  }}
                >
                  Confirm Delete
                </GlassButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
// import { useState, useEffect } from 'react';
// import { motion } from 'framer-motion';
// import {
//   Settings as SettingsIcon,
//   Globe,
//   Cpu,
//   Video,
//   Eye,
//   HardDrive,
//   Trash2,
//   MessageSquare,
//   Save,
//   CheckCircle,
// } from 'lucide-react';
// import GlassCard from '@/components/ui/GlassCard';
// import GlassButton from '@/components/ui/GlassButton';
// import GlassModal from '@/components/ui/GlassModal';
// import { useUIStore } from '@/stores/uiStore';
// import { models as modelsApi, chat } from '@/services/api';
// import { glassToast } from '@/components/ui/Toast';

// const LANGUAGES = [
//   { value: 'en', label: 'English' },
//   { value: 'es', label: 'Spanish' },
//   { value: 'fr', label: 'French' },
//   { value: 'de', label: 'German' },
//   { value: 'ja', label: 'Japanese' },
//   { value: 'zh', label: 'Chinese' },
//   { value: 'hi', label: 'Hindi' },
//   { value: 'pt', label: 'Portuguese' },
//   { value: 'ko', label: 'Korean' },
//   { value: 'ar', label: 'Arabic' },
// ];

// const CAPTION_SIZES = [
//   { value: 'small', label: 'Small' },
//   { value: 'medium', label: 'Medium' },
//   { value: 'large', label: 'Large' },
// ];

// export default function Settings() {
//   const { defaultLanguage, setDefaultLanguage, defaultModel, setDefaultModel } = useUIStore();

//   const [installedModels, setInstalledModels] = useState<{ name: string }[]>([]);
//   const [chatModel, setChatModel] = useState(() =>
//     localStorage.getItem('speakinsights_chat_model') || '',
//   );
//   const [autoRecord, setAutoRecord] = useState(() =>
//     localStorage.getItem('speakinsights_auto_record') !== 'false',
//   );
//   const [maxParticipants, setMaxParticipants] = useState(() =>
//     parseInt(localStorage.getItem('speakinsights_max_participants') || '20'),
//   );
//   const [reduceMotion, setReduceMotion] = useState(() =>
//     localStorage.getItem('speakinsights_reduce_motion') === 'true',
//   );
//   const [captionSize, setCaptionSize] = useState(() =>
//     localStorage.getItem('speakinsights_caption_size') || 'medium',
//   );
//   const [saved, setSaved] = useState(false);
//   const [clearChatModal, setClearChatModal] = useState(false);
//   const [clearingChat, setClearingChat] = useState(false);

//   // Load models
//   useEffect(() => {
//     modelsApi
//       .list()
//       .then((data) => {
//         const models = data.models || [];
//         setInstalledModels(models);
//         if (!chatModel && models.length > 0) {
//           setChatModel(models[0].name);
//         }
//       })
//       .catch(() => {});
//   }, []);

//   const selectClass =
//     'w-full bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white/90 focus:outline-none focus:border-cyan/50 transition-colors appearance-none';

//   const handleSave = () => {
//     localStorage.setItem('speakinsights_chat_model', chatModel);
//     localStorage.setItem('speakinsights_auto_record', String(autoRecord));
//     localStorage.setItem('speakinsights_max_participants', String(maxParticipants));
//     localStorage.setItem('speakinsights_reduce_motion', String(reduceMotion));
//     localStorage.setItem('speakinsights_caption_size', captionSize);
//     localStorage.setItem('speakinsights_default_model', defaultModel);

//     setSaved(true);
//     glassToast.success('Settings saved');
//     setTimeout(() => setSaved(false), 2000);
//   };

//   const handleClearChat = async () => {
//     setClearingChat(true);
//     try {
//       const data: any = await chat.getSessions();
//       const allSessions = data.sessions || (Array.isArray(data) ? data : []);
//       for (const s of allSessions) {
//         await chat.deleteSession(s.session_id);
//       }
//       glassToast.success(`Cleared ${allSessions.length} chat session(s)`);
//     } catch {
//       glassToast.error('Failed to clear chat history');
//     }
//     setClearingChat(false);
//     setClearChatModal(false);
//   };

//   const nonEmbedModels = installedModels.filter(
//     (m) => !m.name.includes('embed') && !m.name.includes('nomic'),
//   );

//   return (
//     <div className="min-h-screen pt-24 pb-16">
//       <div className="max-w-2xl mx-auto px-4">
//         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
//           {/* Header */}
//           <div className="flex items-center gap-3 mb-8">
//             <div className="p-2.5 rounded-glass bg-lavender/10">
//               <SettingsIcon className="text-lavender" size={22} />
//             </div>
//             <h1 className="text-2xl font-bold text-white/90">Settings</h1>
//           </div>

//           <div className="space-y-5">
//             {/* Section 1: Meeting Defaults */}
//             <GlassCard>
//               <div className="flex items-center gap-2 mb-5">
//                 <Globe size={16} className="text-cyan" />
//                 <h3 className="font-semibold text-white/90">Meeting Defaults</h3>
//               </div>

//               <div className="space-y-4">
//                 <div>
//                   <label className="block text-sm text-white/60 mb-1.5">Default Language</label>
//                   <select
//                     value={defaultLanguage}
//                     onChange={(e) => setDefaultLanguage(e.target.value)}
//                     className={selectClass}
//                   >
//                     {LANGUAGES.map((lang) => (
//                       <option key={lang.value} value={lang.value} className="bg-navy-light">
//                         {lang.label}
//                       </option>
//                     ))}
//                   </select>
//                 </div>

//                 <div className="flex items-center justify-between py-2">
//                   <div>
//                     <label className="text-sm text-white/80">Auto-Record</label>
//                     <p className="text-xs text-white/30 mt-0.5">
//                       Automatically start recording when meeting begins
//                     </p>
//                   </div>
//                   <button
//                     onClick={() => setAutoRecord(!autoRecord)}
//                     className={`w-11 h-6 rounded-full transition-colors relative ${
//                       autoRecord ? 'bg-cyan/40' : 'bg-white/10'
//                     }`}
//                   >
//                     <div
//                       className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
//                         autoRecord ? 'translate-x-6' : 'translate-x-1'
//                       }`}
//                     />
//                   </button>
//                 </div>

//                 <div>
//                   <label className="block text-sm text-white/60 mb-1.5">
//                     Max Participants
//                   </label>
//                   <input
//                     type="number"
//                     min={2}
//                     max={20}
//                     value={maxParticipants}
//                     onChange={(e) =>
//                       setMaxParticipants(Math.min(20, Math.max(2, parseInt(e.target.value) || 2)))
//                     }
//                     className={selectClass}
//                   />
//                 </div>
//               </div>
//             </GlassCard>

//             {/* Section 2: AI Models */}
//             <GlassCard>
//               <div className="flex items-center gap-2 mb-5">
//                 <Cpu size={16} className="text-lavender" />
//                 <h3 className="font-semibold text-white/90">AI Models</h3>
//               </div>

//               <div className="space-y-4">
//                 <div>
//                   <label className="block text-sm text-white/60 mb-1.5">
//                     Default Summary Model
//                   </label>
//                   <select
//                     value={defaultModel}
//                     onChange={(e) => setDefaultModel(e.target.value)}
//                     className={selectClass}
//                   >
//                     {nonEmbedModels.map((m) => (
//                       <option key={m.name} value={m.name} className="bg-navy-light">
//                         {m.name}
//                       </option>
//                     ))}
//                     {nonEmbedModels.length === 0 && (
//                       <option value="" className="bg-navy-light">
//                         No models installed
//                       </option>
//                     )}
//                   </select>
//                 </div>

//                 <div>
//                   <label className="block text-sm text-white/60 mb-1.5">
//                     Default Chat Model
//                   </label>
//                   <select
//                     value={chatModel}
//                     onChange={(e) => setChatModel(e.target.value)}
//                     className={selectClass}
//                   >
//                     {nonEmbedModels.map((m) => (
//                       <option key={m.name} value={m.name} className="bg-navy-light">
//                         {m.name}
//                       </option>
//                     ))}
//                     {nonEmbedModels.length === 0 && (
//                       <option value="" className="bg-navy-light">
//                         No models installed
//                       </option>
//                     )}
//                   </select>
//                 </div>

//                 <div>
//                   <label className="block text-sm text-white/60 mb-1.5">Embedding Model</label>
//                   <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white/50 text-sm">
//                     <span>nomic-embed-text</span>
//                     <span className="text-xs text-white/25 ml-auto">(read-only)</span>
//                   </div>
//                 </div>
//               </div>
//             </GlassCard>

//             {/* Section 3: Appearance */}
//             <GlassCard>
//               <div className="flex items-center gap-2 mb-5">
//                 <Eye size={16} className="text-emerald-400" />
//                 <h3 className="font-semibold text-white/90">Appearance</h3>
//               </div>

//               <div className="space-y-4">
//                 <div className="flex items-center justify-between py-2">
//                   <div>
//                     <label className="text-sm text-white/80">Reduce Motion</label>
//                     <p className="text-xs text-white/30 mt-0.5">
//                       Disable animations for accessibility
//                     </p>
//                   </div>
//                   <button
//                     onClick={() => setReduceMotion(!reduceMotion)}
//                     className={`w-11 h-6 rounded-full transition-colors relative ${
//                       reduceMotion ? 'bg-cyan/40' : 'bg-white/10'
//                     }`}
//                   >
//                     <div
//                       className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
//                         reduceMotion ? 'translate-x-6' : 'translate-x-1'
//                       }`}
//                     />
//                   </button>
//                 </div>

//                 <div>
//                   <label className="block text-sm text-white/60 mb-1.5">Caption Font Size</label>
//                   <div className="flex gap-2">
//                     {CAPTION_SIZES.map((size) => (
//                       <button
//                         key={size.value}
//                         onClick={() => setCaptionSize(size.value)}
//                         className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
//                           captionSize === size.value
//                             ? 'bg-cyan/15 border-cyan/30 text-cyan'
//                             : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/8 hover:border-white/15'
//                         }`}
//                       >
//                         {size.label}
//                       </button>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//             </GlassCard>

//             {/* Section 4: Storage */}
//             <GlassCard>
//               <div className="flex items-center gap-2 mb-5">
//                 <HardDrive size={16} className="text-amber-400" />
//                 <h3 className="font-semibold text-white/90">Storage</h3>
//               </div>

//               <div className="space-y-3">
//                 <GlassButton
//                   variant="ghost"
//                   size="sm"
//                   icon={MessageSquare}
//                   onClick={() => setClearChatModal(true)}
//                 >
//                   Clear Chat History
//                 </GlassButton>
//               </div>
//             </GlassCard>

//             {/* Save button */}
//             <div className="flex justify-end pt-2 pb-8">
//               <GlassButton
//                 variant="primary"
//                 size="lg"
//                 icon={saved ? CheckCircle : Save}
//                 onClick={handleSave}
//               >
//                 {saved ? 'Saved!' : 'Save Settings'}
//               </GlassButton>
//             </div>
//           </div>
//         </motion.div>
//       </div>

//       {/* Clear chat confirmation */}
//       <GlassModal
//         isOpen={clearChatModal}
//         onClose={() => setClearChatModal(false)}
//         title="Clear Chat History"
//         size="sm"
//       >
//         <p className="text-sm text-white/60 mb-4">
//           This will permanently delete all chat sessions and their messages. This cannot be undone.
//         </p>
//         <div className="flex items-center justify-end gap-3">
//           <GlassButton variant="ghost" size="sm" onClick={() => setClearChatModal(false)}>
//             Cancel
//           </GlassButton>
//           <GlassButton
//             variant="danger"
//             size="sm"
//             icon={Trash2}
//             loading={clearingChat}
//             onClick={handleClearChat}
//           >
//             Clear All
//           </GlassButton>
//         </div>
//       </GlassModal>
//     </div>
//   );
// }
