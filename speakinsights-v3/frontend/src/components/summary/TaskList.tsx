import { motion } from 'framer-motion';
import { ListChecks, User, AlertCircle } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  assignee?: string;
  priority?: 'low' | 'medium' | 'high';
}

interface TaskListProps {
  tasks: Task[];
}

export function TaskList({ tasks }: TaskListProps) {
  const statusStyles: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    in_progress: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    completed: 'bg-green-500/10 text-green-400 border-green-500/20',
  };

  const priorityStyles: Record<string, string> = {
    low: 'bg-slate-500/10 text-slate-400',
    medium: 'bg-orange-500/10 text-orange-400',
    high: 'bg-red-500/10 text-red-400',
  };

  return (
    <div className="rounded-2xl p-4 bg-white/5 backdrop-blur-md border border-white/10">
      <div className="flex items-center gap-2 mb-4">
        <ListChecks size={16} className="text-purple-400" />
        <h3 className="text-sm font-semibold text-white">Action Items</h3>
        <span className="ml-auto text-xs text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-4">
          No tasks extracted yet
        </p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-start gap-3 rounded-xl px-3 py-2.5 bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white">{task.title}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                      statusStyles[task.status] || statusStyles.pending
                    }`}
                  >
                    {task.status.replace('_', ' ')}
                  </span>
                  {task.priority && (
                    <span
                      className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                        priorityStyles[task.priority] || priorityStyles.medium
                      }`}
                    >
                      <AlertCircle size={8} /> {task.priority}
                    </span>
                  )}
                  {task.assignee && (
                    <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                      <User size={8} /> {task.assignee}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TaskList;
