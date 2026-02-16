import { motion } from 'framer-motion';
import { ListChecks, User, AlertCircle, CalendarDays, Check } from 'lucide-react';
import GlassButton from '@/components/ui/GlassButton';
import Badge from '@/components/ui/Badge';
import { calendar } from '@/services/api';
import { glassToast } from '@/components/ui/Toast';
import type { Task } from '@/types/summary';

interface TaskListProps {
  tasks: Task[];
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
  meetingId?: string;
}

export function TaskList({ tasks, onUpdateTask, meetingId }: TaskListProps) {
  const priorityStyles: Record<string, { bg: string; text: string }> = {
    low: { bg: 'bg-white/5', text: 'text-white/40' },
    medium: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
    high: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
    urgent: { bg: 'bg-red-500/10', text: 'text-red-400' },
  };

  const handleToggleStatus = (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    onUpdateTask?.(task.id, { status: newStatus });
  };

  const handleExportCalendar = async () => {
    if (!meetingId) return;
    try {
      const blob = await calendar.getIcs(meetingId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tasks-${meetingId}.ics`;
      a.click();
      URL.revokeObjectURL(url);
      glassToast.success('Calendar exported!');
    } catch {
      glassToast.error('Failed to export calendar');
    }
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="rounded-2xl p-5 bg-white/[0.04] backdrop-blur-xl border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-lavender/10">
            <ListChecks size={16} className="text-lavender" />
          </div>
          <h3 className="text-sm font-semibold text-white/90">Action Items</h3>
          <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        {meetingId && tasks.length > 0 && (
          <GlassButton variant="ghost" size="sm" icon={CalendarDays} onClick={handleExportCalendar}>
            Export to Calendar
          </GlassButton>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-8">
          <ListChecks size={32} className="text-white/10 mx-auto mb-2" />
          <p className="text-xs text-white/30">No tasks extracted yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task, i) => {
            const priority = priorityStyles[task.priority] || priorityStyles.medium;
            const overdue = task.status !== 'completed' && isOverdue(task.due_date);

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-start gap-3 rounded-xl px-3 py-3 bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors group"
              >
                {/* Checkbox */}
                <button
                  onClick={() => handleToggleStatus(task)}
                  className={`flex-shrink-0 w-5 h-5 rounded-md border transition-all mt-0.5 flex items-center justify-center ${
                    task.status === 'completed'
                      ? 'bg-cyan/20 border-cyan/50 text-cyan'
                      : 'border-white/20 hover:border-cyan/40 text-transparent hover:text-cyan/30'
                  }`}
                >
                  <Check size={12} />
                </button>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-medium transition-colors ${
                      task.status === 'completed' ? 'text-white/30 line-through' : 'text-white/85'
                    }`}
                  >
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-[10px] text-white/30 mt-0.5 line-clamp-2">{task.description}</p>
                  )}

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {/* Priority */}
                    <span
                      className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${priority.bg} ${priority.text}`}
                    >
                      <AlertCircle size={8} />
                      {task.priority}
                    </span>

                    {/* Assignee */}
                    {task.assignee && (
                      <span className="flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-lavender/10 text-lavender">
                        <User size={8} />
                        {task.assignee}
                      </span>
                    )}

                    {/* Due date */}
                    {task.due_date && (
                      <span
                        className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                          overdue
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-white/5 text-white/40'
                        }`}
                      >
                        <CalendarDays size={8} />
                        {new Date(task.due_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                        {overdue && ' (overdue)'}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TaskList;
