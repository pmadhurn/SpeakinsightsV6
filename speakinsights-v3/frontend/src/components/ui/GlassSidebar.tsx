import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface GlassSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  position?: 'left' | 'right';
}

export default function GlassSidebar({
  isOpen,
  onClose,
  title,
  children,
  position = 'right',
}: GlassSidebarProps) {
  const isRight = position === 'right';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay (mobile) */}
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.div
            className={`
              fixed top-0 ${isRight ? 'right-0' : 'left-0'} bottom-0
              w-80 max-w-[85vw] z-50
              glass-heavy border-${isRight ? 'l' : 'r'} border-white/10
              flex flex-col
            `}
            initial={{ x: isRight ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: isRight ? '100%' : '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              {title && (
                <h3 className="font-semibold text-white/90">{title}</h3>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
