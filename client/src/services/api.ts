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

const API_BASE = "/api";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.error || data.message || `Request failed (${res.status})`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // Health & AI
  getHealth: () => request<{ status: string; service: string; version: string }>("/health"),
  getAIStatus: () => request<AIProviderStatus & { instructions: { title: string; steps: string[] } }>("/ai/status"),
  getAIModels: () => request<{ models: AIModelInfo[] }>("/ai/models"),
  testAIConnection: () => request<{ ok: boolean; message: string; latencyMs?: number }>("/ai/test", { method: "POST" }),

  // Scanning
  startScan: (folderPath: string, options?: { skipHiddenFiles?: boolean; followSymlinks?: boolean; ignoredFolders?: string[] }) =>
    request<{ scan: ScanRecord; files: ScannedFile[]; duplicates: DuplicateGroup[] }>("/scan", {
      method: "POST",
      body: JSON.stringify({ folderPath, ...options }),
    }),
  getScans: () => request<{ scans: ScanRecord[] }>("/scans"),
  getScan: (id: string) =>
    request<{ scan: ScanRecord; files: ScannedFile[]; duplicates: DuplicateGroup[] }>(`/scans/${id}`),

  // Organization & AI
  analyzeFiles: (scanId: string, options?: { model?: string; fileIds?: string[]; forceReanalyze?: boolean }) =>
    request<{
      scanId: string;
      totalAnalyzed: number;
      suggestions: AISuggestion[];
      aiUsed: string;
    }>("/organize/analyze", {
      method: "POST",
      body: JSON.stringify({ scanId, ...options }),
    }),
  getSuggestions: (scanId?: string) =>
    request<{ suggestions: AISuggestion[] }>(`/organize/suggestions${scanId ? `?scanId=${scanId}` : ""}`),
  updateSuggestion: (id: string, updates: Partial<AISuggestion>) =>
    request<{ suggestion: AISuggestion }>(`/organize/suggestions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),
  applySuggestions: (scanId: string, suggestionIds: string[], dryRun = false) =>
    request<{
      scanId: string;
      appliedCount: number;
      failedCount: number;
      operations: OperationLog[];
      errors: { id: string; error: string }[];
    }>("/organize/apply", {
      method: "POST",
      body: JSON.stringify({ scanId, suggestionIds, dryRun }),
    }),
  undoOperation: (operationId: string) =>
    request<{
      success: boolean;
      operationId: string;
      sourceRestored: string;
      message: string;
    }>("/organize/undo", {
      method: "POST",
      body: JSON.stringify({ operationId }),
    }),

  // Duplicates
  getDuplicates: (scanId?: string) =>
    request<{ duplicates: DuplicateGroup[] }>(`/duplicates${scanId ? `?scanId=${scanId}` : ""}`),
  deleteDuplicates: (filePaths: string[], moveToTrash = true) =>
    request<{
      deletedCount: number;
      failedCount: number;
      deleted: string[];
      errors: { path: string; error: string }[];
      trashLocation: string | null;
    }>("/duplicates/delete", {
      method: "POST",
      body: JSON.stringify({ filePaths, moveToTrash }),
    }),

  // Settings
  getSettings: () => request<{ settings: AppSettings }>("/settings"),
  updateSettings: (updates: Partial<AppSettings>) =>
    request<{ settings: AppSettings }>("/settings", {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),

  // Directory Browser
  browseDirectory: (dir?: string) =>
    request<{
      currentPath: string;
      parentPath: string | null;
      subdirectories: { name: string; path: string }[];
      quickBookmarks: { name: string; path: string }[];
    }>(`/browse${dir ? `?dir=${encodeURIComponent(dir)}` : ""}`),

  // Demo helpers
  seedDemoFiles: () =>
    request<{ message: string; folderPath: string; fileCount: number }>("/demo/seed-files", {
      method: "POST",
    }),
  seedDemoDatabase: () =>
    request<{ message: string; scan: ScanRecord; filesCount: number; suggestionsCount: number }>(
      "/demo/seed-db",
      { method: "POST" }
    ),
};
