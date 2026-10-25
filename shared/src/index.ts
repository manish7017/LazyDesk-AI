import { z } from "zod";

// ==========================================
// AI SUGGESTION SCHEMA & TYPES
// ==========================================

export const AISuggestionSchema = z.object({
  category: z.string().min(1).max(100),
  suggestedName: z.string().min(1).max(255),
  destinationFolder: z.string().min(1).max(255),
  reason: z.string().min(1).max(1000),
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
});

export type AISuggestionOutput = z.infer<typeof AISuggestionSchema>;

export type SuggestionStatus = "pending" | "approved" | "rejected" | "applied";

export type ValidationStatus = "valid" | "collision" | "out_of_bounds" | "already_exists" | "invalid_name";

export interface AISuggestion {
  id: string;
  fileId: string;
  scanId: string;
  originalPath: string;
  originalFilename: string;
  category: string;
  suggestedName: string;
  destinationFolder: string;
  targetPath: string;
  reason: string;
  confidence: number;
  needsReview: boolean;
  status: SuggestionStatus;
  validationStatus: ValidationStatus;
  validationMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// FILE & SCAN METADATA TYPES
// ==========================================

export interface ScannedFile {
  id: string;
  scanId: string;
  relativePath: string;
  absolutePath: string;
  filename: string;
  extension: string;
  size: number;
  modifiedAt: string;
  mimeType: string;
  sha256Hash: string;
  isSupported: boolean;
  contentSample?: string;
  status: "scanned" | "analyzed" | "organized" | "ignored" | "unsupported";
}

export interface ScanRecord {
  id: string;
  folderPath: string;
  status: "running" | "completed" | "failed";
  totalFiles: number;
  supportedFiles: number;
  duplicateCount: number;
  duplicateBytes: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface DuplicateGroup {
  sha256Hash: string;
  size: number;
  totalCopies: number;
  files: ScannedFile[];
}

// ==========================================
// OPERATION JOURNAL & ROLLBACK
// ==========================================

export type OperationType = "move" | "rename" | "delete";
export type OperationStatus = "applied" | "rolled_back" | "failed";

export interface OperationLog {
  id: string;
  scanId: string;
  suggestionId?: string;
  operationType: OperationType;
  sourcePath: string;
  targetPath?: string;
  appliedAt: string;
  rolledBackAt?: string;
  status: OperationStatus;
  error?: string;
}

// ==========================================
// APP SETTINGS SCHEMA & TYPES
// ==========================================

export interface AppSettings {
  id?: number;
  ollamaBaseUrl: string;
  defaultModel: string;
  maxFileSizeMB: number;
  maxContentSampleChars: number;
  confidenceThreshold: number;
  ignoredFolders: string[];
  allowedExtensions: string[];
  skipHiddenFiles: boolean;
  followSymlinks: boolean;
  theme: "dark" | "light";
  demoMode: boolean;
}

export const UpdateSettingsSchema = z.object({
  ollamaBaseUrl: z.string().url().optional(),
  defaultModel: z.string().min(1).optional(),
  maxFileSizeMB: z.number().positive().max(500).optional(),
  maxContentSampleChars: z.number().positive().max(50000).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  ignoredFolders: z.array(z.string()).optional(),
  allowedExtensions: z.array(z.string()).optional(),
  skipHiddenFiles: z.boolean().optional(),
  followSymlinks: z.boolean().optional(),
  theme: z.enum(["dark", "light"]).optional(),
  demoMode: z.boolean().optional(),
});

export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;

// ==========================================
// API REQUEST & RESPONSE SCHEMAS
// ==========================================

export const ScanRequestSchema = z.object({
  folderPath: z.string().min(1, "Folder path is required"),
  skipHiddenFiles: z.boolean().optional().default(true),
  followSymlinks: z.boolean().optional().default(false),
  ignoredFolders: z.array(z.string()).optional(),
});
export type ScanRequestInput = z.infer<typeof ScanRequestSchema>;

export const AnalyzeRequestSchema = z.object({
  scanId: z.string().uuid("Valid scan ID required"),
  model: z.string().optional(),
  fileIds: z.array(z.string()).optional(),
  forceReanalyze: z.boolean().optional().default(false),
});
export type AnalyzeRequestInput = z.infer<typeof AnalyzeRequestSchema>;

export const UpdateSuggestionSchema = z.object({
  suggestedName: z.string().min(1).max(255).optional(),
  destinationFolder: z.string().min(1).max(255).optional(),
  category: z.string().min(1).max(100).optional(),
  status: z.enum(["pending", "approved", "rejected", "applied"]).optional(),
});
export type UpdateSuggestionInput = z.infer<typeof UpdateSuggestionSchema>;

export const ApplyOperationsSchema = z.object({
  scanId: z.string().uuid("Valid scan ID required"),
  suggestionIds: z.array(z.string()).min(1, "At least one suggestion must be provided"),
  dryRun: z.boolean().optional().default(false),
});
export type ApplyOperationsInput = z.infer<typeof ApplyOperationsSchema>;

export const RollbackRequestSchema = z.object({
  operationId: z.string().min(1, "Operation ID is required"),
});
export type RollbackRequestInput = z.infer<typeof RollbackRequestSchema>;

export const DeleteDuplicatesSchema = z.object({
  filePaths: z.array(z.string()).min(1, "At least one file path must be provided"),
  moveToTrash: z.boolean().optional().default(true),
});
export type DeleteDuplicatesInput = z.infer<typeof DeleteDuplicatesSchema>;

// ==========================================
// AI PROVIDER TYPES
// ==========================================

export interface AIProviderStatus {
  isAvailable: boolean;
  provider: string;
  endpoint: string;
  defaultModel: string;
  installedModels: string[];
  latencyMs?: number;
  message?: string;
}

export interface AIModelInfo {
  name: string;
  size?: number;
  modifiedAt?: string;
  family?: string;
  parameterSize?: string;
}

export interface FileAnalysisParams {
  filename: string;
  extension: string;
  relativePath: string;
  fileSize: number;
  contentSample: string;
  existingCategories?: string[];
}
