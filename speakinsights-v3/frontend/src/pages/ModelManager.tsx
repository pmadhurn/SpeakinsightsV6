import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  Download,
  Trash2,
  HardDrive,
  CheckCircle,
  Lock,
  Zap,
  AlertCircle,
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import GlassButton from '@/components/ui/GlassButton';
import GlassInput from '@/components/ui/GlassInput';
import GlassModal from '@/components/ui/GlassModal';
import Badge from '@/components/ui/Badge';
import { models as modelsApi } from '@/services/api';
import { useUIStore } from '@/stores/uiStore';
import { glassToast } from '@/components/ui/Toast';
import { formatDate } from '@/utils/formatTime';

interface OllamaModel {
  name: string;
  size?: number;
  digest?: string;
  modified_at?: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface PullProgress {
  status: string;
  percent: number | null;
  completed: number;
  total: number;
  message?: string;
}

const QUICK_MODELS = [
  'llama3.2:3b',
  'mistral:7b',
  'qwen2.5:3b',
  'phi3:3.8b',
  'gemma2:2b',
  'nomic-embed-text',
];

function formatSize(bytes?: number): string {
  if (!bytes) return '—';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

export default function ModelManager() {
  const [pullModel, setPullModel] = useState('');
  const [installedModels, setInstalledModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { defaultModel, setDefaultModel } = useUIStore();

  // ── Load models ──
  const loadModels = useCallback(async () => {
    try {
      const data = await modelsApi.list();
      setInstalledModels(data.models || []);
    } catch {
      setInstalledModels([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // ── Pull model via SSE ──
  const handlePull = async (name?: string) => {
    const modelName = (name || pullModel).trim();
    if (!modelName || isPulling) return;

    setIsPulling(true);
    setPullProgress({ status: 'Pulling manifest...', percent: null, completed: 0, total: 0 });

    try {
      const response = await fetch('/api/models/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.status === 'success') {
              setPullProgress({
                status: 'Success!',
                percent: 100,
                completed: 0,
                total: 0,
                message: event.message,
              });
              glassToast.success(`Model ${modelName} pulled successfully`);
            } else if (event.status === 'error') {
              throw new Error(event.message || 'Pull failed');
            } else {
              setPullProgress({
                status: event.status || 'Downloading...',
                percent: event.percent ?? null,
                completed: event.completed || 0,
                total: event.total || 0,
              });
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      setPullModel('');
      await loadModels();
    } catch (err: any) {
      glassToast.error(`Failed to pull model: ${err.message}`);
    }

    setTimeout(() => {
      setIsPulling(false);
      setPullProgress(null);
    }, 2000);
  };

  // ── Delete model ──
  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);

    try {
      await modelsApi.delete(deleteModal);
      glassToast.success(`Model ${deleteModal} deleted`);
      if (defaultModel === deleteModal) {
        setDefaultModel('');
      }
      await loadModels();
    } catch (err: any) {
      glassToast.error(`Failed to delete: ${err.message}`);
    }

    setDeleting(false);
    setDeleteModal(null);
  };

  // ── Set as default ──
  const handleSetDefault = (name: string) => {
    setDefaultModel(name);
    localStorage.setItem('speakinsights_default_model', name);
    glassToast.success(`${name} set as default model`);
  };

  const isEmbeddingModel = (name: string) =>
    name.includes('embed') || name.includes('nomic');

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 rounded-glass bg-cyan/10">
              <Cpu className="text-cyan" size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white/90">Model Manager</h1>
              <p className="text-xs text-white/40">Manage your local AI models</p>
            </div>
          </div>

          {/* Pull new model */}
          <GlassCard variant="gradient" className="mb-6">
            <h3 className="font-semibold text-white/90 mb-3 flex items-center gap-2">
              <Download size={16} className="text-cyan" />
              Pull New Model
            </h3>
            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <GlassInput
                  placeholder="Enter model name (e.g., llama3.2:3b, qwen3:2b, mistral:7b)"
                  value={pullModel}
                  onChange={(e) => setPullModel(e.target.value)}
                  disabled={isPulling}
                />
              </div>
              <GlassButton
                variant="primary"
                icon={Download}
                disabled={!pullModel.trim() || isPulling}
                loading={isPulling && !pullProgress?.percent}
                onClick={() => handlePull()}
              >
                Pull
              </GlassButton>
            </div>

            {/* Pull progress */}
            <AnimatePresence>
              {isPulling && pullProgress && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3"
                >
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/70">{pullProgress.status}</span>
                      {pullProgress.percent !== null && (
                        <span className="text-sm font-medium text-cyan">
                          {pullProgress.percent.toFixed(1)}%
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-cyan via-cyan to-lavender"
                        style={{
                          boxShadow: '0 0 12px rgba(34, 211, 238, 0.5)',
                        }}
                        initial={{ width: '0%' }}
                        animate={{
                          width: pullProgress.percent !== null
                            ? `${pullProgress.percent}%`
                            : '30%',
                        }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>

                    {/* Size info */}
                    {pullProgress.total > 0 && (
                      <p className="text-xs text-white/30 mt-2">
                        {formatSize(pullProgress.completed)} / {formatSize(pullProgress.total)}
                      </p>
                    )}

                    {pullProgress.status === 'Success!' && (
                      <div className="flex items-center gap-2 mt-2 text-emerald-400 text-sm">
                        <CheckCircle size={14} />
                        Model downloaded successfully
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick pull suggestions */}
            <div className="mt-3">
              <p className="text-xs text-white/30 mb-2">Quick pull:</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_MODELS.map((name) => {
                  const isInstalled = installedModels.some((m) => m.name === name);
                  return (
                    <button
                      key={name}
                      onClick={() => {
                        if (!isInstalled && !isPulling) {
                          setPullModel(name);
                          handlePull(name);
                        }
                      }}
                      disabled={isInstalled || isPulling}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        isInstalled
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400/60 cursor-default'
                          : 'bg-white/5 border-white/10 text-white/50 hover:bg-cyan/10 hover:border-cyan/30 hover:text-cyan cursor-pointer'
                      }`}
                    >
                      {isInstalled && <CheckCircle size={10} className="inline mr-1 -mt-0.5" />}
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          </GlassCard>

          {/* Installed models */}
          <h3 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
            <HardDrive size={14} />
            Installed Models ({installedModels.length})
          </h3>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="glass h-40 rounded-2xl animate-pulse"
                />
              ))}
            </div>
          ) : installedModels.length === 0 ? (
            <GlassCard className="text-center py-12">
              <AlertCircle className="text-white/15 mx-auto mb-3" size={40} />
              <p className="text-white/30 text-sm">No models installed</p>
              <p className="text-white/20 text-xs mt-1">
                Pull a model above to get started
              </p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {installedModels.map((model, i) => {
                const isDefault = defaultModel === model.name;
                const isEmbed = isEmbeddingModel(model.name);
                const family = model.details?.family || model.name.split(':')[0];
                const quantization = model.details?.quantization_level;
                const paramSize = model.details?.parameter_size;

                return (
                  <motion.div
                    key={model.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <GlassCard
                      className={`h-full ${isDefault ? 'ring-1 ring-cyan/30' : ''}`}
                      glow={isDefault ? 'cyan' : 'none'}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-white/90 text-lg leading-tight">
                            {model.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <Badge
                              text={family}
                              variant={isEmbed ? 'lavender' : 'cyan'}
                            />
                            {quantization && (
                              <Badge text={quantization} variant="gray" />
                            )}
                            {isEmbed && (
                              <span className="flex items-center gap-1 text-[10px] text-amber-400/70">
                                <Lock size={9} />
                                embedding
                              </span>
                            )}
                          </div>
                        </div>
                        {isDefault && (
                          <span className="text-[10px] text-cyan bg-cyan/10 px-2 py-0.5 rounded-full border border-cyan/20 shrink-0">
                            Default
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs text-white/40 mb-4">
                        <div className="flex items-center gap-2">
                          <HardDrive size={11} />
                          {formatSize(model.size)}
                        </div>
                        {paramSize && (
                          <div className="flex items-center gap-2">
                            <Cpu size={11} />
                            {paramSize} parameters
                          </div>
                        )}
                        {model.modified_at && (
                          <div className="text-white/25">
                            Modified {formatDate(model.modified_at)}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!isEmbed && (
                          <GlassButton
                            variant={isDefault ? 'primary' : 'ghost'}
                            size="sm"
                            icon={isDefault ? CheckCircle : Zap}
                            onClick={() => handleSetDefault(model.name)}
                            disabled={isDefault}
                          >
                            {isDefault ? 'Active' : 'Use for Summaries'}
                          </GlassButton>
                        )}
                        {!isEmbed && (
                          <GlassButton
                            variant="danger"
                            size="sm"
                            icon={Trash2}
                            onClick={() => setDeleteModal(model.name)}
                          >
                            Delete
                          </GlassButton>
                        )}
                        {isEmbed && (
                          <span className="text-xs text-white/25 flex items-center gap-1">
                            <Lock size={11} />
                            Required for RAG
                          </span>
                        )}
                      </div>
                    </GlassCard>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Delete confirmation modal */}
      <GlassModal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete Model"
        size="sm"
      >
        <p className="text-sm text-white/60 mb-4">
          Are you sure you want to delete <strong className="text-white/90">{deleteModal}</strong>?
          This will free up disk space but the model will need to be re-downloaded.
        </p>
        <div className="flex items-center justify-end gap-3">
          <GlassButton variant="ghost" size="sm" onClick={() => setDeleteModal(null)}>
            Cancel
          </GlassButton>
          <GlassButton
            variant="danger"
            size="sm"
            icon={Trash2}
            loading={deleting}
            onClick={handleDelete}
          >
            Delete
          </GlassButton>
        </div>
      </GlassModal>
    </div>
  );
}
