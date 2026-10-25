import React, { useState } from "react";
import {
  FolderSearch,
  CheckCircle,
  Copy,
  Clock,
  Sparkles,
  ArrowRight,
  Folder,
  Layers,
  RotateCcw,
  AlertTriangle,
  Play,
  Zap,
} from "lucide-react";
import type {
  ScanRecord,
  ScannedFile,
  AISuggestion,
  OperationLog,
  DuplicateGroup,
  AIProviderStatus,
} from "@lazydesk/shared";

interface OverviewViewProps {
  currentScan: ScanRecord | null;
  files: ScannedFile[];
  suggestions: AISuggestion[];
  duplicates: DuplicateGroup[];
  operations: OperationLog[];
  aiStatus: AIProviderStatus | null;
  demoMode: boolean;
  onOpenFolderPicker: () => void;
  onStartScan: (path: string) => Promise<void>;
  onTriggerAI: () => Promise<void>;
  onNavigateToTab: (tab: string) => void;
  onUndoOperation: (opId: string) => Promise<void>;
  onLoadDemoMode: () => Promise<void>;
  folderPathInput: string;
  setFolderPathInput: (path: string) => void;
  isScanning: boolean;
  isAnalyzing: boolean;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  currentScan,
  files,
  suggestions,
  duplicates,
  operations,
  aiStatus,
  demoMode,
  onOpenFolderPicker,
  onStartScan,
  onTriggerAI,
  onNavigateToTab,
  onUndoOperation,
  onLoadDemoMode,
  folderPathInput,
  setFolderPathInput,
  isScanning,
  isAnalyzing,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const appliedCount = suggestions.filter((s) => s.status === "applied").length;

