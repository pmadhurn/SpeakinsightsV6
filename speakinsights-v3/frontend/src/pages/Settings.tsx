import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Globe,
  Cpu,
  Eye,
  HardDrive,
  Trash2,
  MessageSquare,
  Save,
  CheckCircle,
  Cloud,
  Server,
  ExternalLink,
  Zap,
  Key,
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import GlassButton from '@/components/ui/GlassButton';
import GlassModal from '@/components/ui/GlassModal';
import { useUIStore } from '@/stores/uiStore';
import { models as modelsApi, chat, llmSettings } from '@/services/api';
import { glassToast } from '@/components/ui/Toast';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'hi', label: 'Hindi' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ar', label: 'Arabic' },
];

const CAPTION_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

interface OpenRouterModel {
  id: string;
  name: string;
  category: string;
  description: string;
}

export default function Settings() {
  const { defaultLanguage, setDefaultLanguage, defaultModel, setDefaultModel } = useUIStore();

  const [installedModels, setInstalledModels] = useState<{ name: string }[]>([]);
  const [chatModel, setChatModel] = useState(() =>
    localStorage.getItem('speakinsights_chat_model') || '',
  );
  const [autoRecord, setAutoRecord] = useState(() =>
    localStorage.getItem('speakinsights_auto_record') !== 'false',
  );
  const [maxParticipants, setMaxParticipants] = useState(() =>
    parseInt(localStorage.getItem('speakinsights_max_participants') || '20'),
  );
  const [reduceMotion, setReduceMotion] = useState(() =>
    localStorage.getItem('speakinsights_reduce_motion') === 'true',
  );
  const [captionSize, setCaptionSize] = useState(() =>
    localStorage.getItem('speakinsights_caption_size') || 'medium',
  );
  const [saved, setSaved] = useState(false);
  const [clearChatModal, setClearChatModal] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);

  // LLM Provider state
  const [llmProvider, setLlmProvider] = useState<string>('ollama');
  const [openrouterConfigured, setOpenrouterConfigured] = useState(false);
  const [openrouterModel, setOpenrouterModel] = useState('minimax/minimax-m2.5:free');
  const [openrouterModels, setOpenrouterModels] = useState<OpenRouterModel[]>([]);
  const [switchingProvider, setSwitchingProvider] = useState(false);

  // Load real models from Ollama via API
  useEffect(() => {
    modelsApi
      .list()
      .then((data) => {
        const models = data.models || [];
        setInstalledModels(models);
        if (!chatModel && models.length > 0) {
          setChatModel(models[0].name);
        }
      })
      .catch(() => {});
  }, []);

  // Load LLM settings
  useEffect(() => {
    llmSettings
      .get()
      .then((data: any) => {
        setLlmProvider(data.active_provider || 'ollama');
        setOpenrouterConfigured(data.openrouter?.configured || false);
        if (data.openrouter?.model) {
          setOpenrouterModel(data.openrouter.model);
        }
      })
      .catch(() => {});

    llmSettings
      .getOpenRouterModels()
      .then((data: any) => {
        setOpenrouterModels(data.models || []);
      })
      .catch(() => {});
  }, []);

  const selectClass =
    'w-full bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white/90 focus:outline-none focus:border-cyan/50 transition-colors appearance-none';

  const handleSave = () => {
    localStorage.setItem('speakinsights_chat_model', chatModel);
    localStorage.setItem('speakinsights_auto_record', String(autoRecord));
    localStorage.setItem('speakinsights_max_participants', String(maxParticipants));
    localStorage.setItem('speakinsights_reduce_motion', String(reduceMotion));
    localStorage.setItem('speakinsights_caption_size', captionSize);
    localStorage.setItem('speakinsights_default_model', defaultModel);

    setSaved(true);
    glassToast.success('Settings saved');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearChat = async () => {
    setClearingChat(true);
    try {
      const data: any = await chat.getSessions();
      const allSessions = data.sessions || (Array.isArray(data) ? data : []);
      for (const s of allSessions) {
        await chat.deleteSession(s.session_id);
      }
      glassToast.success(`Cleared ${allSessions.length} chat session(s)`);
    } catch {
      glassToast.error('Failed to clear chat history');
    }
    setClearingChat(false);
    setClearChatModal(false);
  };

  const handleSwitchProvider = async (provider: string) => {
    if (provider === 'openrouter' && !openrouterConfigured) {
      glassToast.error('OpenRouter API key not configured. Add OPENROUTER_API_KEY to your .env file.');
      return;
    }

    setSwitchingProvider(true);
    try {
      await llmSettings.setProvider(
        provider,
        provider === 'openrouter' ? openrouterModel : undefined,
      );
      setLlmProvider(provider);
      glassToast.success(`Switched to ${provider === 'ollama' ? 'Ollama (Local)' : 'OpenRouter (Cloud)'}`);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to switch provider';
      glassToast.error(msg);
    }
    setSwitchingProvider(false);
  };

  const handleOpenRouterModelChange = async (modelId: string) => {
    setOpenrouterModel(modelId);
    if (llmProvider === 'openrouter') {
      try {
        await llmSettings.setProvider('openrouter', modelId);
        glassToast.success('OpenRouter model updated');
      } catch {
        glassToast.error('Failed to update model');
      }
    }
  };

  const nonEmbedModels = installedModels.filter(
    (m) => !m.name.includes('embed') && !m.name.includes('nomic'),
  );

  const freeModels = openrouterModels.filter((m) => m.category === 'free');
  const paidModels = openrouterModels.filter((m) => m.category === 'paid');

  return (
    <div className="min-h-screen pt-32 pb-16">
      <div className="max-w-2xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 rounded-glass bg-lavender/10">
              <SettingsIcon className="text-lavender" size={22} />
            </div>
            <h1 className="text-2xl font-bold text-white/90">Settings</h1>
          </div>

          <div className="space-y-5">
            {/* Section 1: LLM Provider */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-5">
                <Zap size={16} className="text-amber-400" />
                <h3 className="font-semibold text-white/90">LLM Provider</h3>
              </div>

              {/* Provider Toggle */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <button
                  onClick={() => handleSwitchProvider('ollama')}
                  disabled={switchingProvider}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-300 ${
                    llmProvider === 'ollama'
                      ? 'border-cyan/50 bg-cyan/10 shadow-lg shadow-cyan/5'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                  }`}
                >
                  {llmProvider === 'ollama' && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle size={14} className="text-cyan" />
                    </div>
                  )}
                  <Server size={24} className={llmProvider === 'ollama' ? 'text-cyan' : 'text-white/40'} />
                  <div className="text-center">
                    <p className={`text-sm font-semibold ${llmProvider === 'ollama' ? 'text-cyan' : 'text-white/70'}`}>
                      Ollama
                    </p>
                    <p className="text-xs text-white/30 mt-0.5">Local • Free • Private</p>
                  </div>
                </button>

                <button
                  onClick={() => handleSwitchProvider('openrouter')}
                  disabled={switchingProvider}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-300 ${
                    llmProvider === 'openrouter'
                      ? 'border-lavender/50 bg-lavender/10 shadow-lg shadow-lavender/5'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                  } ${!openrouterConfigured ? 'opacity-60' : ''}`}
                >
                  {llmProvider === 'openrouter' && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle size={14} className="text-lavender" />
                    </div>
                  )}
                  <Cloud size={24} className={llmProvider === 'openrouter' ? 'text-lavender' : 'text-white/40'} />
                  <div className="text-center">
                    <p className={`text-sm font-semibold ${llmProvider === 'openrouter' ? 'text-lavender' : 'text-white/70'}`}>
                      OpenRouter
                    </p>
                    <p className="text-xs text-white/30 mt-0.5">Cloud • Multi-model</p>
                  </div>
                </button>
              </div>

              {/* OpenRouter config status */}
              {!openrouterConfigured && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
                  <Key size={14} className="text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-amber-300/90">
                      OpenRouter API key not configured
                    </p>
                    <p className="text-xs text-white/30 mt-1">
                      Add <code className="bg-white/10 px-1 rounded text-white/50">OPENROUTER_API_KEY</code> to your .env file.
                      Get a key at{' '}
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-400 hover:underline inline-flex items-center gap-0.5"
                      >
                        openrouter.ai <ExternalLink size={10} />
                      </a>
                    </p>
                  </div>
                </div>
              )}

              {/* OpenRouter model selection */}
              {openrouterConfigured && (
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">OpenRouter Model</label>
                  <select
                    value={openrouterModel}
                    onChange={(e) => handleOpenRouterModelChange(e.target.value)}
                    className={selectClass}
                  >
                    {freeModels.length > 0 && (
                      <optgroup label="Free Models">
                        {freeModels.map((m) => (
                          <option key={m.id} value={m.id} className="bg-navy-light">
                            {m.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {paidModels.length > 0 && (
                      <optgroup label="Paid Models">
                        {paidModels.map((m) => (
                          <option key={m.id} value={m.id} className="bg-navy-light">
                            {m.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {openrouterModels.find((m) => m.id === openrouterModel)?.description && (
                    <p className="text-xs text-white/30 mt-1.5">
                      {openrouterModels.find((m) => m.id === openrouterModel)?.description}
                    </p>
                  )}
                </div>
              )}

              {/* Current provider indicator */}
              <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                <div className={`w-2 h-2 rounded-full ${llmProvider === 'ollama' ? 'bg-cyan' : 'bg-lavender'} animate-pulse`} />
                <span className="text-xs text-white/50">
                  Active: <span className="text-white/80 font-medium">{llmProvider === 'ollama' ? 'Ollama (Local)' : `OpenRouter — ${openrouterModel}`}</span>
                </span>
              </div>
            </GlassCard>

            {/* Section 2: Meeting Defaults */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-5">
                <Globe size={16} className="text-cyan" />
                <h3 className="font-semibold text-white/90">Meeting Defaults</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">Default Language</label>
                  <select
                    value={defaultLanguage}
                    onChange={(e) => setDefaultLanguage(e.target.value)}
                    className={selectClass}
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.value} value={lang.value} className="bg-navy-light">
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <label className="text-sm text-white/80">Auto-Record</label>
                    <p className="text-xs text-white/30 mt-0.5">
                      Automatically start recording when meeting begins
                    </p>
                  </div>
                  <button
                    onClick={() => setAutoRecord(!autoRecord)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      autoRecord ? 'bg-cyan/40' : 'bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        autoRecord ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1.5">Max Participants</label>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={maxParticipants}
                    onChange={(e) =>
                      setMaxParticipants(Math.min(20, Math.max(2, parseInt(e.target.value) || 2)))
                    }
                    className={selectClass}
                  />
                </div>
              </div>
            </GlassCard>

            {/* Section 3: AI Models (Ollama) */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-5">
                <Cpu size={16} className="text-lavender" />
                <h3 className="font-semibold text-white/90">Ollama Models</h3>
                <span className="text-xs text-white/30 ml-auto">Local models</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">Default Summary Model</label>
                  <select
                    value={defaultModel}
                    onChange={(e) => setDefaultModel(e.target.value)}
                    className={selectClass}
                  >
                    {nonEmbedModels.map((m) => (
                      <option key={m.name} value={m.name} className="bg-navy-light">
                        {m.name}
                      </option>
                    ))}
                    {nonEmbedModels.length === 0 && (
                      <option value="" className="bg-navy-light">No models installed</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1.5">Default Chat Model</label>
                  <select
                    value={chatModel}
                    onChange={(e) => setChatModel(e.target.value)}
                    className={selectClass}
                  >
                    {nonEmbedModels.map((m) => (
                      <option key={m.name} value={m.name} className="bg-navy-light">
                        {m.name}
                      </option>
                    ))}
                    {nonEmbedModels.length === 0 && (
                      <option value="" className="bg-navy-light">No models installed</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1.5">Embedding Model</label>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white/50 text-sm">
                    <span>nomic-embed-text</span>
                    <span className="text-xs text-white/30 ml-auto">System managed • Always Ollama</span>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Section 4: Appearance */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-5">
                <Eye size={16} className="text-emerald-400" />
                <h3 className="font-semibold text-white/90">Appearance</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <label className="text-sm text-white/80">Reduce Motion</label>
                    <p className="text-xs text-white/30 mt-0.5">Disable animations for accessibility</p>
                  </div>
                  <button
                    onClick={() => setReduceMotion(!reduceMotion)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      reduceMotion ? 'bg-cyan/40' : 'bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        reduceMotion ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1.5">Caption Font Size</label>
                  <div className="flex gap-2">
                    {CAPTION_SIZES.map((size) => (
                      <button
                        key={size.value}
                        onClick={() => setCaptionSize(size.value)}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                          captionSize === size.value
                            ? 'bg-cyan/15 border-cyan/30 text-cyan'
                            : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/8 hover:border-white/15'
                        }`}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Section 5: Storage */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-5">
                <HardDrive size={16} className="text-amber-400" />
                <h3 className="font-semibold text-white/90">Storage</h3>
              </div>
              <div className="space-y-3">
                <GlassButton
                  variant="ghost"
                  size="sm"
                  icon={MessageSquare}
                  onClick={() => setClearChatModal(true)}
                >
                  Clear Chat History
                </GlassButton>
              </div>
            </GlassCard>

            {/* Save button */}
            <div className="flex justify-end pt-2 pb-8">
              <GlassButton
                variant="primary"
                size="lg"
                icon={saved ? CheckCircle : Save}
                onClick={handleSave}
              >
                {saved ? 'Saved!' : 'Save Settings'}
              </GlassButton>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Clear chat confirmation */}
      <GlassModal
        isOpen={clearChatModal}
        onClose={() => setClearChatModal(false)}
        title="Clear Chat History"
        size="sm"
      >
        <p className="text-sm text-white/60 mb-4">
          This will permanently delete all chat sessions and their messages. This cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-3">
          <GlassButton variant="ghost" size="sm" onClick={() => setClearChatModal(false)}>
            Cancel
          </GlassButton>
          <GlassButton
            variant="danger"
            size="sm"
            icon={Trash2}
            loading={clearingChat}
            onClick={handleClearChat}
          >
            Clear All
          </GlassButton>
        </div>
      </GlassModal>
    </div>
  );
}
