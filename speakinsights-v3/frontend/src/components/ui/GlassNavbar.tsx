import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X, Mic, History, MessageSquare, Cpu, Settings } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

const navLinks = [
  { to: '/', label: 'Dashboard', icon: Mic },
  { to: '/history', label: 'History', icon: History },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/models', label: 'Models', icon: Cpu },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function GlassNavbar() {
  const location = useLocation();
  const { mobileMenuOpen, setMobileMenuOpen } = useUIStore();

  return (
    <nav className="fixed top-0 left-0 right-0 z-40">
      <div className="bg-white/[0.06] backdrop-blur-[24px] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-cyan/20 flex items-center justify-center">
                <Mic className="text-cyan" size={18} />
              </div>
              <span className="text-lg font-bold tracking-tight">
                <span className="text-cyan">Speak</span>
                <span className="text-white/90">Insights</span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(({ to, label, icon: Icon }) => {
                const isActive =
                  to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`
                      relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                      transition-colors duration-200
                      ${isActive ? 'text-cyan' : 'text-white/60 hover:text-white/80 hover:bg-white/5'}
                    `}
                  >
                    <Icon size={16} />
                    {label}
                    {isActive && (
                      <motion.div
                        className="absolute bottom-0 left-3 right-3 h-0.5 bg-cyan rounded-full"
                        layoutId="nav-indicator"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-white/10 text-white/60"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileMenuOpen && (
        <motion.div
          className="md:hidden bg-navy-light/95 backdrop-blur-heavy border-b border-white/10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="px-4 py-3 space-y-1">
            {navLinks.map(({ to, label, icon: Icon }) => {
              const isActive =
                to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-colors
                    ${isActive ? 'text-cyan bg-cyan/10' : 'text-white/60 hover:text-white/80 hover:bg-white/5'}
                  `}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}
    </nav>
  );
}
