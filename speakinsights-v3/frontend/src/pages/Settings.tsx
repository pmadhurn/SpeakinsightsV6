import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Globe, Cpu, Video } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import { useUIStore } from '@/stores/uiStore';

export default function Settings() {
  const { defaultLanguage, setDefaultLanguage, defaultModel, setDefaultModel } = useUIStore();

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 rounded-glass bg-lavender/10">
              <SettingsIcon className="text-lavender" size={22} />
            </div>
            <h1 className="text-2xl font-bold text-white/90">Settings</h1>
          </div>

          <div className="space-y-5">
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Globe size={16} className="text-cyan" />
                <h3 className="font-semibold text-white/90">Default Language</h3>
              </div>
              <select
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white/90 focus:outline-none focus:border-cyan transition-colors"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="ja">Japanese</option>
                <option value="zh">Chinese</option>
                <option value="hi">Hindi</option>
              </select>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Cpu size={16} className="text-lavender" />
                <h3 className="font-semibold text-white/90">Default LLM Model</h3>
              </div>
              <select
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white/90 focus:outline-none focus:border-cyan transition-colors"
              >
                <option value="llama3.2:3b">llama3.2:3b (Mac)</option>
                <option value="llama3.1:8b">llama3.1:8b (Windows GPU)</option>
              </select>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Video size={16} className="text-emerald-400" />
                <h3 className="font-semibold text-white/90">Recording Quality</h3>
              </div>
              <select
                defaultValue="720p"
                className="w-full bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white/90 focus:outline-none focus:border-cyan transition-colors"
              >
                <option value="480p">480p (Low bandwidth)</option>
                <option value="720p">720p (Recommended)</option>
                <option value="1080p">1080p (High quality)</option>
              </select>
            </GlassCard>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
