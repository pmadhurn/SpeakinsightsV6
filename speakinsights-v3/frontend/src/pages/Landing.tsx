import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { 
  Mic, MessageSquare, Plus, ArrowRight, Users, 
  Brain, Shield, Zap, Activity, Command, Facebook, 
  Twitter, Github, Linkedin, Video, CheckCircle2, Lock 
} from 'lucide-react';

import Navbar from '../components/ui/GlassNavbar'; // Importing the separated Navbar

// --- Shared Helper Components --- //
export const GlassCard = ({ children, className = "", shimmer = false, variant = "default" }: { children: React.ReactNode; className?: string; shimmer?: boolean; variant?: string }) => {
  const variants: Record<string, string> = {
    default: "bg-white/[0.03] border-white/10",
    gradient: "bg-gradient-to-br from-white/[0.08] to-transparent border-white/20 shadow-2xl",
    solid: "bg-[#0a0c10] border-white/10",
    highlight: "bg-cyan-500/5 border-cyan-500/20"
  };

  return (
    <div className={`relative overflow-hidden rounded-[2rem] border backdrop-blur-md transition-all duration-500 group ${variants[variant]} ${className}`}>
      {shimmer && (
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
      )}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

export const GlassButton = ({ children, variant = "primary", size, icon: Icon, onClick, className = "", disabled = false }: { children: any; variant?: string; size?: string; icon?: any; onClick?: any; className?: string; disabled?: boolean }) => {
  const base = "relative flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-black transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none overflow-hidden group tracking-tight";
  const themes: Record<string, string> = {
    primary: "bg-white text-black hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]",
    secondary: "bg-white/5 text-white border border-white/10 hover:bg-white/10",
    cyan: "bg-cyan-500 text-white shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:bg-cyan-400",
    outline: "bg-transparent text-white border-2 border-white/20 hover:border-white hover:bg-white/5"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${themes[variant] || ''} ${className}`}>
      {variant === "primary" && (
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      )}
      <span className="relative z-10">{children}</span>
      {Icon && <Icon size={20} className="relative z-10 group-hover:translate-x-1 transition-transform" />}
    </button>
  );
};

const SectionTitle = ({ subtitle, title, description, center = true }: { subtitle: any; title: any; description?: any; center?: boolean }) => (
  <div className={`mb-16 ${center ? 'text-center' : 'text-left'}`}>
    <motion.span initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} className="text-cyan-400 text-xs font-black tracking-[0.4em] uppercase mb-4 block">
      {subtitle}
    </motion.span>
    <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-4xl md:text-6xl font-black tracking-tighter mb-6 leading-tight">
      {title}
    </motion.h2>
    {description && (
      <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-white/40 text-lg max-w-2xl mx-auto leading-relaxed">
        {description}
      </motion.p>
    )}
  </div>
);

// --- Sub Components Internal to LandingPage --- //
const ProcessStep = ({ step, title, body, active }: { step: string; title: string; body: string; active: boolean }) => (
  <div className={`transition-all duration-700 py-12 ${active ? 'opacity-100' : 'opacity-20'}`}>
    <div className={`text-5xl font-black mb-4 ${active ? 'text-cyan-400' : 'text-white/10'}`}>{step}</div>
    <h4 className="text-3xl font-black mb-4 uppercase tracking-tighter">{title}</h4>
    <p className="text-white/40 text-lg leading-relaxed max-w-md">{body}</p>
  </div>
);

const ROICalculator = () => {
  const [meetings, setMeetings] = useState(10);
  const timeSaved = meetings * 0.5;
  return (
    <GlassCard variant="gradient" className="p-8 md:p-12">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h3 className="text-3xl font-black mb-6 tracking-tight">Efficiency Calculator</h3>
          <p className="text-white/40 mb-8">Estimate how many hours SpeakInsights can save your team per month by automating summaries and action items.</p>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-4">
                <span className="font-bold text-sm uppercase tracking-wider">Meetings per Month</span>
                <span className="text-cyan-400 font-black">{meetings}</span>
              </div>
              <input type="range" min="1" max="100" value={meetings} onChange={(e) => setMeetings(Number(e.target.value))} className="w-full accent-cyan-400 h-1 rounded-full cursor-pointer" />
            </div>
          </div>
        </div>
        <div className="bg-white/5 rounded-3xl p-8 text-center border border-white/10">
          <div className="text-6xl font-black text-white mb-2">{timeSaved}h</div>
          <div className="text-cyan-400 font-bold uppercase tracking-widest text-xs mb-6">Hours Saved / Mo</div>
          <div className="h-px bg-white/10 w-full mb-6" />
          <p className="text-sm text-white/40 leading-relaxed italic">
            "By automating post-meeting tasks, your team gains back nearly {Math.floor(timeSaved/8)} full work days per year."
          </p>
        </div>
      </div>
    </GlassCard>
  );
};

// --- Page Data --- //
const techStack = ["WhisperX", "Ollama", "LiveKit", "React", "Tailwind", "Framer", "Docker", "Node.js", "Redis", "Postgres"];

const features = [
  { icon: Users, title: 'Collaborative Space', desc: 'Secure rooms for up to 20 users with zero-lag WebRTC streaming.', color: 'text-cyan-400', glow: 'bg-cyan-500/10' },
  { icon: Brain, title: 'Edge Intelligence', desc: 'Local LLM processing for instant summaries and task extraction.', color: 'text-purple-400', glow: 'bg-purple-500/10' },
  { icon: Shield, title: 'Air-Gapped Privacy', desc: 'Enterprise-grade security where no data ever leaves your LAN.', color: 'text-emerald-400', glow: 'bg-emerald-500/10' },
  { icon: Zap, title: 'RAG Knowledge Base', desc: 'Vectorized meeting history allowing you to chat with past contexts.', color: 'text-amber-400', glow: 'bg-amber-500/10' },
  { icon: Activity, title: 'Sentiment Graph', desc: 'Real-time visual feedback on meeting tone and engagement.', color: 'text-rose-400', glow: 'bg-rose-500/10' },
  { icon: Command, title: 'Auto Action Items', desc: 'Automatically generates Jira or Notion tickets from vocal agreements.', color: 'text-blue-400', glow: 'bg-blue-500/10' },
];

const testimonials = [
  { name: "Sarah Chen", role: "CTO, TechFlow", text: "SpeakInsights changed how we handle standups. The local LLM summary is surprisingly accurate.", avatar: "SC" },
  { name: "Marc Aubert", role: "Product Lead", text: "Privacy was our #1 concern. Running everything on our own servers is a game changer.", avatar: "MA" },
  { name: "Julia Reed", role: "UX Designer", text: "The interface is beautiful and the search saves me hours of re-watching recordings.", avatar: "JR" },
  { name: "Alex Rivera", role: "DevOps Eng", text: "The local WhisperX integration is blazing fast. No more latency or API costs.", avatar: "AR" },
  { name: "Lina Wu", role: "HR Director", text: "Summarizing complex policy meetings takes seconds instead of hours. Incredible tool.", avatar: "LW" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState('');
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const processRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: processRef,
    offset: ["start start", "end end"]
  });

  const stepIndex = useTransform(scrollYProgress, [0, 0.25, 0.5, 0.75, 1], [0, 0, 1, 2, 3]);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const unsubscribe = stepIndex.onChange(v => setActiveStep(Math.floor(v)));
    return () => unsubscribe();
  }, [stepIndex]);

  const processData = [
    { step: "01", title: "Capture", body: "LiveKit handles real-time video/audio streams directly within your browser with zero latency." },
    { step: "02", title: "Transcribe", body: "WhisperX processes audio locally, identifying speakers with diarization and pinpoint accuracy." },
    { step: "03", title: "Synthesize", body: "Ollama LLM extracts action items, sentiment, and summarizes the meeting discourse." },
    { step: "04", title: "Insight Chat", body: "Ask your past meetings questions using RAG (Retrieval Augmented Generation) context." },
  ];

  const handleJoin = () => {
    if (meetingCode.trim()) {
      navigate(`/join/${meetingCode.trim()}`);
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="min-h-screen bg-[#020408] text-white selection:bg-cyan-500/30 font-sans">
      
      {/* Mesh Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-cyan-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-purple-500/5 blur-[120px] rounded-full" />
      </div>

      <Navbar />

      <main className="relative z-10">
        
        {/* HERO SECTION */}
        <section className="relative pt-60 pb-32 px-6">
          <div className="max-w-7xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-white/5 border border-white/10 text-cyan-400 text-[11px] font-black tracking-[0.3em] uppercase mb-10 mx-auto shadow-inner">
              <Lock size={14} /> AIR-GAPPED PRIVACY FOR ENTERPRISE
            </motion.div>
            
            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-7xl md:text-[9.5rem] font-black tracking-tighter leading-[0.82] mb-12 uppercase">
              Own your <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/20">Dialog.</span>
              <span className="text-cyan-400">.</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="max-w-3xl mx-auto text-white/40 text-xl md:text-2xl leading-relaxed mb-16 font-medium">
              Self-hosted meeting infrastructure with real-time AI. The performance of Big Tech, with the privacy of your own metal.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full max-w-2xl">
                <GlassButton variant="primary" size="lg" icon={Plus} onClick={() => navigate('/create')} className="w-full sm:w-auto">Start Instant Meeting</GlassButton>
                
                <div className="flex w-full sm:w-auto items-center gap-2">
                  <input
                    type="text"
                    placeholder="Meeting Code"
                    value={meetingCode}
                    onChange={(e) => setMeetingCode(e.target.value)}
                    className="flex-1 sm:w-48 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/20 outline-none focus:border-cyan-500/50 transition-all font-bold tracking-tight"
                  />
                  <GlassButton
                    variant="cyan"
                    size="lg"
                    icon={ArrowRight}
                    onClick={handleJoin}
                    disabled={!meetingCode.trim()}
                    className="!px-6"
                  >
                    Join
                  </GlassButton>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* YOUTUBE DEMO */}
        <section id="demo" className="py-24 px-6 relative">
          <div className="max-w-6xl mx-auto">
             <SectionTitle subtitle="Vision" title="Watch SpeakInsights in Action" />
             <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                <GlassCard variant="solid" className="relative aspect-video border-white/20 shadow-2xl overflow-hidden !rounded-[2.5rem]">
                  <video 
                    ref={videoRef}
                    src="/speakinsights.mp4" 
                    className="w-full h-full" 
                    autoPlay 
                    muted 
                    loop
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="flex gap-4">
                      <GlassButton 
                        variant="outline" 
                        size="md" 
                        onClick={togglePlayPause}
                        className="!px-6 !py-3"
                      >
                        {isPlaying ? (
                          <>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <rect x="6" y="4" width="4" height="16" rx="1" />
                            </svg>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <polygon points="5 3 19 12 5 21" />
                            </svg>
                          </>
                        )}
                      </GlassButton>
                    </div>
                  </div>
                </GlassCard>
             </div>
          </div>
        </section>

        {/* INFINITE SCROLL MARQUEE */}
        <div className="relative flex overflow-x-hidden border-y border-white/5 py-10 bg-white/[0.01]">
          <div className="flex animate-marquee whitespace-nowrap gap-12 items-center">
            {[...techStack, ...techStack].map((tech, i) => (
              <span key={i} className="text-white/20 text-2xl font-black uppercase tracking-widest cursor-default">
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* STICKY PROCESS ANIMATION SECTION */}
        <section id="process" ref={processRef} className="relative px-6">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-12 lg:gap-24">
            
            <div className="lg:w-1/2 pt-32 pb-[30vh]">
              <SectionTitle center={false} subtitle="How it works" title="Seamless from Start to Finish" />
              <div className="space-y-0">
                {processData.map((step, i) => (
                  <ProcessStep key={i} step={step.step} title={step.title} body={step.body} active={activeStep === i} />
                ))}
              </div>
            </div>

            <div className="hidden lg:block lg:w-1/2 sticky top-0 h-screen py-32">
               <div className="h-full relative">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep}
                      initial={{ opacity: 0, y: 40, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -40, scale: 0.95 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="absolute inset-0"
                    >
                      <GlassCard variant="highlight" className="h-full border-white/10 flex flex-col p-1">
                        <div className="h-8 border-b border-white/10 flex items-center px-4 gap-2">
                           <div className="w-2 h-2 rounded-full bg-red-500/40" />
                           <div className="w-2 h-2 rounded-full bg-amber-500/40" />
                           <div className="w-2 h-2 rounded-full bg-emerald-500/40" />
                           <div className="ml-auto text-[8px] font-black uppercase tracking-widest text-white/20">Insights Terminal v2.4</div>
                        </div>
                        <div className="flex-1 bg-[#05070a] m-1 rounded-2xl p-8 overflow-hidden relative">
                           {/* State 0 */}
                           {activeStep === 0 && (
                              <div className="h-full flex flex-col items-center justify-center text-center">
                                 <div className="w-24 h-24 rounded-full bg-cyan-500/10 border-2 border-cyan-500 flex items-center justify-center mb-6 animate-pulse">
                                    <Video size={40} className="text-cyan-400" />
                                 </div>
                                 <h5 className="text-xl font-black mb-2 uppercase italic tracking-widest text-white/90">Meeting Interface</h5>
                              </div>
                           )}
                           {/* State 1 */}
                           {activeStep === 1 && (
                              <div className="space-y-6">
                                 <div className="flex items-center gap-3"><div className="p-2 bg-purple-500/20 rounded-lg"><Mic size={16} className="text-purple-400" /></div><div className="h-2 w-32 bg-white/10 rounded-full" /></div>
                                 <div className="space-y-4">
                                    {[1, 2, 3].map(i => (
                                       <motion.div key={i} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.1 }} className="flex gap-4">
                                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold">P{i}</div>
                                          <div className="flex-1 space-y-2"><div className="h-2 w-full bg-white/5 rounded-full" /><div className="h-2 w-3/4 bg-white/[0.02] rounded-full" /></div>
                                       </motion.div>
                                    ))}
                                 </div>
                              </div>
                           )}
                           {/* State 2 */}
                           {activeStep === 2 && (
                              <div className="h-full flex flex-col gap-6">
                                 <div className="flex justify-between"><div className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">AI Engine</div><Brain size={20} className="text-emerald-400" /></div>
                                 <div className="flex-1 bg-emerald-500/5 rounded-xl border border-emerald-500/10 p-6">
                                    <CheckCircle2 size={16} className="text-emerald-400 mb-2" />
                                    <div className="space-y-3"><div className="h-1 w-full bg-emerald-500/20" /><div className="h-1 w-full bg-emerald-500/20" /><div className="h-1 w-1/2 bg-emerald-500/20" /></div>
                                 </div>
                              </div>
                           )}
                           {/* State 3 */}
                           {activeStep === 3 && (
                              <div className="h-full flex flex-col">
                                 <div className="flex-1 space-y-4">
                                    <div className="bg-white/5 rounded-xl p-4 max-w-[80%]"><div className="h-2 w-full bg-white/10 rounded-full" /></div>
                                    <div className="bg-cyan-500/10 rounded-xl p-4 max-w-[80%] ml-auto border border-cyan-500/20"><div className="h-2 w-full bg-cyan-400/20 rounded-full" /></div>
                                 </div>
                                 <div className="mt-auto flex gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                                    <MessageSquare size={16} className="text-white/40" />
                                    <div className="h-2 w-full bg-white/10 rounded-full my-auto" />
                                 </div>
                              </div>
                           )}
                           {/* Background Glow Deco */}
                           <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-cyan-500/20 blur-3xl rounded-full" />
                        </div>
                      </GlassCard>
                    </motion.div>
                  </AnimatePresence>
               </div>
            </div>
          </div>
        </section>

        {/* FEATURES GRID */}
        <section id="product" className="py-32 px-6 bg-black">
          <div className="max-w-7xl mx-auto">
            <SectionTitle subtitle="Core Ecosystem" title="Beyond Transcription" description="A full-featured suite for modern intelligence gathering." />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((f, i) => (
                <motion.div key={i} whileHover={{ y: -10 }}>
                  <GlassCard shimmer className="p-10 h-full border-white/5 hover:border-cyan-500/30 transition-colors">
                    <div className={`w-14 h-14 rounded-2xl ${f.glow} flex items-center justify-center mb-8`}>
                      <f.icon className={f.color} size={28} />
                    </div>
                    <h3 className="text-2xl font-black mb-4 uppercase tracking-tighter">{f.title}</h3>
                    <p className="text-white/40 leading-relaxed font-medium">{f.desc}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* EFFICIENCY CALCULATOR */}
        <section className="py-32 px-6">
           <div className="max-w-5xl mx-auto"><ROICalculator /></div>
        </section>

        {/* WALL OF LOVE / TESTIMONIALS */}
        <section className="py-32 overflow-hidden bg-white/[0.01]">
          <div className="max-w-7xl mx-auto px-6 mb-16">
            <SectionTitle subtitle="Wall of Love" title="Trusted by Global Teams" />
          </div>
          <div className="relative flex overflow-x-hidden py-4">
             <div className="flex animate-marquee whitespace-nowrap gap-6 items-center">
               {[...testimonials, ...testimonials].map((t, i) => (
                 <div key={i} className="w-[350px] shrink-0">
                   <GlassCard className="p-6 border-white/5 h-full">
                     <div className="flex items-center gap-4 mb-4">
                       <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center font-bold text-cyan-400 text-sm">{t.avatar}</div>
                       <div><div className="font-bold text-sm">{t.name}</div><div className="text-[10px] text-white/40 uppercase tracking-widest">{t.role}</div></div>
                     </div>
                     <p className="text-white/60 text-sm leading-relaxed italic whitespace-normal">"{t.text}"</p>
                   </GlassCard>
                 </div>
               ))}
             </div>
          </div>
        </section>

        {/* CALL TO ACTION */}
        <section id="deploy" className="py-40 px-6 overflow-hidden">
          <div className="max-w-7xl mx-auto relative">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-cyan-500/5 blur-[150px] -z-10 rounded-full" />
             <GlassCard variant="gradient" className="p-16 md:p-24 text-center !rounded-[4rem] border-white/20">
                <h2 className="text-5xl md:text-[9rem] font-black mb-10 tracking-[-0.05em] uppercase leading-[0.8]">
                  DO THE <span className="text-cyan-400 underline decoration-cyan-500/30 underline-offset-8">MEETING</span> <br /> HERE.
                </h2>
                <p className="text-white/40 text-xl max-w-2xl mx-auto mb-16 font-medium">Deploy SpeakInsights on your local cluster today. Take back control of your conversations and metadata.</p>
                <div className="flex flex-col sm:flex-row gap-8 justify-center">
                   <GlassButton variant="cyan" size="lg" icon={ArrowRight} onClick={() => navigate('/create')} className="!px-12 !py-6 text-xl">Get Started Free</GlassButton>
                   <GlassButton variant="outline" size="lg" className="!px-12 !py-6 text-xl">Enterprise Contact</GlassButton>
                </div>
             </GlassCard>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/5 pt-32 pb-16 px-6 bg-black">
          <div className="max-w-7xl mx-auto">
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-16 mb-32">
                <div className="col-span-2">
                   <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-cyan-400 flex items-center justify-center"><Mic size={20} className="text-black" /></div>
                    <span className="text-2xl font-black tracking-tighter uppercase">SpeakInsights</span>
                   </div>
                   <p className="text-white/20 text-sm max-w-xs leading-relaxed mb-10 font-bold tracking-tight">
                     Building the infrastructure for private intelligence. 100% open-source core, enterprise-hardened shells.
                   </p>
                   <div className="flex gap-6">
                      {[Twitter, Github, Linkedin, Facebook].map((Icon, i) => (
                        <button key={i} className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all text-white/40 hover:text-white"><Icon size={20} /></button>
                      ))}
                   </div>
                </div>
                {[
                  { title: "Product", links: ["Rooms", "AI Engine", "Whisper Core", "Changelog"] },
                  { title: "Network", links: ["Documentation", "API Ref", "SDKs", "Status"] },
                  { title: "Company", links: ["Vision", "Manifesto", "Contact", "Jobs"] },
                  { title: "Legal", links: ["Privacy", "Telemetry", "Open Source", "Licensing"] },
                ].map((col, i) => (
                  <div key={i}>
                     <h5 className="font-black text-[11px] uppercase tracking-[0.4em] text-white/30 mb-8">{col.title}</h5>
                     <ul className="space-y-5">
                        {col.links.map(link => (
                          <li key={link}><a href="#" className="text-[13px] font-bold text-white/40 hover:text-cyan-400 transition-colors uppercase tracking-wider">{link}</a></li>
                        ))}
                     </ul>
                  </div>
                ))}
             </div>
             <div className="flex flex-col md:flex-row justify-between items-center pt-16 border-t border-white/5 gap-10">
                <div className="text-[10px] font-black tracking-[0.5em] text-white/10 uppercase italic">Designed for zero-trust environments & heavy workloads</div>
                <div className="flex gap-10 text-[10px] font-black tracking-[0.2em] text-white/20 uppercase">
                   <span>© 2024 SPEAKINSIGHTS LABS</span>
                   <span className="text-white/5 hover:text-white/40 transition-colors cursor-pointer">LATENCY: 14MS</span>
                </div>
             </div>
          </div>
        </footer>

      </main>

      {/* Global Embedded Styles / Keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes marquee-reverse { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
        .animate-marquee { animation: marquee 40s linear infinite; }
        .animate-marquee-reverse { animation: marquee-reverse 40s linear infinite; }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 16px; width: 16px;
          border-radius: 50%;
          background: #22d3ee;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
        }
      `}} />
    </div>
  );
}
// import React, { useState, useEffect, useRef } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { motion, AnimatePresence, useScroll, useTransform, useInView } from 'framer-motion';
// import { 
//   Menu, X, Mic, History, MessageSquare, 
//   Cpu, Settings, Plus, ArrowRight, Users, 
//   Brain, Calendar, Shield, Zap, Sparkles,
//   Bell, Search, User, ChevronRight, Play,
//   CheckCircle2, Globe, Lock, Activity, Command,
//   Quote, Facebook, Twitter, Github, Linkedin,
//   FileText, Video, MessageCircle
// } from 'lucide-react';
// import GlassCard from '@/components/ui/GlassCard';
// import GlassButton from '@/components/ui/GlassButton';
// import GlassInput from '@/components/ui/GlassInput';

