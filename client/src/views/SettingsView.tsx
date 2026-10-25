import React, { useState } from "react";
import {
  Settings,
  Sparkles,
  Shield,
  Sliders,
  Palette,
  Terminal,
  Check,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import type { AppSettings, AIProviderStatus, AIModelInfo } from "@lazydesk/shared";

interface SettingsViewProps {
  settings: AppSettings;
  aiStatus: AIProviderStatus | null;
  models: AIModelInfo[];
  onSaveSettings: (updates: Partial<AppSettings>) => Promise<void>;
  onTestAI: () => Promise<{ ok: boolean; message: string; latencyMs?: number }>;
  onThemeToggle: (theme: "dark" | "light") => void;
  onDemoModeToggle: (enabled: boolean) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  aiStatus,
  models,
  onSaveSettings,
  onTestAI,
  onThemeToggle,
  onDemoModeToggle,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [testingAI, setTestingAI] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs?: number } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleTestConnection = async () => {
    setTestingAI(true);
    setTestResult(null);
    try {
      const res = await onTestAI();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message });
    } finally {
      setTestingAI(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await onSaveSettings(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Ollama Local AI Engine */}
        <div className="bg-charcoal-900 border border-charcoal-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-charcoal-800 bg-charcoal-850 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-semibold text-charcoal-100">
                Ollama Local Inference Provider
              </h3>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                aiStatus?.isAvailable
                  ? "bg-brand-500/10 text-brand-400 border border-brand-500/30"
                  : "bg-amber-500/10 text-amber-300 border border-amber-500/30"
              }`}
            >
              {aiStatus?.isAvailable ? "Connected" : "Offline"}
            </span>
          </div>

          <div className="p-6 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-charcoal-300 mb-1.5">
                  Ollama Base URL
                </label>
                <input
                  type="text"
                  value={formData.ollamaBaseUrl}
                  onChange={(e) => setFormData({ ...formData, ollamaBaseUrl: e.target.value })}
                  placeholder="http://127.0.0.1:11434"
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs font-mono text-charcoal-200 focus:outline-none focus:border-brand-500"
                />
                <p className="text-[11px] text-charcoal-500 mt-1">
                  Default local loopback endpoint for the Ollama daemon.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-charcoal-300 mb-1.5">
                  Selected Model
                </label>
                {models.length > 0 ? (
                  <select
                    value={formData.defaultModel}
                    onChange={(e) => setFormData({ ...formData, defaultModel: e.target.value })}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs font-mono text-charcoal-200 focus:outline-none focus:border-brand-500"
                  >
                    {models.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name} {m.parameterSize ? `(${m.parameterSize})` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.defaultModel}
                    onChange={(e) => setFormData({ ...formData, defaultModel: e.target.value })}
                    placeholder="llama3.2"
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs font-mono text-charcoal-200 focus:outline-none focus:border-brand-500"
                  />
                )}
                <p className="text-[11px] text-charcoal-500 mt-1">
                  Recommended: <code className="text-charcoal-300">llama3.2</code>, <code className="text-charcoal-300">mistral</code>, or <code className="text-charcoal-300">qwen2.5</code>.
                </p>
              </div>
            </div>

            {/* Connection Test Action & Result */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-charcoal-800/80">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingAI}
                className="px-3.5 py-1.5 rounded-lg border border-charcoal-700 bg-charcoal-800 hover:bg-charcoal-750 text-charcoal-200 text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>{testingAI ? "Pinging Ollama..." : "Test Ollama Connection"}</span>
              </button>

              {testResult && (
                <div
                  className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 font-mono ${
                    testResult.ok
                      ? "bg-brand-500/10 text-brand-300 border border-brand-500/30"
                      : "bg-red-500/10 text-red-300 border border-red-500/30"
                  }`}
                >
                  {testResult.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  <span>{testResult.message}</span>
                  {testResult.latencyMs && (
                    <span className="text-[10px] text-charcoal-500">({testResult.latencyMs}ms)</span>
                  )}
                </div>
              )}
            </div>

            {/* Troubleshooting Guide */}
            {!aiStatus?.isAvailable && (
              <div className="mt-4 p-4 bg-charcoal-950 rounded-lg border border-charcoal-800 text-xs space-y-2">
                <span className="font-semibold text-charcoal-200 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-brand-400" /> Ollama Installation & Setup
                </span>
                <ol className="list-decimal list-inside space-y-1 text-charcoal-400 font-mono text-[11px]">
                  <li>Install Ollama: <code className="text-charcoal-200">brew install ollama</code> or download from <a href="https://ollama.ai" target="_blank" rel="noreferrer" className="text-brand-400 underline">ollama.ai</a></li>
                  <li>Start the local server: <code className="text-charcoal-200">ollama serve</code></li>
                  <li>Pull an open-weight model: <code className="text-charcoal-200">ollama pull llama3.2</code></li>
                  <li>LazyDesk AI will automatically detect the running instance.</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Scanning & Boundary Safety Rules */}
        <div className="bg-charcoal-900 border border-charcoal-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-charcoal-800 bg-charcoal-850 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-semibold text-charcoal-100">
                Safe Traversal & Organization Rules
              </h3>
            </div>
          </div>

          <div className="p-6 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-charcoal-300 mb-1.5">
                  Max File Size (MB)
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={formData.maxFileSizeMB}
                  onChange={(e) => setFormData({ ...formData, maxFileSizeMB: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs font-mono text-charcoal-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-charcoal-300 mb-1.5">
                  Max Content Sample (Chars)
                </label>
                <input
                  type="number"
                  min="500"
                  max="20000"
                  step="500"
                  value={formData.maxContentSampleChars}
                  onChange={(e) => setFormData({ ...formData, maxContentSampleChars: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs font-mono text-charcoal-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-charcoal-300 mb-1.5">
                  AI Confidence Threshold (0 - 1)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={formData.confidenceThreshold}
                  onChange={(e) => setFormData({ ...formData, confidenceThreshold: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs font-mono text-charcoal-200 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 cursor-pointer p-3 bg-charcoal-950 rounded-lg border border-charcoal-800">
                <input
                  type="checkbox"
                  checked={formData.skipHiddenFiles}
                  onChange={(e) => setFormData({ ...formData, skipHiddenFiles: e.target.checked })}
                  className="rounded border-charcoal-700 text-brand-500 focus:ring-0"
                />
                <span className="text-charcoal-300">
                  Skip Hidden Files and Folders (starts with <code className="text-charcoal-400">.</code>)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-3 bg-charcoal-950 rounded-lg border border-charcoal-800">
                <input
                  type="checkbox"
                  checked={formData.followSymlinks}
                  onChange={(e) => setFormData({ ...formData, followSymlinks: e.target.checked })}
                  className="rounded border-charcoal-700 text-brand-500 focus:ring-0"
                />
                <span className="text-charcoal-300">
                  Follow Symbolic Links (Disabled by default for boundary security)
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Section 3: Interface & Demo Mode */}
        <div className="bg-charcoal-900 border border-charcoal-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-charcoal-800 bg-charcoal-850 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-semibold text-charcoal-100">
                Appearance & Demonstration Mode
              </h3>
            </div>
          </div>

          <div className="p-6 space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 bg-charcoal-950 rounded-lg border border-charcoal-800">
              <div>
                <span className="font-semibold text-charcoal-200 block">Theme Palette</span>
                <span className="text-charcoal-500 text-[11px]">
                  Minimalist charcoal with restrained green accents
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, theme: "dark" });
                    onThemeToggle("dark");
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                    formData.theme === "dark"
                      ? "bg-brand-500/15 border-brand-500/40 text-brand-300"
                      : "border-charcoal-700 bg-charcoal-850 text-charcoal-400"
                  }`}
                >
                  Dark Charcoal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, theme: "light" });
                    onThemeToggle("light");
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                    formData.theme === "light"
                      ? "bg-brand-500/15 border-brand-500/40 text-brand-300"
                      : "border-charcoal-700 bg-charcoal-850 text-charcoal-400"
                  }`}
                >
                  Clean Light
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 bg-charcoal-950 rounded-lg border border-charcoal-800">
              <div>
                <span className="font-semibold text-charcoal-200 block">Interactive Demo Mode</span>
                <span className="text-charcoal-500 text-[11px]">
                  Loads realistic sample files, duplicate clusters, and cleanup queues for demonstration.
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const nextState = !formData.demoMode;
                  setFormData({ ...formData, demoMode: nextState });
                  await onDemoModeToggle(nextState);
                }}
                className={`px-3.5 py-1.5 rounded-lg border text-xs font-medium transition ${
                  formData.demoMode
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-200"
                    : "border-charcoal-700 bg-charcoal-850 text-charcoal-400"
                }`}
              >
                {formData.demoMode ? "Disable Demo Mode" : "Enable Demo Mode"}
              </button>
            </div>
          </div>
        </div>

        {/* Section 4: Privacy & Open Innovation Manifest */}
        <div className="p-6 bg-charcoal-900 border border-charcoal-800 rounded-xl space-y-3 text-xs leading-relaxed">
          <div className="flex items-center gap-2 text-charcoal-100 font-semibold text-sm">
            <BookOpen className="w-4 h-4 text-brand-400" />
            <span>Privacy & Open-Weight AI Architecture</span>
          </div>

          <p className="text-charcoal-400">
            LazyDesk AI was built specifically for the <strong className="text-charcoal-200">Hacktoberfest 2026 Open-Source AI Challenge (Week 3: Slow and Steady)</strong>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-[11px] text-charcoal-400">
            <div className="p-3 bg-charcoal-950 rounded-lg border border-charcoal-800/80 space-y-1">
              <span className="font-semibold text-charcoal-200 block">🔒 100% Local Inference</span>
              <p>
                Document contents and prompts never leave your device. No paid cloud tokens, zero external telemetry, zero surveillance.
              </p>
            </div>
            <div className="p-3 bg-charcoal-950 rounded-lg border border-charcoal-800/80 space-y-1">
              <span className="font-semibold text-charcoal-200 block">⚖️ Model Weights & Licenses</span>
              <p>
                Open-weight models (such as Llama 3.2, Mistral, Qwen) have diverse community and commercial licenses. You retain absolute freedom to swap models anytime.
              </p>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between">
          {saveSuccess && (
            <span className="text-xs text-brand-400 flex items-center gap-1 font-mono">
              <Check className="w-4 h-4" /> Settings updated successfully
            </span>
          )}
          <div className="ml-auto">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-charcoal-950 text-xs font-bold shadow-md transition disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? "Saving Changes..." : "Save Settings"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
