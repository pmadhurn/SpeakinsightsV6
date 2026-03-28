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
  Server,
  CloudDownload,
  Terminal,
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
    setPullProgress({ status: 'Establishing uplink...', percent: null, completed: 0, total: 0 });

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
                status: 'Module Installed successfully.',
                percent: 100,
                completed: 0,
                total: 0,
                message: event.message,
              });
              glassToast.success(`Model ${modelName} deployed to active cluster`);
            } else if (event.status === 'error') {
              throw new Error(event.message || 'Transmission failed');
            } else {
              setPullProgress({
                status: event.status || 'Retrieving segments...',
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
      glassToast.error(`Operation aborted: ${err.message}`);
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
      glassToast.success(`Node flushed: ${deleteModal}`);
      if (defaultModel === deleteModal) {
        setDefaultModel('');
      }
      await loadModels();
    } catch (err: any) {
      glassToast.error(`Failure: ${err.message}`);
    }

    setDeleting(false);
    setDeleteModal(null);
  };

  // ── Set as default ──
  const handleSetDefault = (name: string) => {
    setDefaultModel(name);
    localStorage.setItem('speakinsights_default_model', name);
    glassToast.success(`Model pointer repath: ${name} is now the global default`);
  };

  const isEmbeddingModel = (name: string) =>
    name.includes('embed') || name.includes('nomic');

  return (
    <div className="min-h-[100dvh] pt-32 pb-16 bg-[#02060B] text-white selection:bg-cyan-500/30 font-sans relative overflow-x-hidden">
      
      {/* Background Meshes */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-cyan-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-purple-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto px-6 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          
          {/* Header Row */}
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-white/5 shadow-lg">
              <Server className="text-cyan-400" size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight">Core <span className="text-white/40">Engines</span></h1>
              <p className="text-[10px] text-cyan-400/80 mt-1 uppercase tracking-widest font-black flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                Hardware Node Matrix Status: {installedModels.length} Models Mounted
              </p>
            </div>
          </div>

          {/* Core Pull & Register Container */}
          <div className="bg-[#0a0c10]/80 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl p-6 md:p-8 mb-10">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/50 mb-5 flex items-center gap-2">
              <CloudDownload size={14} className="text-cyan-400" />
              Acquire Module Uplink
            </h3>
            
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Terminal size={14} className="text-cyan-400/50" />
                </div>
                <input
                  placeholder="Registry alias (e.g., mistral:7b, phi3:3.8b)"
                  value={pullModel}
                  onChange={(e) => setPullModel(e.target.value)}
                  disabled={isPulling}
                  className="w-full bg-white/[0.03] border border-white/10 hover:border-white/20 text-white rounded-2xl py-4 pl-12 pr-6 font-bold tracking-tight outline-none focus:bg-white/[0.05] focus:border-cyan-400/50 transition-all placeholder:text-white/20 disabled:opacity-50"
                />
              </div>
              <GlassButton
                variant={isPulling ? "outline" : "cyan"}
                icon={Download}
                disabled={!pullModel.trim() || isPulling}
                loading={isPulling && !pullProgress?.percent}
                onClick={() => handlePull()}
                className="!py-4 !rounded-2xl shrink-0 !text-[11px] tracking-[0.2em] shadow-cyan-500/20 md:w-32"
              >
                {!isPulling ? 'Deploy' : 'Wait...'}
              </GlassButton>
            </div>

            {/* SSE Progress Dashboard rendering block */}
            <AnimatePresence>
              {isPulling && pullProgress && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 overflow-hidden"
                >
                  <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black tracking-widest uppercase text-white/50">{pullProgress.status}</span>
                      {pullProgress.percent !== null && (
                        <span className="text-xs font-black text-cyan-400">
                          {pullProgress.percent.toFixed(1)}%
                        </span>
                      )}
                    </div>

                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden shadow-inner mb-3">
                      <motion.div
                        className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 rounded-full"
                        style={{ boxShadow: '0 0 15px rgba(34,211,238,0.5)' }}
                        initial={{ width: '0%' }}
                        animate={{ width: pullProgress.percent !== null ? `${pullProgress.percent}%` : '30%' }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>

                    {pullProgress.total > 0 && (
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 text-right">
                        {formatSize(pullProgress.completed)} / {formatSize(pullProgress.total)} Transferred
                      </p>
                    )}

                    {pullProgress.status === 'Module Installed successfully.' && (
                      <div className="flex items-center gap-2 mt-3 text-cyan-400 text-[10px] uppercase font-black tracking-widest bg-cyan-500/10 px-3 py-2 rounded-xl border border-cyan-500/20 inline-flex">
                        <CheckCircle size={14} /> Sequence Validated.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Auto Config suggestions */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-3">Registered Cloud Manifests:</p>
              <div className="flex flex-wrap gap-2.5">
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
                      className={`px-3 py-2 rounded-xl text-[10px] uppercase tracking-[0.2em] font-black border transition-all flex items-center gap-2 ${
                        isInstalled
                          ? 'bg-cyan-500/5 border-cyan-500/20 text-cyan-400/50 cursor-default shadow-inner'
                          : 'bg-white/5 border-white/10 text-white/60 hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-purple-400 cursor-pointer hover:shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                      }`}
                    >
                      {isInstalled ? <CheckCircle size={12} className="text-cyan-400" /> : <CloudDownload size={12} />}
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Local Mounts Registry Area */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/50 flex items-center gap-2">
              <HardDrive size={14} />
              Mounted Registry Arrays
            </h3>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white/5 h-48 rounded-3xl animate-pulse border border-white/5" />
              ))}
            </div>
          ) : installedModels.length === 0 ? (
            <div className="bg-[#0a0c10]/50 backdrop-blur-xl rounded-3xl border border-dashed border-white/20 p-16 text-center shadow-xl">
              <AlertCircle className="text-cyan-400/20 mx-auto mb-5" size={48} />
              <p className="text-white text-lg font-black tracking-tighter uppercase mb-2">Zero Engines Loaded</p>
              <p className="text-white/40 text-xs font-medium max-w-sm mx-auto">
                No local models are provisioned to run local processing. Acquire an uplink above to arm intelligence context nodes.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {installedModels.map((model, i) => {
                const isDefault = defaultModel === model.name;
                const isEmbed = isEmbeddingModel(model.name);
                const family = model.details?.family || model.name.split(':')[0];
                const quantization = model.details?.quantization_level;
                const paramSize = model.details?.parameter_size;

                return (
                  <motion.div
                    key={model.name}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className={`h-full flex flex-col p-6 bg-[#0a0c10] backdrop-blur-md rounded-3xl border transition-all ${
                        isDefault 
                        ? 'border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.1)]' 
                        : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Mount Details Card Header */}
                      <div className="flex items-start justify-between mb-4 gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-white text-lg tracking-tight uppercase truncate">
                            {model.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`text-[9px] uppercase font-black tracking-widest px-2 py-1 rounded-lg border ${
                              isEmbed ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-white/5 border-white/10 text-white/70'
                            }`}>
                              {family}
                            </span>
                            {quantization && (
                              <span className="text-[9px] uppercase font-black tracking-widest px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50">
                                {quantization}
                              </span>
                            )}
                            {isEmbed && (
                              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-purple-400/80 bg-purple-500/10 px-2 py-1 rounded-lg border border-purple-500/20">
                                <Lock size={10} /> RAG TENSOR
                              </span>
                            )}
                          </div>
                        </div>
                        {isDefault && (
                          <span className="text-[9px] uppercase font-black tracking-widest text-cyan-400 bg-cyan-500/10 px-2.5 py-1.5 rounded-lg border border-cyan-500/20 shrink-0 shadow-sm flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"/>
                            Active Lead
                          </span>
                        )}
                      </div>

                      {/* Mount Meta Data List */}
                      <div className="space-y-2.5 mt-auto mb-6 flex-1">
                        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 bg-white/5 px-3 py-2 rounded-xl">
                          <HardDrive size={12} className="text-white/20" />
                          Capacity: {formatSize(model.size)}
                        </div>
                        {paramSize && (
                          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 bg-white/5 px-3 py-2 rounded-xl">
                            <Cpu size={12} className="text-white/20" />
                            Cluster Size: {paramSize}
                          </div>
                        )}
                        {model.modified_at && (
                          <div className="px-3 pt-1 text-[9px] uppercase tracking-widest text-white/20 font-bold">
                            Mod Hash: {formatDate(model.modified_at)}
                          </div>
                        )}
                      </div>

                      {/* Control Dock Bottom Buttons */}
                      <div className="flex items-center gap-3 justify-between">
                        {!isEmbed ? (
                          <GlassButton
                            variant={isDefault ? 'secondary' : 'primary'}
                            className="flex-1 !px-2 !py-2.5 !text-[9px] !rounded-xl !uppercase tracking-widest !h-auto justify-center"
                            onClick={() => handleSetDefault(model.name)}
                            disabled={isDefault}
                          >
                            <Zap size={12} className={isDefault ? 'text-white/30 mr-1.5' : 'mr-1.5'} />
                            {isDefault ? 'Connected Core' : 'Attach Core Priority'}
                          </GlassButton>
                        ) : (
                          <div className="flex-1 px-3 py-2 border border-white/5 rounded-xl text-[9px] uppercase font-black tracking-widest text-white/20 text-center">
                            EMBED/UTILITY CLASS TENSOR (SYSTEM MANAGED)
                          </div>
                        )}

                        <button
                          onClick={() => setDeleteModal(model.name)}
                          className="shrink-0 p-3 bg-red-500/5 hover:bg-red-500/10 text-red-500/60 hover:text-red-400 border border-red-500/10 hover:border-red-500/30 transition-all rounded-xl"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Glass Danger Execution Terminal Override / Modal Block  */}
      <GlassModal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title={<span className="text-red-400 font-black uppercase tracking-tight flex items-center gap-2"><AlertCircle/> Wipe Hardware Sector?</span>}
        size="sm"
      >
        <p className="text-[12px] uppercase font-bold tracking-wider leading-relaxed text-white/50 mb-6 bg-red-500/5 p-4 rounded-xl border border-red-500/10 text-center mt-2">
          CONFIRM DROP VOLUME:<br/><strong className="text-white text-[15px]">{deleteModal}</strong>
          <span className="block mt-4 text-[9px] tracking-widest text-red-400">NOTE: Free up allocation sector instantly, sequence irreversible offline. Will require remote pull again if utilized later.</span>
        </p>

        <div className="flex items-center justify-center gap-3 w-full">
          <GlassButton variant="outline" size="sm" onClick={() => setDeleteModal(null)} className="flex-1 !py-3 !text-[11px] !uppercase !tracking-widest">
            Halt Exec
          </GlassButton>
          <GlassButton
            variant="danger"
            size="sm"
            icon={Trash2}
            loading={deleting}
            onClick={handleDelete}
            className="flex-1 !py-3 !text-[11px] !uppercase !tracking-widest"
          >
            Nuke Model
          </GlassButton>
        </div>
      </GlassModal>

    </div>
  );
}
// import { useState, useEffect, useCallback } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import {
//   Cpu,
//   Download,
//   Trash2,
//   HardDrive,
//   CheckCircle,
//   Lock,
//   Zap,
//   AlertCircle,
// } from 'lucide-react';
// import GlassCard from '@/components/ui/GlassCard';
// import GlassButton from '@/components/ui/GlassButton';
// import GlassInput from '@/components/ui/GlassInput';
// import GlassModal from '@/components/ui/GlassModal';
// import Badge from '@/components/ui/Badge';
// import { models as modelsApi } from '@/services/api';
// import { useUIStore } from '@/stores/uiStore';
// import { glassToast } from '@/components/ui/Toast';
// import { formatDate } from '@/utils/formatTime';

// interface OllamaModel {
//   name: string;
//   size?: number;
//   digest?: string;
//   modified_at?: string;
//   details?: {
//     family?: string;
//     parameter_size?: string;
//     quantization_level?: string;
//   };
// }

// interface PullProgress {
//   status: string;
//   percent: number | null;
//   completed: number;
//   total: number;
//   message?: string;
// }

// const QUICK_MODELS = [
//   'llama3.2:3b',
//   'mistral:7b',
//   'qwen2.5:3b',
//   'phi3:3.8b',
//   'gemma2:2b',
//   'nomic-embed-text',
// ];

// function formatSize(bytes?: number): string {
//   if (!bytes) return '—';
//   const gb = bytes / (1024 * 1024 * 1024);
//   if (gb >= 1) return `${gb.toFixed(1)} GB`;
//   const mb = bytes / (1024 * 1024);
//   return `${mb.toFixed(0)} MB`;
// }

// export default function ModelManager() {
//   const [pullModel, setPullModel] = useState('');
//   const [installedModels, setInstalledModels] = useState<OllamaModel[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [isPulling, setIsPulling] = useState(false);
//   const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
//   const [deleteModal, setDeleteModal] = useState<string | null>(null);
//   const [deleting, setDeleting] = useState(false);

//   const { defaultModel, setDefaultModel } = useUIStore();

//   // ── Load models ──
//   const loadModels = useCallback(async () => {
//     try {
//       const data = await modelsApi.list();
//       setInstalledModels(data.models || []);
//     } catch {
//       setInstalledModels([]);
//     }
//     setLoading(false);
//   }, []);

//   useEffect(() => {
//     loadModels();
//   }, [loadModels]);

//   // ── Pull model via SSE ──
//   const handlePull = async (name?: string) => {
//     const modelName = (name || pullModel).trim();
//     if (!modelName || isPulling) return;

//     setIsPulling(true);
//     setPullProgress({ status: 'Pulling manifest...', percent: null, completed: 0, total: 0 });

//     try {
//       const response = await fetch('/api/models/pull', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ name: modelName }),
//       });

//       if (!response.ok) throw new Error(`HTTP ${response.status}`);

//       const reader = response.body?.getReader();
//       if (!reader) throw new Error('No response body');

//       const decoder = new TextDecoder();
//       let buffer = '';

//       while (true) {
//         const { done, value } = await reader.read();
//         if (done) break;

//         buffer += decoder.decode(value, { stream: true });
//         const lines = buffer.split('\n');
//         buffer = lines.pop() || '';

//         for (const line of lines) {
//           if (!line.startsWith('data: ')) continue;
//           try {
//             const event = JSON.parse(line.slice(6));
//             if (event.status === 'success') {
//               setPullProgress({
//                 status: 'Success!',
//                 percent: 100,
//                 completed: 0,
//                 total: 0,
//                 message: event.message,
//               });
//               glassToast.success(`Model ${modelName} pulled successfully`);
//             } else if (event.status === 'error') {
//               throw new Error(event.message || 'Pull failed');
//             } else {
//               setPullProgress({
//                 status: event.status || 'Downloading...',
//                 percent: event.percent ?? null,
//                 completed: event.completed || 0,
//                 total: event.total || 0,
//               });
//             }
//           } catch (e) {
//             if (e instanceof SyntaxError) continue;
//             throw e;
//           }
//         }
//       }

//       setPullModel('');
//       await loadModels();
//     } catch (err: any) {
//       glassToast.error(`Failed to pull model: ${err.message}`);
//     }

//     setTimeout(() => {
//       setIsPulling(false);
//       setPullProgress(null);
//     }, 2000);
//   };

//   // ── Delete model ──
//   const handleDelete = async () => {
//     if (!deleteModal) return;
//     setDeleting(true);

//     try {
//       await modelsApi.delete(deleteModal);
//       glassToast.success(`Model ${deleteModal} deleted`);
//       if (defaultModel === deleteModal) {
//         setDefaultModel('');
//       }
//       await loadModels();
//     } catch (err: any) {
//       glassToast.error(`Failed to delete: ${err.message}`);
//     }

//     setDeleting(false);
//     setDeleteModal(null);
//   };

//   // ── Set as default ──
//   const handleSetDefault = (name: string) => {
//     setDefaultModel(name);
//     localStorage.setItem('speakinsights_default_model', name);
//     glassToast.success(`${name} set as default model`);
//   };

//   const isEmbeddingModel = (name: string) =>
//     name.includes('embed') || name.includes('nomic');

//   return (
//     <div className="min-h-screen pt-24 pb-16">
//       <div className="max-w-4xl mx-auto px-4">
//         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
//           {/* Header */}
//           <div className="flex items-center gap-3 mb-8">
//             <div className="p-2.5 rounded-glass bg-cyan/10">
//               <Cpu className="text-cyan" size={22} />
//             </div>
//             <div>
//               <h1 className="text-2xl font-bold text-white/90">Model Manager</h1>
//               <p className="text-xs text-white/40">Manage your local AI models</p>
//             </div>
//           </div>

//           {/* Pull new model */}
//           <GlassCard variant="gradient" className="mb-6">
//             <h3 className="font-semibold text-white/90 mb-3 flex items-center gap-2">
//               <Download size={16} className="text-cyan" />
//               Pull New Model
//             </h3>
//             <div className="flex gap-3 mb-3">
//               <div className="flex-1">
//                 <GlassInput
//                   placeholder="Enter model name (e.g., llama3.2:3b, qwen3:2b, mistral:7b)"
//                   value={pullModel}
//                   onChange={(e) => setPullModel(e.target.value)}
//                   disabled={isPulling}
//                 />
//               </div>
//               <GlassButton
//                 variant="primary"
//                 icon={Download}
//                 disabled={!pullModel.trim() || isPulling}
//                 loading={isPulling && !pullProgress?.percent}
//                 onClick={() => handlePull()}
//               >
//                 Pull
//               </GlassButton>
//             </div>

//             {/* Pull progress */}
//             <AnimatePresence>
//               {isPulling && pullProgress && (
//                 <motion.div
//                   initial={{ opacity: 0, height: 0 }}
//                   animate={{ opacity: 1, height: 'auto' }}
//                   exit={{ opacity: 0, height: 0 }}
//                   className="mt-3"
//                 >
//                   <div className="bg-white/5 rounded-xl p-4 border border-white/10">
//                     <div className="flex items-center justify-between mb-2">
//                       <span className="text-sm text-white/70">{pullProgress.status}</span>
//                       {pullProgress.percent !== null && (
//                         <span className="text-sm font-medium text-cyan">
//                           {pullProgress.percent.toFixed(1)}%
//                         </span>
//                       )}
//                     </div>

//                     {/* Progress bar */}
//                     <div className="h-2 bg-white/5 rounded-full overflow-hidden">
//                       <motion.div
//                         className="h-full rounded-full bg-gradient-to-r from-cyan via-cyan to-lavender"
//                         style={{
//                           boxShadow: '0 0 12px rgba(34, 211, 238, 0.5)',
//                         }}
//                         initial={{ width: '0%' }}
//                         animate={{
//                           width: pullProgress.percent !== null
//                             ? `${pullProgress.percent}%`
//                             : '30%',
//                         }}
//                         transition={{ duration: 0.3 }}
//                       />
//                     </div>

//                     {/* Size info */}
//                     {pullProgress.total > 0 && (
//                       <p className="text-xs text-white/30 mt-2">
//                         {formatSize(pullProgress.completed)} / {formatSize(pullProgress.total)}
//                       </p>
//                     )}

//                     {pullProgress.status === 'Success!' && (
//                       <div className="flex items-center gap-2 mt-2 text-emerald-400 text-sm">
//                         <CheckCircle size={14} />
//                         Model downloaded successfully
//                       </div>
//                     )}
//                   </div>
//                 </motion.div>
//               )}
//             </AnimatePresence>

//             {/* Quick pull suggestions */}
//             <div className="mt-3">
//               <p className="text-xs text-white/30 mb-2">Quick pull:</p>
//               <div className="flex flex-wrap gap-2">
//                 {QUICK_MODELS.map((name) => {
//                   const isInstalled = installedModels.some((m) => m.name === name);
//                   return (
//                     <button
//                       key={name}
//                       onClick={() => {
//                         if (!isInstalled && !isPulling) {
//                           setPullModel(name);
//                           handlePull(name);
//                         }
//                       }}
//                       disabled={isInstalled || isPulling}
//                       className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
//                         isInstalled
//                           ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400/60 cursor-default'
//                           : 'bg-white/5 border-white/10 text-white/50 hover:bg-cyan/10 hover:border-cyan/30 hover:text-cyan cursor-pointer'
//                       }`}
//                     >
//                       {isInstalled && <CheckCircle size={10} className="inline mr-1 -mt-0.5" />}
//                       {name}
//                     </button>
//                   );
//                 })}
//               </div>
//             </div>
//           </GlassCard>

//           {/* Installed models */}
//           <h3 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
//             <HardDrive size={14} />
//             Installed Models ({installedModels.length})
//           </h3>

//           {loading ? (
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               {[1, 2].map((i) => (
//                 <div
//                   key={i}
//                   className="glass h-40 rounded-2xl animate-pulse"
//                 />
//               ))}
//             </div>
//           ) : installedModels.length === 0 ? (
//             <GlassCard className="text-center py-12">
//               <AlertCircle className="text-white/15 mx-auto mb-3" size={40} />
//               <p className="text-white/30 text-sm">No models installed</p>
//               <p className="text-white/20 text-xs mt-1">
//                 Pull a model above to get started
//               </p>
//             </GlassCard>
//           ) : (
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               {installedModels.map((model, i) => {
//                 const isDefault = defaultModel === model.name;
//                 const isEmbed = isEmbeddingModel(model.name);
//                 const family = model.details?.family || model.name.split(':')[0];
//                 const quantization = model.details?.quantization_level;
//                 const paramSize = model.details?.parameter_size;

//                 return (
//                   <motion.div
//                     key={model.name}
//                     initial={{ opacity: 0, y: 10 }}
//                     animate={{ opacity: 1, y: 0 }}
//                     transition={{ delay: i * 0.05 }}
//                   >
//                     <GlassCard
//                       className={`h-full ${isDefault ? 'ring-1 ring-cyan/30' : ''}`}
//                       glow={isDefault ? 'cyan' : 'none'}
//                     >
//                       <div className="flex items-start justify-between mb-3">
//                         <div>
//                           <h4 className="font-semibold text-white/90 text-lg leading-tight">
//                             {model.name}
//                           </h4>
//                           <div className="flex items-center gap-2 mt-1.5 flex-wrap">
//                             <Badge
//                               text={family}
//                               variant={isEmbed ? 'lavender' : 'cyan'}
//                             />
//                             {quantization && (
//                               <Badge text={quantization} variant="gray" />
//                             )}
//                             {isEmbed && (
//                               <span className="flex items-center gap-1 text-[10px] text-amber-400/70">
//                                 <Lock size={9} />
//                                 embedding
//                               </span>
//                             )}
//                           </div>
//                         </div>
//                         {isDefault && (
//                           <span className="text-[10px] text-cyan bg-cyan/10 px-2 py-0.5 rounded-full border border-cyan/20 shrink-0">
//                             Default
//                           </span>
//                         )}
//                       </div>

//                       <div className="space-y-1.5 text-xs text-white/40 mb-4">
//                         <div className="flex items-center gap-2">
//                           <HardDrive size={11} />
//                           {formatSize(model.size)}
//                         </div>
//                         {paramSize && (
//                           <div className="flex items-center gap-2">
//                             <Cpu size={11} />
//                             {paramSize} parameters
//                           </div>
//                         )}
//                         {model.modified_at && (
//                           <div className="text-white/25">
//                             Modified {formatDate(model.modified_at)}
//                           </div>
//                         )}
//                       </div>

//                       <div className="flex items-center gap-2">
//                         {!isEmbed && (
//                           <GlassButton
//                             variant={isDefault ? 'primary' : 'ghost'}
//                             size="sm"
//                             icon={isDefault ? CheckCircle : Zap}
//                             onClick={() => handleSetDefault(model.name)}
//                             disabled={isDefault}
//                           >
//                             {isDefault ? 'Active' : 'Use for Summaries'}
//                           </GlassButton>
//                         )}
//                         {!isEmbed && (
//                           <GlassButton
//                             variant="danger"
//                             size="sm"
//                             icon={Trash2}
//                             onClick={() => setDeleteModal(model.name)}
//                           >
//                             Delete
//                           </GlassButton>
//                         )}
//                         {isEmbed && (
//                           <span className="text-xs text-white/25 flex items-center gap-1">
//                             <Lock size={11} />
//                             Required for RAG
//                           </span>
//                         )}
//                       </div>
//                     </GlassCard>
//                   </motion.div>
//                 );
//               })}
//             </div>
//           )}
//         </motion.div>
//       </div>

//       {/* Delete confirmation modal */}
//       <GlassModal
//         isOpen={!!deleteModal}
//         onClose={() => setDeleteModal(null)}
//         title="Delete Model"
//         size="sm"
//       >
//         <p className="text-sm text-white/60 mb-4">
//           Are you sure you want to delete <strong className="text-white/90">{deleteModal}</strong>?
//           This will free up disk space but the model will need to be re-downloaded.
//         </p>
//         <div className="flex items-center justify-end gap-3">
//           <GlassButton variant="ghost" size="sm" onClick={() => setDeleteModal(null)}>
//             Cancel
//           </GlassButton>
//           <GlassButton
//             variant="danger"
//             size="sm"
//             icon={Trash2}
//             loading={deleting}
//             onClick={handleDelete}
//           >
//             Delete
//           </GlassButton>
//         </div>
//       </GlassModal>
//     </div>
//   );
// }
