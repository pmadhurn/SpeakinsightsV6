import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, History, MessageSquare, Cpu, Settings, Menu, X } from 'lucide-react';
import GlassButton from '../../components/ui/GlassButton'; // Kept your imported component
import { useUIStore } from '@/stores/uiStore'; // Added your store connection

const navLinks = [
  { to: '/', label: 'Dashboard', icon: Mic },
  { to: '/history', label: 'History', icon: History },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/models', label: 'Models', icon: Cpu },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Navbar() {
  const location = useLocation();
  const { mobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${scrolled ? 'py-2' : 'py-3'}`}>
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Main Floating Nav Pill */}
        <div className={`relative flex items-center justify-between h-14 px-8 rounded-full border transition-all duration-500 z-50 ${
          scrolled ? 'bg-white/[0.03] backdrop-blur-2xl border-white/10 shadow-2xl scale-[0.98]' : 'bg-white/[0.03] backdrop-blur-md border-white/5'
        }`}>
          
          {/* Logo Section */}
          <Link to="/" className="flex items-center gap-3 cursor-pointer group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
              <Mic size={18} className="text-white" />
            </div>
            <span className="text-lg font-black tracking-tighter uppercase text-white">
              Speak<span className="text-cyan-400">Insights</span>
            </span>
          </Link>

          {/* Desktop Nav Links with Animated Active States */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label, icon: IconComponent }) => {
              const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

              return (
                <Link
                  key={to}
                  to={to}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-colors duration-200 z-10 ${
                    isActive ? 'text-cyan-400' : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <IconComponent size={14} className="relative z-10" />
                  <span className="relative z-10">{label}</span>
                  
                  {/* Glowing Animated Bubble Indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 bg-white/5 rounded-xl border border-white/10"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Desktop Right Side / Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-2 text-white/60 hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Beautiful Glass Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute top-20 left-6 right-6 md:hidden overflow-hidden rounded-2xl bg-[#0a0c10]/95 backdrop-blur-2xl border border-white/10 shadow-2xl p-4 flex flex-col gap-1 z-40"
            >
              {navLinks.map(({ to, label, icon: IconComponent }) => {
                const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
                
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-colors ${
                      isActive 
                        ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20' 
                        : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <IconComponent size={16} />
                    {label}
                  </Link>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </nav>
  );
}
// import React, { useState, useEffect, useRef } from 'react';
// import { Link, useLocation } from 'react-router-dom';
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
// import { useUIStore } from '@/stores/uiStore';

// const navLinks = [
//   { to: '/', label: 'Dashboard', icon: Mic },
//   { to: '/history', label: 'History', icon: History },
//   { to: '/chat', label: 'Chat', icon: MessageSquare },
//   { to: '/models', label: 'Models', icon: Cpu },
//   { to: '/settings', label: 'Settings', icon: Settings },
// ];

// export default function GlassNavbar() {
//   const location = useLocation();
//   const { mobileMenuOpen, setMobileMenuOpen } = useUIStore();

//   return (
//     <nav className="fixed top-0 left-0 right-0 z-40">
//       <div className="bg-white/[0.06] backdrop-blur-[24px] border-b border-white/10">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//           <div className="flex items-center justify-between h-16">
//             {/* Logo */}
//             <Link to="/" className="flex items-center gap-2 group">
//               <div className="w-8 h-8 rounded-lg bg-cyan/20 flex items-center justify-center">
//                 <Mic className="text-cyan" size={18} />
//               </div>
//               <span className="text-lg font-bold tracking-tight">
//                 <span className="text-cyan">Speak</span>
//                 <span className="text-white/90">Insights</span>
//               </span>
//             </Link>

//             {/* Desktop Nav */}
//             <div className="hidden md:flex items-center gap-1">
//               {navLinks.map(({ to, label, icon: Icon }) => {
//                 const isActive =
//                   to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
//                 return (
//                   <Link
//                     key={to}
//                     to={to}
//                     className={`
//                       relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
//                       transition-colors duration-200
//                       ${isActive ? 'text-cyan' : 'text-white/60 hover:text-white/80 hover:bg-white/5'}
//                     `}
//                   >
//                     <Icon size={16} />
//                     {label}
//                     {isActive && (
//                       <motion.div
//                         className="absolute bottom-0 left-3 right-3 h-0.5 bg-cyan rounded-full"
//                         layoutId="nav-indicator"
//                         transition={{ type: 'spring', stiffness: 350, damping: 30 }}
//                       />
//                     )}
//                   </Link>
//                 );
//               })}
//             </div>

//             {/* Mobile menu button */}
//             <button
//               className="md:hidden p-2 rounded-lg hover:bg-white/10 text-white/60"
//               onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
//             >
//               {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Mobile Nav */}
//       {mobileMenuOpen && (
//         <motion.div
//           className="md:hidden bg-navy-light/95 backdrop-blur-heavy border-b border-white/10"
//           initial={{ opacity: 0, y: -10 }}
//           animate={{ opacity: 1, y: 0 }}
//         >
//           <div className="px-4 py-3 space-y-1">
//             {navLinks.map(({ to, label, icon: Icon }) => {
//               const isActive =
//                 to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
//               return (
//                 <Link
//                   key={to}
//                   to={to}
//                   onClick={() => setMobileMenuOpen(false)}
//                   className={`
//                     flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
//                     transition-colors
//                     ${isActive ? 'text-cyan bg-cyan/10' : 'text-white/60 hover:text-white/80 hover:bg-white/5'}
//                   `}
//                 >
//                   <Icon size={16} />
//                   {label}
//                 </Link>
//               );
//             })}
//           </div>
//         </motion.div>
//       )}
//     </nav>
//   );
// }
