import React, { useState } from 'react';
import { X, Sliders, Cpu, Key, Database, RefreshCw, Check } from 'lucide-react';
import { SystemSettings } from '../types';
import { GeminiSparkle } from './GeminiSparkle';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SystemSettings;
  onSave: (newSettings: SystemSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [formData, setFormData] = useState<SystemSettings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 500);
  };

  const handleProviderChange = (provider: SystemSettings['llmProvider']) => {
    let defaultModel = formData.model;
    if (provider === 'gemini') defaultModel = 'gemini-1.5-flash';
    if (provider === 'openai') defaultModel = 'gpt-4o-mini';
    if (provider === 'ollama') defaultModel = 'llama3.2';

    setFormData({
      ...formData,
      llmProvider: provider,
      model: defaultModel,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1f20] border border-[#333537] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#282a2c] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GeminiSparkle size={24} />
            <div>
              <h3 className="font-heading font-medium text-[#f0f4f9] text-base">Nexus & Model Settings</h3>
              <p className="text-xs text-[#8e918f]">Configure AI model, hyperparameters, and vector retrieval</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#8e918f] hover:text-white hover:bg-[#282a2c] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[72vh]">
          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-medium text-[#8e918f] uppercase tracking-wider mb-2.5">
              LLM Provider
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'gemini', label: 'Google Gemini', desc: '1.5 Flash / Pro' },
                { id: 'openai', label: 'OpenAI', desc: 'GPT-4o Mini / 4o' },
                { id: 'ollama', label: 'Ollama', desc: 'Llama 3.2 (Local)' },
              ].map((prov) => (
                <button
                  type="button"
                  key={prov.id}
                  onClick={() => handleProviderChange(prov.id as any)}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    formData.llmProvider === prov.id
                      ? 'border-[#4285f4] bg-[#4285f4]/10 text-white shadow-sm'
                      : 'border-[#333537] bg-[#131314] text-[#8e918f] hover:border-[#444746] hover:text-[#c4c7c5]'
                  }`}
                >
                  <p className="text-xs font-semibold text-[#f0f4f9]">{prov.label}</p>
                  <p className="text-[11px] text-[#8e918f] mt-0.5">{prov.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Model Name */}
          <div>
            <label className="block text-xs font-medium text-[#8e918f] uppercase tracking-wider mb-1.5">
              Model Name
            </label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="w-full bg-[#131314] border border-[#333537] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#8e918f] focus:outline-none focus:border-[#4285f4] font-mono"
              placeholder="gemini-1.5-flash, gpt-4o-mini, etc."
            />
          </div>

          {/* Top-K Retrieval */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-medium text-[#8e918f] uppercase tracking-wider">
                Top-K Chunks to Retrieve
              </label>
              <span className="text-xs font-mono font-medium text-[#4285f4] bg-[#4285f4]/10 px-2 py-0.5 rounded-full border border-[#4285f4]/20">
                {formData.topK} chunks
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={formData.topK}
              onChange={(e) => setFormData({ ...formData, topK: parseInt(e.target.value) })}
              className="w-full accent-[#4285f4] h-1.5 bg-[#131314] rounded-lg appearance-none cursor-pointer"
            />
            <p className="text-[11px] text-[#8e918f] mt-1">
              Number of closest vector passages retrieved from PostgreSQL per query.
            </p>
          </div>

          {/* Temperature */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-medium text-[#8e918f] uppercase tracking-wider">
                Temperature (Creativity)
              </label>
              <span className="text-xs font-mono font-medium text-[#4285f4] bg-[#4285f4]/10 px-2 py-0.5 rounded-full border border-[#4285f4]/20">
                {formData.temperature}
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
              className="w-full accent-[#4285f4] h-1.5 bg-[#131314] rounded-lg appearance-none cursor-pointer"
            />
            <p className="text-[11px] text-[#8e918f] mt-1">
              Lower values (0.0 - 0.2) yield strictly grounded answers directly from documents.
            </p>
          </div>

          {/* System Instructions */}
          <div>
            <label className="block text-xs font-medium text-[#8e918f] uppercase tracking-wider mb-1.5">
              System Prompt (Optional)
            </label>
            <textarea
              rows={3}
              value={formData.systemPrompt || ''}
              onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
              placeholder="Leave empty to use Nexus default grounded document prompt..."
              className="w-full bg-[#131314] border border-[#333537] rounded-xl p-3 text-xs text-white placeholder-[#8e918f] focus:outline-none focus:border-[#4285f4]"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#282a2c]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-medium text-[#c4c7c5] hover:text-white hover:bg-[#282a2c] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1b66ca] text-white text-xs font-medium shadow-md transition-all flex items-center gap-1.5"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Saved
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