  const duplicateBytes = duplicates.reduce((acc, g) => acc + g.size * (g.totalCopies - 1), 0);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderPathInput.trim()) return;
    setErrorMsg(null);
    try {
      await onStartScan(folderPathInput.trim());
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to start folder scan");
    }
  };

  return (
    <div className="space-y-6">
      {/* Demo Mode Notice Banner */}
      {demoMode && (
        <div className="flex items-center justify-between p-3.5 bg-amber-950/30 border border-amber-800/60 rounded-xl text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-800/80 font-mono text-[10px] uppercase font-bold text-amber-100">
              Demo Mode Active
            </span>
            <span>
              Displaying realistic sample data for Hacktoberfest 2026 showcase. To organize your own local folders, enter or select a real directory path below.
            </span>
          </div>
          <button
            onClick={() => onNavigateToTab("settings")}
            className="underline hover:text-white shrink-0 ml-4 font-medium"
          >
            Manage in Settings
          </button>
        </div>
      )}

      {/* Prominent Scan Action Card */}
      <div className="p-6 bg-charcoal-900 border border-charcoal-800 rounded-xl shadow-lg relative overflow-hidden">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" /> Local-First AI Organization
          </div>
          <h2 className="text-xl font-bold text-charcoal-100 mb-2">
            Automate your digital workspace decluttering.
          </h2>
          <p className="text-xs text-charcoal-400 mb-6 leading-relaxed">
            Scan any directory safely. Your files never leave your machine — Ollama analyzes file content locally, recommends clean taxonomies, and uncovers exact duplicate files.
          </p>

          <form onSubmit={handleScanSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={folderPathInput}
                onChange={(e) => setFolderPathInput(e.target.value)}
                placeholder="/Users/username/Downloads/unorganized-files"
                className="w-full px-4 py-2.5 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs font-mono text-charcoal-100 placeholder:text-charcoal-600 focus:outline-none focus:border-brand-500 transition"
                required
              />
            </div>
            <button
              type="button"
              onClick={onOpenFolderPicker}
              className="px-4 py-2.5 rounded-lg border border-charcoal-700 bg-charcoal-850 hover:bg-charcoal-800 text-charcoal-300 text-xs font-medium transition flex items-center justify-center gap-1.5"
            >
              <Folder className="w-4 h-4 text-brand-400" />
              <span>Browse...</span>
            </button>
            <button
              type="submit"
              disabled={isScanning}
              className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-charcoal-950 text-xs font-bold shadow-md hover:shadow-brand-500/10 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FolderSearch className="w-4 h-4" />
              <span>{isScanning ? "Scanning Folder..." : "Scan Folder"}</span>
            </button>
          </form>

          {errorMsg && (
            <div className="mt-3 flex items-center gap-2 text-xs text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-charcoal-500">
            <span>Quick presets:</span>
            <button
              type="button"
              onClick={() => {
                setFolderPathInput("test-data");
                onStartScan("test-data");
              }}
              className="px-2.5 py-1 rounded bg-charcoal-800 text-charcoal-300 hover:text-brand-300 hover:bg-charcoal-700 transition font-mono text-[11px]"
            >
              📁 test-data (Sample Folder)
            </button>
            <button
              type="button"
              onClick={onLoadDemoMode}
              className="px-2.5 py-1 rounded bg-brand-500/10 text-brand-300 hover:bg-brand-500/20 transition font-mono text-[11px]"
            >
              ⚡ Load 1-Click Interactive Demo
            </button>
          </div>
        </div>
      </div>

      {/* Overview Metric Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Files Scanned */}
        <div className="p-4 bg-charcoal-900 border border-charcoal-800 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-charcoal-400 font-medium">Files Scanned</span>
            <FolderSearch className="w-4 h-4 text-charcoal-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-charcoal-100">
            {currentScan ? currentScan.totalFiles : 0}
          </div>
          <div className="text-[11px] text-charcoal-500 mt-1">
            {files.filter((f) => f.isSupported).length} files supported for AI
          </div>
        </div>

        {/* Stat 2: Files Organized */}
        <div className="p-4 bg-charcoal-900 border border-charcoal-800 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-charcoal-400 font-medium">Files Organized</span>
            <CheckCircle className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-brand-400">
            {appliedCount}
          </div>
          <div className="text-[11px] text-charcoal-500 mt-1">
            {operations.filter((o) => o.status === "applied").length} active operations applied
          </div>
        </div>

        {/* Stat 3: Duplicate Space */}
        <div className="p-4 bg-charcoal-900 border border-charcoal-800 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-charcoal-400 font-medium">Duplicate Space</span>
            <Copy className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-charcoal-100">
            {formatBytes(duplicateBytes)}
          </div>
          <div className="text-[11px] text-charcoal-500 mt-1">
            {duplicates.length} duplicate clusters found
          </div>
        </div>

        {/* Stat 4: Pending AI Cleanup Suggestions */}
        <div className="p-4 bg-charcoal-900 border border-charcoal-800 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-charcoal-400 font-medium">Pending Cleanup</span>
            <Layers className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-charcoal-100">
            {pendingSuggestions.length}
          </div>
          <div className="text-[11px] text-charcoal-500 mt-1">
            Awaiting your approval in Queue
          </div>
        </div>
      </div>

      {/* Main Grid: AI Trigger & Plan Preview + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Proposed Cleanup Plan Preview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-charcoal-100">
                Proposed Cleanup Plan Preview
              </h3>
              <span className="text-xs text-charcoal-500 font-mono">
                ({suggestions.length} items)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {currentScan && suggestions.length === 0 && (
                <button
                  onClick={onTriggerAI}
                  disabled={isAnalyzing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-charcoal-950 text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isAnalyzing ? "Analyzing Files..." : "Generate AI Suggestions"}</span>
                </button>
              )}
              {suggestions.length > 0 && (
                <button
                  onClick={() => onNavigateToTab("queue")}
                  className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition font-medium"
                >
                  <span>Open Full Queue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {suggestions.length === 0 ? (
            <div className="p-8 bg-charcoal-900 border border-charcoal-800 rounded-xl text-center space-y-3">
              <Layers className="w-8 h-8 text-charcoal-600 mx-auto" />
              <div className="text-xs text-charcoal-400">
                {currentScan
                  ? "Scan complete. Click 'Generate AI Suggestions' to analyze file content and propose organization categories."
                  : "No active scan. Enter a folder path above or choose a preset to start organizing."}
              </div>
              {currentScan && (
                <button
                  onClick={onTriggerAI}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-charcoal-950 text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{isAnalyzing ? "Running Local AI..." : "Analyze with Local AI"}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-charcoal-900 border border-charcoal-800 rounded-xl overflow-hidden divide-y divide-charcoal-800/80">
              {suggestions.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="p-3.5 flex items-center justify-between text-xs hover:bg-charcoal-850/60 transition"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-charcoal-800 text-charcoal-300 font-mono text-[10px] uppercase">
                        {s.category}
                      </span>
                      <span className="text-charcoal-200 font-mono font-medium truncate">
                        {s.suggestedName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-charcoal-500 truncate font-mono">
                      <span className="line-through text-charcoal-600">{s.originalFilename}</span>
                      <ArrowRight className="w-3 h-3 shrink-0 text-charcoal-600" />
                      <span className="text-brand-400/90 truncate">{s.destinationFolder || "."}/</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-[11px] text-charcoal-500">
                      {(s.confidence * 100).toFixed(0)}%
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                        s.status === "applied"
                          ? "bg-brand-500/10 text-brand-400"
                          : "bg-charcoal-800 text-charcoal-400"
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                </div>
              ))}

              {suggestions.length > 5 && (
                <div className="p-3 bg-charcoal-950/60 text-center">
                  <button
                    onClick={() => onNavigateToTab("queue")}
                    className="text-xs text-brand-400 hover:text-brand-300 font-medium transition"
                  >
                    + View remaining {suggestions.length - 5} items in Cleanup Queue
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Col: Ollama AI Status Widget & Recent Activity */}
        <div className="space-y-6">
          {/* Local AI Engine Status */}
          <div className="p-4 bg-charcoal-900 border border-charcoal-800 rounded-xl text-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-charcoal-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-400" /> Local AI Engine
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                  aiStatus?.isAvailable
                    ? "bg-brand-500/15 text-brand-400 border border-brand-500/30"
                    : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                }`}
              >
                {aiStatus?.isAvailable ? "Ollama Online" : "Rule Fallback"}
              </span>
            </div>

            <div className="space-y-1.5 text-charcoal-400 font-mono text-[11px]">
              <div className="flex justify-between">
                <span>Provider:</span>
                <span className="text-charcoal-200">{aiStatus?.provider || "Ollama"}</span>
              </div>
              <div className="flex justify-between">
                <span>Model:</span>
                <span className="text-charcoal-200">{aiStatus?.defaultModel || "llama3.2"}</span>
              </div>
              <div className="flex justify-between">
                <span>Local Models:</span>
                <span className="text-charcoal-200">
                  {aiStatus?.installedModels?.length || 0} installed
                </span>
              </div>
            </div>

            {!aiStatus?.isAvailable && (
              <div className="p-2.5 bg-amber-950/30 border border-amber-800/40 rounded-lg text-amber-300 text-[11px]">
                Ollama server is offline. Safe rule-based organization engine is handling taxonomies. Run <code className="text-white">ollama serve</code> to activate LLM reasoning.
              </div>
            )}
          </div>

          {/* Recent Operations Activity */}
          <div className="p-4 bg-charcoal-900 border border-charcoal-800 rounded-xl text-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-charcoal-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-charcoal-400" /> Recent Activity
              </span>
              <span className="text-[11px] text-charcoal-500 font-mono">
                {operations.length} logged
              </span>
            </div>

            {operations.length === 0 ? (
              <div className="py-6 text-center text-charcoal-500 text-xs">
                No file operations applied yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {operations.slice(0, 5).map((op) => (
                  <div
                    key={op.id}
                    className="p-2.5 bg-charcoal-850 rounded-lg border border-charcoal-800/80 flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-mono text-charcoal-200 text-[11px] truncate">
                        {op.targetPath?.split(/[/\\]/).pop() || op.sourcePath.split(/[/\\]/).pop()}
                      </div>
                      <div className="text-[10px] text-charcoal-500 capitalize">
                        Status: {op.status.replace("_", " ")}
                      </div>
                    </div>
                    {op.status === "applied" && (
                      <button
                        onClick={() => onUndoOperation(op.id)}
                        className="px-2 py-1 rounded bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 text-[10px] font-mono flex items-center gap-1 transition shrink-0"
                        title="Rollback this operation"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Undo</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