// const features = [
//   {
//     icon: Users,
//     title: 'Up to 20 Participants',
//     description: 'Real-time video conferencing with LiveKit WebRTC',
//     color: 'text-cyan',
//   },
//   {
//     icon: Mic,
//     title: 'Live Transcription',
//     description: 'WhisperX-powered accurate transcripts with speaker labels',
//     color: 'text-lavender',
//   },
//   {
//     icon: Brain,
//     title: 'AI Summaries & Tasks',
//     description: 'Post-meeting analysis with Ollama LLM — summaries, tasks, sentiment',
//     color: 'text-cyan',
//   },
//   {
//     icon: Calendar,
//     title: 'Calendar Export',
//     description: 'Export action items as .ics calendar events',
//     color: 'text-lavender',
//   },
//   {
//     icon: Shield,
//     title: 'Self-Hosted & Private',
//     description: 'Everything runs on your hardware. No data leaves your network.',
//     color: 'text-emerald-400',
//   },
//   {
//     icon: Zap,
//     title: 'RAG-Powered Chat',
//     description: 'Ask questions about your meetings with context-aware AI',
//     color: 'text-amber-400',
//   },
// ];

// export default function Landing() {
//   const navigate = useNavigate();
//   const [meetingCode, setMeetingCode] = useState('');

