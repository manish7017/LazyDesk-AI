import React, { useState, useEffect } from "react";
import {
  FolderKanban,
  LayoutDashboard,
  FolderTree,
  ListTodo,
  History,
  Settings as SettingsIcon,
  Copy,
  Sun,
  Moon,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { api } from "./services/api";
import type {
  ScanRecord,
  ScannedFile,
  AISuggestion,
  OperationLog,
  DuplicateGroup,
  AppSettings,
  AIProviderStatus,
  AIModelInfo,
} from "@lazydesk/shared";

import { OverviewView } from "./views/OverviewView";
import { FileExplorerView } from "./views/FileExplorerView";
import { CleanupQueueView } from "./views/CleanupQueueView";
import { ScanHistoryView } from "./views/ScanHistoryView";
import { SettingsView } from "./views/SettingsView";

import { FolderPickerModal } from "./components/FolderPickerModal";
import { EditSuggestionModal } from "./components/EditSuggestionModal";
import { PreviewDiffModal } from "./components/PreviewDiffModal";
import { DuplicateInspectionModal } from "./components/DuplicateInspectionModal";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Core Data State
  const [currentScan, setCurrentScan] = useState<ScanRecord | null>(null);
  const [allScans, setAllScans] = useState<ScanRecord[]>([]);
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [operations, setOperations] = useState<OperationLog[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    ollamaBaseUrl: "http://127.0.0.1:11434",
    defaultModel: "llama3.2",
    maxFileSizeMB: 50,
    maxContentSampleChars: 3000,
    confidenceThreshold: 0.75,
    ignoredFolders: ["node_modules", ".git", "dist", "build"],
    allowedExtensions: [".txt", ".md", ".json", ".py", ".ts"],
    skipHiddenFiles: true,
    followSymlinks: false,
    theme: "dark",
    demoMode: false,
  });
  const [aiStatus, setAIStatus] = useState<AIProviderStatus | null>(null);
  const [models, setModels] = useState<AIModelInfo[]>([]);

  // UI & Workflow State
  const [folderPathInput, setFolderPathInput] = useState<string>("test-data");
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Modals
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState(false);
  const [editingSuggestion, setEditingSuggestion] = useState<AISuggestion | null>(null);
  const [previewSuggestions, setPreviewSuggestions] = useState<AISuggestion[] | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const showNotification = (message: string, type: "success" | "error" | "info" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadInitialData = async () => {
    try {
      const [settingsRes, aiRes, scansRes] = await Promise.all([
        api.getSettings().catch(() => null),
        api.getAIStatus().catch(() => null),
        api.getScans().catch(() => ({ scans: [] })),
      ]);

      if (settingsRes?.settings) {
        setSettings(settingsRes.settings);
        applyTheme(settingsRes.settings.theme);
      }

      if (aiRes) {
        setAIStatus(aiRes);
        const modelsRes = await api.getAIModels().catch(() => ({ models: [] }));
        setModels(modelsRes.models);
      }

      if (scansRes?.scans?.length) {
        setAllScans(scansRes.scans);
        // Load latest scan
        const latest = scansRes.scans[0];
        loadScanDetails(latest.id);
      }
    } catch {
      // Graceful fallback
    }
  };

  const loadScanDetails = async (scanId: string) => {
    try {
      const [scanData, suggRes] = await Promise.all([
        api.getScan(scanId),
        api.getSuggestions(scanId),
      ]);
      setCurrentScan(scanData.scan);
      setFiles(scanData.files);
      setDuplicates(scanData.duplicates);
      setSuggestions(suggRes.suggestions);
      setFolderPathInput(scanData.scan.folderPath);
    } catch (err: any) {
      showNotification(`Failed to load scan details: ${err.message}`, "error");
    }
  };

  const applyTheme = (theme: "dark" | "light") => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleStartScan = async (folderPath: string) => {
    setIsScanning(true);
    try {
      const data = await api.startScan(folderPath, {
        skipHiddenFiles: settings.skipHiddenFiles,
        followSymlinks: settings.followSymlinks,
        ignoredFolders: settings.ignoredFolders,
      });

      setCurrentScan(data.scan);
      setFiles(data.files);
      setDuplicates(data.duplicates);
      setSuggestions([]); // New scan starts fresh
      setAllScans((prev) => [data.scan, ...prev.filter((s) => s.id !== data.scan.id)]);

      showNotification(`Scan complete: ${data.files.length} files discovered.`, "success");
    } catch (err: any) {
      showNotification(`Scan failed: ${err.message}`, "error");
      throw err;
    } finally {
      setIsScanning(false);
    }
  };

  const handleTriggerAI = async () => {
    if (!currentScan) return;
    setIsAnalyzing(true);
    try {
      const res = await api.analyzeFiles(currentScan.id, {
        model: settings.defaultModel,
      });
      setSuggestions(res.suggestions);
      showNotification(
        `Generated ${res.suggestions.length} organization suggestions (${res.aiUsed}).`,
        "success"
      );
      setActiveTab("queue");
    } catch (err: any) {
      showNotification(`Analysis failed: ${err.message}`, "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateSuggestion = async (id: string, updates: Partial<AISuggestion>) => {
    try {
      const res = await api.updateSuggestion(id, updates);
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? res.suggestion : s))
      );
      showNotification("Suggestion updated.", "success");
    } catch (err: any) {
      showNotification(`Update failed: ${err.message}`, "error");
    }
  };

  const handleApplySuggestions = async (suggestionIds: string[]) => {
    if (!currentScan) return;
    setIsApplying(true);
    try {
      const res = await api.applySuggestions(currentScan.id, suggestionIds);
      if (res.appliedCount > 0) {
        showNotification(`Successfully organized ${res.appliedCount} file(s)!`, "success");
        // Update local state
        setSuggestions((prev) =>
          prev.map((s) =>
            suggestionIds.includes(s.id) ? { ...s, status: "applied" } : s
          )
        );
        setOperations((prev) => [...res.operations, ...prev]);
        setPreviewSuggestions(null);
      }
      if (res.failedCount > 0) {
        showNotification(
          `${res.failedCount} file(s) skipped due to collision or validation rules.`,
          "error"
        );
      }
    } catch (err: any) {
      showNotification(`Apply failed: ${err.message}`, "error");
    } finally {
      setIsApplying(false);
    }
  };

  const handleUndoOperation = async (opId: string) => {
    try {
      const res = await api.undoOperation(opId);
      showNotification(res.message, "success");
      setOperations((prev) =>
        prev.map((o) => (o.id === opId ? { ...o, status: "rolled_back" } : o))
      );
      if (currentScan) {
        loadScanDetails(currentScan.id);
      }
    } catch (err: any) {
      showNotification(`Undo failed: ${err.message}`, "error");
    }
  };

  const handleDeleteDuplicates = async (filePaths: string[], moveToTrash: boolean) => {
    try {
      const res = await api.deleteDuplicates(filePaths, moveToTrash);
      showNotification(
        `Moved ${res.deletedCount} duplicate file(s) to ${res.trashLocation ? ".lazydesk_trash/" : "trash"
        }.`,
        "success"
      );
      // Refresh scan
      if (currentScan) {
        loadScanDetails(currentScan.id);
      }
    } catch (err: any) {
      showNotification(`Duplicate deletion failed: ${err.message}`, "error");
      throw err;
    }
  };

  const handleLoadDemoMode = async () => {
    try {
      await api.seedDemoFiles();
      const res = await api.seedDemoDatabase();
      setSettings((prev) => ({ ...prev, demoMode: true }));
      setCurrentScan(res.scan);
      await loadScanDetails(res.scan.id);
      showNotification("Realistic Demo Mode activated!", "success");
    } catch (err: any) {
      showNotification(`Demo mode load error: ${err.message}`, "error");
    }
  };

  const handleSaveSettings = async (updates: Partial<AppSettings>) => {
    try {
      const res = await api.updateSettings(updates);
      setSettings(res.settings);
      applyTheme(res.settings.theme);
      showNotification("Settings saved.", "success");
    } catch (err: any) {
      showNotification(`Failed to save settings: ${err.message}`, "error");
    }
  };

  const pendingCount = suggestions.filter((s) => s.status === "pending").length;
  const duplicateFilesCount = duplicates.reduce((acc, g) => acc + (g.totalCopies - 1), 0);

  return (
    <div className="min-h-screen bg-charcoal-950 text-charcoal-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-charcoal-900/90 backdrop-blur-md border-b border-charcoal-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Hacktoberfest Badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 shadow-sm">
                <FolderKanban className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold tracking-tight text-white">
                    LazyDesk AI
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-[10px] font-mono font-semibold">
                    v1.0.0
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Navigation Tabs (5 Views) */}
          <nav className="hidden md:flex items-center gap-1 bg-charcoal-950 p-1 rounded-xl border border-charcoal-800 text-xs">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${activeTab === "overview"
                  ? "bg-charcoal-800 text-brand-300 shadow-sm"
                  : "text-charcoal-400 hover:text-charcoal-200"
                }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab("explorer")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${activeTab === "explorer"
                  ? "bg-charcoal-800 text-brand-300 shadow-sm"
                  : "text-charcoal-400 hover:text-charcoal-200"
                }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>File Explorer</span>
            </button>

            <button
              onClick={() => setActiveTab("queue")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition relative ${activeTab === "queue"
                  ? "bg-charcoal-800 text-brand-300 shadow-sm"
                  : "text-charcoal-400 hover:text-charcoal-200"
                }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              <span>Cleanup Queue</span>
              {pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-brand-500/20 text-brand-400 text-[10px] font-mono font-bold">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${activeTab === "history"
                  ? "bg-charcoal-800 text-brand-300 shadow-sm"
                  : "text-charcoal-400 hover:text-charcoal-200"
                }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Scan History</span>
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${activeTab === "settings"
                  ? "bg-charcoal-800 text-brand-300 shadow-sm"
                  : "text-charcoal-400 hover:text-charcoal-200"
                }`}
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </nav>

          {/* Right Action Widgets */}
          <div className="flex items-center gap-2.5">
            {/* Duplicates Quick Button */}
            <button
              onClick={() => setIsDuplicatesModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-charcoal-700 bg-charcoal-850 hover:bg-charcoal-800 text-xs text-charcoal-300 font-medium transition"
              title="Inspect exact duplicate files"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Duplicates</span>
              {duplicateFilesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                  {duplicateFilesCount}
                </span>
              )}
            </button>

            {/* AI Status Indicator Pill */}
            <div
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono ${aiStatus?.isAvailable
                  ? "border-brand-500/30 bg-brand-500/10 text-brand-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                }`}
              title={
                aiStatus?.isAvailable
                  ? `Ollama connected: ${aiStatus.defaultModel}`
                  : "Ollama offline. Rule-based categorization active."
              }
            >
              <span className={`w-2 h-2 rounded-full ${aiStatus?.isAvailable ? "bg-brand-400 animate-pulse" : "bg-amber-400"}`} />
              <span>{aiStatus?.isAvailable ? "Ollama Active" : "Rule Fallback"}</span>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => {
                const next = settings.theme === "dark" ? "light" : "dark";
                setSettings({ ...settings, theme: next });
                applyTheme(next);
                api.updateSettings({ theme: next }).catch(() => { });
              }}
              className="p-2 rounded-lg border border-charcoal-700 bg-charcoal-850 hover:bg-charcoal-800 text-charcoal-400 hover:text-charcoal-200 transition"
              title="Toggle Dark / Light Theme"
            >
              {settings.theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="md:hidden flex items-center justify-around px-2 py-2 border-t border-charcoal-800 bg-charcoal-900 text-xs">
          <button
            onClick={() => setActiveTab("overview")}
            className={`p-2 rounded-lg ${activeTab === "overview" ? "text-brand-300" : "text-charcoal-400"}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("explorer")}
            className={`p-2 rounded-lg ${activeTab === "explorer" ? "text-brand-300" : "text-charcoal-400"}`}
          >
            Explorer
          </button>
          <button
            onClick={() => setActiveTab("queue")}
            className={`p-2 rounded-lg relative ${activeTab === "queue" ? "text-brand-300" : "text-charcoal-400"}`}
          >
            Queue {pendingCount > 0 && `(${pendingCount})`}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`p-2 rounded-lg ${activeTab === "history" ? "text-brand-300" : "text-charcoal-400"}`}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`p-2 rounded-lg ${activeTab === "settings" ? "text-brand-300" : "text-charcoal-400"}`}
          >
            Settings
          </button>
        </div>
      </header>

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-xl text-xs font-medium ${notification.type === "success"
                ? "bg-charcoal-900 border-brand-500/40 text-brand-300"
                : notification.type === "error"
                  ? "bg-charcoal-900 border-red-500/40 text-red-300"
                  : "bg-charcoal-900 border-charcoal-700 text-charcoal-200"
              }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "overview" && (
          <OverviewView
            currentScan={currentScan}
            files={files}
            suggestions={suggestions}
            duplicates={duplicates}
            operations={operations}
            aiStatus={aiStatus}
            demoMode={settings.demoMode}
            onOpenFolderPicker={() => setIsFolderPickerOpen(true)}
            onStartScan={handleStartScan}
            onTriggerAI={handleTriggerAI}
            onNavigateToTab={setActiveTab}
            onUndoOperation={handleUndoOperation}
            onLoadDemoMode={handleLoadDemoMode}
            folderPathInput={folderPathInput}
            setFolderPathInput={setFolderPathInput}
            isScanning={isScanning}
            isAnalyzing={isAnalyzing}
          />
        )}

        {activeTab === "explorer" && (
          <FileExplorerView
            files={files}
            duplicates={duplicates}
            workspaceRoot={currentScan?.folderPath}
          />
        )}

        {activeTab === "queue" && (
          <CleanupQueueView
            suggestions={suggestions}
            scanId={currentScan?.id}
            onUpdateSuggestion={handleUpdateSuggestion}
            onApplySuggestions={handleApplySuggestions}
            onTriggerPreview={(items) => setPreviewSuggestions(items)}
            onEditSuggestion={(s) => setEditingSuggestion(s)}
            isApplying={isApplying}
          />
        )}

        {activeTab === "history" && (
          <ScanHistoryView
            scans={allScans}
            operations={operations}
            onRollback={handleUndoOperation}
            onSelectScan={loadScanDetails}
          />
        )}

        {activeTab === "settings" && (
          <SettingsView
            settings={settings}
            aiStatus={aiStatus}
            models={models}
            onSaveSettings={handleSaveSettings}
            onTestAI={api.testAIConnection}
            onThemeToggle={applyTheme}
            onDemoModeToggle={async (enabled) => {
              if (enabled) {
                await handleLoadDemoMode();
              } else {
                await handleSaveSettings({ demoMode: false });
              }
            }}
          />
        )}
      </main>

      {/* Modals */}
      <FolderPickerModal
        isOpen={isFolderPickerOpen}
        onClose={() => setIsFolderPickerOpen(false)}
        onSelect={(path) => setFolderPathInput(path)}
        initialPath={folderPathInput}
      />

      <EditSuggestionModal
        suggestion={editingSuggestion}
        isOpen={Boolean(editingSuggestion)}
        onClose={() => setEditingSuggestion(null)}
        onSave={handleUpdateSuggestion}
      />

      <PreviewDiffModal
        isOpen={Boolean(previewSuggestions)}
        onClose={() => setPreviewSuggestions(null)}
        suggestions={previewSuggestions || []}
        onConfirmApply={() => {
          if (previewSuggestions) {
            handleApplySuggestions(previewSuggestions.filter((s) => s.validationStatus === "valid").map((s) => s.id));
          }
        }}
        isApplying={isApplying}
      />

      <DuplicateInspectionModal
        isOpen={isDuplicatesModalOpen}
        onClose={() => setIsDuplicatesModalOpen(false)}
        duplicates={duplicates}
        onDeleteSelected={handleDeleteDuplicates}
      />
    </div>
  );
};
