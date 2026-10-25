import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import type {
  AppSettings,
  ScanRecord,
  ScannedFile,
  AISuggestion,
  OperationLog,
  DuplicateGroup,
} from "@lazydesk/shared";

let dbInstance: Database.Database | null = null;

export function getDatabase(dbPath?: string): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const targetPath =
    dbPath ||
    process.env.DATABASE_PATH ||
    path.join(process.cwd(), "lazydesk.sqlite");

  if (targetPath !== ":memory:") {
    const dir = path.dirname(path.resolve(targetPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  dbInstance = new Database(targetPath);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");

  initializeSchema(dbInstance);
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      folder_path TEXT NOT NULL,
      status TEXT NOT NULL,
      total_files INTEGER DEFAULT 0,
      supported_files INTEGER DEFAULT 0,
      duplicate_count INTEGER DEFAULT 0,
      duplicate_bytes INTEGER DEFAULT 0,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS scanned_files (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      absolute_path TEXT NOT NULL,
      filename TEXT NOT NULL,
      extension TEXT NOT NULL,
      size INTEGER NOT NULL,
      modified_at TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      sha256_hash TEXT NOT NULL,
      is_supported INTEGER NOT NULL DEFAULT 1,
      content_sample TEXT,
      status TEXT NOT NULL DEFAULT 'scanned',
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_scanned_files_scan_id ON scanned_files(scan_id);
    CREATE INDEX IF NOT EXISTS idx_scanned_files_hash ON scanned_files(sha256_hash);

    CREATE TABLE IF NOT EXISTS ai_suggestions (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      scan_id TEXT NOT NULL,
      original_path TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      category TEXT NOT NULL,
      suggested_name TEXT NOT NULL,
      destination_folder TEXT NOT NULL,
      target_path TEXT NOT NULL,
      reason TEXT NOT NULL,
      confidence REAL NOT NULL,
      needs_review INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      validation_status TEXT NOT NULL DEFAULT 'valid',
      validation_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (file_id) REFERENCES scanned_files(id) ON DELETE CASCADE,
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_suggestions_scan_id ON ai_suggestions(scan_id);
    CREATE INDEX IF NOT EXISTS idx_suggestions_status ON ai_suggestions(status);

    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      suggestion_id TEXT,
      operation_type TEXT NOT NULL,
      source_path TEXT NOT NULL,
      target_path TEXT,
      applied_at TEXT NOT NULL,
      rolled_back_at TEXT,
      status TEXT NOT NULL DEFAULT 'applied',
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_op_logs_scan_id ON operation_logs(scan_id);

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      ollama_base_url TEXT NOT NULL DEFAULT 'http://127.0.0.1:11434',
      default_model TEXT NOT NULL DEFAULT 'llama3.2',
      max_file_size_mb REAL NOT NULL DEFAULT 50,
      max_content_sample_chars INTEGER NOT NULL DEFAULT 3000,
      confidence_threshold REAL NOT NULL DEFAULT 0.75,
      ignored_folders TEXT NOT NULL DEFAULT '["node_modules",".git","dist","build",".cache",".next","coverage",".DS_Store"]',
      allowed_extensions TEXT NOT NULL DEFAULT '[".txt",".md",".markdown",".pdf",".json",".js",".ts",".jsx",".tsx",".py",".html",".css",".csv",".xlsx",".xlsb",".xls",".ods",".xml",".yaml",".yml",".sh",".png",".jpg",".jpeg",".webp",".svg"]',
      skip_hidden_files INTEGER NOT NULL DEFAULT 1,
      follow_symlinks INTEGER NOT NULL DEFAULT 0,
      theme TEXT NOT NULL DEFAULT 'dark',
      demo_mode INTEGER NOT NULL DEFAULT 0
    );

    INSERT OR IGNORE INTO app_settings (id) VALUES (1);
  `);
}

// ==========================================
// DB HELPER FUNCTIONS
// ==========================================

export function getSettings(): AppSettings {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM app_settings WHERE id = 1").get() as any;
  if (!row) {
    return {
      ollamaBaseUrl: "http://127.0.0.1:11434",
      defaultModel: "llama3.2",
      maxFileSizeMB: 50,
      maxContentSampleChars: 3000,
      confidenceThreshold: 0.75,
      ignoredFolders: ["node_modules", ".git", "dist", "build", ".cache", ".next", "coverage", ".DS_Store"],
      allowedExtensions: [".txt", ".md", ".markdown", ".pdf", ".json", ".js", ".ts", ".jsx", ".tsx", ".py", ".html", ".css", ".csv", ".xlsx", ".xlsb", ".xls", ".ods", ".xml", ".yaml", ".yml", ".sh", ".png", ".jpg", ".jpeg", ".webp", ".svg"],
      skipHiddenFiles: true,
      followSymlinks: false,
      theme: "dark",
      demoMode: false,
    };
  }

  return {
    ollamaBaseUrl: row.ollama_base_url,
    defaultModel: row.default_model,
    maxFileSizeMB: Number(row.max_file_size_mb),
    maxContentSampleChars: Number(row.max_content_sample_chars),
    confidenceThreshold: Number(row.confidence_threshold),
    ignoredFolders: JSON.parse(row.ignored_folders || "[]"),
    allowedExtensions: JSON.parse(row.allowed_extensions || "[]"),
    skipHiddenFiles: Boolean(row.skip_hidden_files),
    followSymlinks: Boolean(row.follow_symlinks),
    theme: row.theme as "dark" | "light",
    demoMode: Boolean(row.demo_mode),
  };
}

export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  const db = getDatabase();
  const current = getSettings();
  const updated: AppSettings = { ...current, ...updates };

  db.prepare(`
    UPDATE app_settings SET
      ollama_base_url = ?,
      default_model = ?,
      max_file_size_mb = ?,
      max_content_sample_chars = ?,
      confidence_threshold = ?,
      ignored_folders = ?,
      allowed_extensions = ?,
      skip_hidden_files = ?,
      follow_symlinks = ?,
      theme = ?,
      demo_mode = ?
    WHERE id = 1
  `).run(
    updated.ollamaBaseUrl,
    updated.defaultModel,
    updated.maxFileSizeMB,
    updated.maxContentSampleChars,
    updated.confidenceThreshold,
    JSON.stringify(updated.ignoredFolders),
    JSON.stringify(updated.allowedExtensions),
    updated.skipHiddenFiles ? 1 : 0,
    updated.followSymlinks ? 1 : 0,
    updated.theme,
    updated.demoMode ? 1 : 0
  );

  return updated;
}

export function insertScan(scan: ScanRecord): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO scans (id, folder_path, status, total_files, supported_files, duplicate_count, duplicate_bytes, started_at, completed_at, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    scan.id,
    scan.folderPath,
    scan.status,
    scan.totalFiles,
    scan.supportedFiles,
    scan.duplicateCount,
    scan.duplicateBytes,
    scan.startedAt,
    scan.completedAt || null,
    scan.errorMessage || null
  );
}

export function updateScanRecord(scan: Partial<ScanRecord> & { id: string }): void {
  const db = getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (scan.status !== undefined) {
    fields.push("status = ?");
    values.push(scan.status);
  }
  if (scan.totalFiles !== undefined) {
    fields.push("total_files = ?");
    values.push(scan.totalFiles);
  }
  if (scan.supportedFiles !== undefined) {
    fields.push("supported_files = ?");
    values.push(scan.supportedFiles);
  }
  if (scan.duplicateCount !== undefined) {
    fields.push("duplicate_count = ?");
    values.push(scan.duplicateCount);
  }
  if (scan.duplicateBytes !== undefined) {
    fields.push("duplicate_bytes = ?");
    values.push(scan.duplicateBytes);
  }
  if (scan.completedAt !== undefined) {
    fields.push("completed_at = ?");
    values.push(scan.completedAt);
  }
  if (scan.errorMessage !== undefined) {
    fields.push("error_message = ?");
    values.push(scan.errorMessage);
  }

  if (fields.length === 0) return;

  values.push(scan.id);
  db.prepare(`UPDATE scans SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export function getScanById(id: string): ScanRecord | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM scans WHERE id = ?").get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    folderPath: row.folder_path,
    status: row.status,
    totalFiles: row.total_files,
    supportedFiles: row.supported_files,
    duplicateCount: row.duplicate_count,
    duplicateBytes: row.duplicate_bytes,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
  };
}

export function getAllScans(): ScanRecord[] {
  const db = getDatabase();
  const rows = db.prepare("SELECT * FROM scans ORDER BY started_at DESC").all() as any[];
  return rows.map((row) => ({
    id: row.id,
    folderPath: row.folder_path,
    status: row.status,
    totalFiles: row.total_files,
    supportedFiles: row.supported_files,
    duplicateCount: row.duplicate_count,
    duplicateBytes: row.duplicate_bytes,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
  }));
}

export function insertScannedFiles(files: ScannedFile[]): void {
  const db = getDatabase();
  const insert = db.prepare(`
    INSERT INTO scanned_files (
      id, scan_id, relative_path, absolute_path, filename, extension,
      size, modified_at, mime_type, sha256_hash, is_supported, content_sample, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const runBatch = db.transaction((items: ScannedFile[]) => {
    for (const f of items) {
      insert.run(
        f.id,
        f.scanId,
        f.relativePath,
        f.absolutePath,
        f.filename,
        f.extension,
        f.size,
        f.modifiedAt,
        f.mimeType,
        f.sha256Hash,
        f.isSupported ? 1 : 0,
        f.contentSample || null,
        f.status
      );
    }
  });

  runBatch(files);
}

export function getScannedFiles(scanId: string): ScannedFile[] {
  const db = getDatabase();
  const rows = db.prepare("SELECT * FROM scanned_files WHERE scan_id = ? ORDER BY relative_path ASC").all(scanId) as any[];
  return rows.map((r) => ({
    id: r.id,
    scanId: r.scan_id,
    relativePath: r.relative_path,
    absolutePath: r.absolute_path,
    filename: r.filename,
    extension: r.extension,
    size: r.size,
    modifiedAt: r.modified_at,
    mimeType: r.mime_type,
    sha256Hash: r.sha256_hash,
    isSupported: Boolean(r.is_supported),
    contentSample: r.content_sample || undefined,
    status: r.status,
  }));
}

export function insertSuggestions(suggestions: AISuggestion[]): void {
  const db = getDatabase();
  const insert = db.prepare(`
    INSERT INTO ai_suggestions (
      id, file_id, scan_id, original_path, original_filename,
      category, suggested_name, destination_folder, target_path,
      reason, confidence, needs_review, status, validation_status,
      validation_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const runBatch = db.transaction((items: AISuggestion[]) => {
    for (const s of items) {
      insert.run(
        s.id,
        s.fileId,
        s.scanId,
        s.originalPath,
        s.originalFilename,
        s.category,
        s.suggestedName,
        s.destinationFolder,
        s.targetPath,
        s.reason,
        s.confidence,
        s.needsReview ? 1 : 0,
        s.status,
        s.validationStatus,
        s.validationMessage || null,
        s.createdAt,
        s.updatedAt
      );
    }
  });

  runBatch(suggestions);
}

export function getSuggestions(scanId?: string): AISuggestion[] {
  const db = getDatabase();
  let rows: any[];
  if (scanId) {
    rows = db.prepare("SELECT * FROM ai_suggestions WHERE scan_id = ? ORDER BY created_at DESC").all(scanId) as any[];
  } else {
    rows = db.prepare("SELECT * FROM ai_suggestions ORDER BY created_at DESC").all() as any[];
  }

  return rows.map((r) => ({
    id: r.id,
    fileId: r.file_id,
    scanId: r.scan_id,
    originalPath: r.original_path,
    originalFilename: r.original_filename,
    category: r.category,
    suggestedName: r.suggested_name,
    destinationFolder: r.destination_folder,
    targetPath: r.target_path,
    reason: r.reason,
    confidence: r.confidence,
    needsReview: Boolean(r.needs_review),
    status: r.status,
    validationStatus: r.validation_status,
    validationMessage: r.validation_message || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function getSuggestionById(id: string): AISuggestion | null {
  const db = getDatabase();
  const r = db.prepare("SELECT * FROM ai_suggestions WHERE id = ?").get(id) as any;
  if (!r) return null;
  return {
    id: r.id,
    fileId: r.file_id,
    scanId: r.scan_id,
    originalPath: r.original_path,
    originalFilename: r.original_filename,
    category: r.category,
    suggestedName: r.suggested_name,
    destinationFolder: r.destination_folder,
    targetPath: r.target_path,
    reason: r.reason,
    confidence: r.confidence,
    needsReview: Boolean(r.needs_review),
    status: r.status,
    validationStatus: r.validation_status,
    validationMessage: r.validation_message || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function updateSuggestion(
  id: string,
  updates: Partial<AISuggestion>
): AISuggestion | null {
  const db = getDatabase();
  const current = getSuggestionById(id);
  if (!current) return null;

  const updated: AISuggestion = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  db.prepare(`
    UPDATE ai_suggestions SET
      category = ?,
      suggested_name = ?,
      destination_folder = ?,
      target_path = ?,
      status = ?,
      validation_status = ?,
      validation_message = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    updated.category,
    updated.suggestedName,
    updated.destinationFolder,
    updated.targetPath,
    updated.status,
    updated.validationStatus,
    updated.validationMessage || null,
    updated.updatedAt,
    id
  );

  return updated;
}

export function insertOperationLog(op: OperationLog): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO operation_logs (
      id, scan_id, suggestion_id, operation_type, source_path,
      target_path, applied_at, rolled_back_at, status, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    op.id,
    op.scanId,
    op.suggestionId || null,
    op.operationType,
    op.sourcePath,
    op.targetPath || null,
    op.appliedAt,
    op.rolledBackAt || null,
    op.status,
    op.error || null
  );
}

export function getOperationLogs(scanId?: string): OperationLog[] {
  const db = getDatabase();
  let rows: any[];
  if (scanId) {
    rows = db.prepare("SELECT * FROM operation_logs WHERE scan_id = ? ORDER BY applied_at DESC").all(scanId) as any[];
  } else {
    rows = db.prepare("SELECT * FROM operation_logs ORDER BY applied_at DESC").all() as any[];
  }

  return rows.map((r) => ({
    id: r.id,
    scanId: r.scan_id,
    suggestionId: r.suggestion_id || undefined,
    operationType: r.operation_type,
    sourcePath: r.source_path,
    targetPath: r.target_path || undefined,
    appliedAt: r.applied_at,
    rolledBackAt: r.rolled_back_at || undefined,
    status: r.status,
    error: r.error || undefined,
  }));
}

export function getOperationLogById(id: string): OperationLog | null {
  const db = getDatabase();
  const r = db.prepare("SELECT * FROM operation_logs WHERE id = ?").get(id) as any;
  if (!r) return null;
  return {
    id: r.id,
    scanId: r.scan_id,
    suggestionId: r.suggestion_id || undefined,
    operationType: r.operation_type,
    sourcePath: r.source_path,
    targetPath: r.target_path || undefined,
    appliedAt: r.applied_at,
    rolledBackAt: r.rolled_back_at || undefined,
    status: r.status,
    error: r.error || undefined,
  };
}

export function updateOperationLog(id: string, updates: Partial<OperationLog>): void {
  const db = getDatabase();
  const current = getOperationLogById(id);
  if (!current) return;

  const updated = { ...current, ...updates };
  db.prepare(`
    UPDATE operation_logs SET
      status = ?,
      rolled_back_at = ?,
      error = ?
    WHERE id = ?
  `).run(updated.status, updated.rolledBackAt || null, updated.error || null, id);
}

export function getDuplicatesByScanId(scanId: string): DuplicateGroup[] {
  const db = getDatabase();
  // Find hashes with count > 1
  const duplicateHashes = db.prepare(`
    SELECT sha256_hash, size, COUNT(*) as count
    FROM scanned_files
    WHERE scan_id = ? AND sha256_hash != ''
    GROUP BY sha256_hash, size
    HAVING count > 1
    ORDER BY (size * count) DESC
  `).all(scanId) as any[];

  const groups: DuplicateGroup[] = [];

  for (const dh of duplicateHashes) {
    const files = db.prepare(`
      SELECT * FROM scanned_files
      WHERE scan_id = ? AND sha256_hash = ?
      ORDER BY relative_path ASC
    `).all(scanId, dh.sha256_hash) as any[];

    groups.push({
      sha256Hash: dh.sha256_hash,
      size: dh.size,
      totalCopies: dh.count,
      files: files.map((r) => ({
        id: r.id,
        scanId: r.scan_id,
        relativePath: r.relative_path,
        absolutePath: r.absolute_path,
        filename: r.filename,
        extension: r.extension,
        size: r.size,
        modifiedAt: r.modified_at,
        mimeType: r.mime_type,
        sha256Hash: r.sha256_hash,
        isSupported: Boolean(r.is_supported),
        contentSample: r.content_sample || undefined,
        status: r.status,
      })),
    });
  }

  return groups;
}

export function getAllDuplicates(): DuplicateGroup[] {
  const db = getDatabase();
  const latestScan = db.prepare("SELECT id FROM scans ORDER BY started_at DESC LIMIT 1").get() as any;
  if (!latestScan) return [];
  return getDuplicatesByScanId(latestScan.id);
}