//   const handleJoin = () => {
//     if (meetingCode.trim()) {
//       navigate(`/join/${meetingCode.trim()}`);
//     }
//   };

//   return (
//     <div className="min-h-screen pt-20 pb-16">
//       {/* Hero */}
//       <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20">
//         <div className="text-center">
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ duration: 0.6 }}
//           >
//             <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
//               <span className="text-gradient">Intelligent</span>{' '}
//               <span className="text-white/90">Meetings,</span>
//               <br />
//               <span className="text-white/90">Actionable </span>
//               <span className="text-gradient">Insights</span>
//             </h1>
//             <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed">
//               Self-hosted meeting platform with real-time transcription, AI-powered summaries,
//               sentiment analysis, and intelligent search — all running on your own hardware.
//             </p>
//           </motion.div>

//           {/* Actions */}
//           <motion.div
//             className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ duration: 0.6, delay: 0.2 }}
//           >
//             <GlassButton
//               variant="primary"
//               size="lg"
//               icon={Plus}
//               onClick={() => navigate('/create')}
//             >
//               Create Meeting
//             </GlassButton>

//             <div className="flex items-center gap-2">
//               <GlassInput
//                 placeholder="Enter meeting code"
//                 value={meetingCode}
//                 onChange={(e) => setMeetingCode(e.target.value)}
//                 className="!w-48"
//               />
//               <GlassButton
//                 variant="ghost"
//                 size="lg"
//                 icon={ArrowRight}
//                 onClick={handleJoin}
//                 disabled={!meetingCode.trim()}
//               >
//                 Join
//               </GlassButton>
//             </div>
//           </motion.div>
//         </div>
//       </section>

