import { motion } from 'framer-motion';
import { CheckCircle, Loader2, Clock, AlertCircle } from 'lucide-react';

type Status = 'pending' | 'processing' | 'completed' | 'error';

interface ProcessingStatusProps {
  status: Status;
  label: string;
  className?: string;
}

const statusConfig: Record<Status, { icon: typeof Clock; color: string; text: string }> = {
  pending: { icon: Clock, color: 'text-white/40', text: 'Pending' },
  processing: { icon: Loader2, color: 'text-cyan', text: 'Processing' },
  completed: { icon: CheckCircle, color: 'text-emerald-400', text: 'Done' },
  error: { icon: AlertCircle, color: 'text-red-400', text: 'Error' },
};

export default function ProcessingStatus({ status, label, className = '' }: ProcessingStatusProps) {
  const { icon: Icon, color, text } = statusConfig[status];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <motion.div
        animate={status === 'processing' ? { rotate: 360 } : {}}
        transition={status === 'processing' ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}
      >
        <Icon size={16} className={color} />
      </motion.div>
      <span className="text-sm text-white/70">{label}</span>
      <span className={`text-xs ${color}`}>{text}</span>
    </div>
  );
}
