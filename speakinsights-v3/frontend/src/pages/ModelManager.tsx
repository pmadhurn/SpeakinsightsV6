import { useState } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Download, Trash2, HardDrive } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import GlassButton from '@/components/ui/GlassButton';
import GlassInput from '@/components/ui/GlassInput';
import Badge from '@/components/ui/Badge';

const mockModels = [
  { name: 'llama3.2:3b', size: '2.0 GB', modified: '2026-02-10' },
  { name: 'nomic-embed-text', size: '274 MB', modified: '2026-02-08' },
];

export default function ModelManager() {
  const [pullModel, setPullModel] = useState('');

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 rounded-glass bg-cyan/10">
              <Cpu className="text-cyan" size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white/90">Ollama Models</h1>
              <p className="text-xs text-white/40">Manage your local LLM models</p>
            </div>
          </div>

          {/* Pull new model */}
          <GlassCard className="mb-6">
            <h3 className="font-semibold text-white/90 mb-3">Pull Model</h3>
            <div className="flex gap-3">
              <div className="flex-1">
                <GlassInput
                  placeholder="e.g., llama3.2:3b"
                  value={pullModel}
                  onChange={(e) => setPullModel(e.target.value)}
                />
              </div>
              <GlassButton variant="primary" icon={Download} disabled={!pullModel.trim()}>
                Pull
              </GlassButton>
            </div>
          </GlassCard>

          {/* Installed models */}
          <div className="space-y-3">
            {mockModels.map((model, i) => (
              <motion.div
                key={model.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <GlassCard className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Cpu size={18} className="text-cyan/60" />
                    <div>
                      <h4 className="font-medium text-white/90">{model.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-white/40">
                        <HardDrive size={11} />
                        {model.size}
                        <span>·</span>
                        {model.modified}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge text="installed" variant="green" />
                    <GlassButton variant="ghost" size="sm" icon={Trash2}>
                      Delete
                    </GlassButton>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