//       {/* Features Grid */}
//       <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
//         <motion.div
//           className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           transition={{ duration: 0.6, delay: 0.4 }}
//         >
//           {features.map((feature, i) => (
//             <motion.div
//               key={feature.title}
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
//             >
//               <GlassCard className="h-full" shimmer>
//                 <div className="flex items-start gap-4">
//                   <div className="p-2.5 rounded-glass bg-white/5">
//                     <feature.icon className={feature.color} size={22} />
//                   </div>
//                   <div>
//                     <h3 className="font-semibold text-white/90 mb-1">{feature.title}</h3>
//                     <p className="text-sm text-white/50 leading-relaxed">
//                       {feature.description}
//                     </p>
//                   </div>
//                 </div>
//               </GlassCard>
//             </motion.div>
//           ))}
//         </motion.div>
//       </section>

//       {/* Stats */}
//       <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
//         <motion.div
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           transition={{ delay: 1 }}
//         >
//           <GlassCard variant="gradient" padding="lg">
//             <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
//               {[
//                 { value: '20', label: 'Max Participants' },
//                 { value: '∞', label: 'Meetings' },
//                 { value: '100%', label: 'Self-Hosted' },
//                 { value: 'Free', label: 'Forever' },
//               ].map(({ value, label }) => (
//                 <div key={label}>
//                   <div className="text-3xl font-bold text-gradient mb-1">{value}</div>
//                   <div className="text-sm text-white/50">{label}</div>
//                 </div>
//               ))}
//             </div>
//           </GlassCard>
//         </motion.div>
//       </section>
//     </div>
//   );
// }
