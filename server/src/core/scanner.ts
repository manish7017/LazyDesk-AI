import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { ScannedFile, ScanRecord } from "@lazydesk/shared";
import { isWithinBoundary, isProtectedSystemPath } from "./safety.js";
import { computeFileHash } from "./hasher.js";
import { extractFileSample, getMimeType } from "./extractor.js";

export interface ScanOptions {
  skipHiddenFiles?: boolean;
  followSymlinks?: boolean;
  ignoredFolders?: string[];
  maxFileSizeMB?: number;
  maxContentSampleChars?: number;
  onProgress?: (scannedCount: number, currentPath: string) => void;
}

const DEFAULT_IGNORED = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  ".cache",
  ".next",
  ".nuxt",
  "coverage",
  ".DS_Store",
  "Thumbs.db",
  ".lazydesk_trash",
]);

const IGNORED_FILE_EXTENSIONS = new Set([
  ".sqlite",
  ".sqlite3",
  ".db",
  ".db-wal",
  ".db-shm",
  ".sqlite-wal",
  ".sqlite-shm",
  ".db-journal",
  ".sqlite-journal",
]);

export async function scanDirectory(
  targetDir: string,
  scanId: string,
  options: ScanOptions = {}
): Promise<{ scan: ScanRecord; files: ScannedFile[] }> {
  const resolvedRoot = path.resolve(targetDir);

  // Safety checks
  if (!fs.existsSync(resolvedRoot)) {
    throw new Error(`Directory does not exist: ${targetDir}`);
  }

  const stat = fs.statSync(resolvedRoot);
  if (!stat.isDirectory()) {
    throw new Error(`Target path is not a directory: ${targetDir}`);
  }

  if (isProtectedSystemPath(resolvedRoot)) {
    throw new Error(`Refusing to scan protected root filesystem path: ${resolvedRoot}`);
  }

  const skipHidden = options.skipHiddenFiles ?? true;
  const followSymlinks = options.followSymlinks ?? false;
  const ignored = new Set([
    ...DEFAULT_IGNORED,
    ...(options.ignoredFolders || []),
  ]);
  const maxFileSizeMB = options.maxFileSizeMB ?? 50;
  const maxSampleChars = options.maxContentSampleChars ?? 3000;

  const files: ScannedFile[] = [];
  const hashMap = new Map<string, number>();
  let duplicateCount = 0;
  let duplicateBytes = 0;
  let supportedCount = 0;

  const startedAt = new Date().toISOString();

  // Recursive directory walker
  async function walk(currentDir: string): Promise<void> {
    // Strict boundary enforcement
    if (!isWithinBoundary(currentDir, resolvedRoot)) {
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      // Permission denied or unreadable directory - skip safely
      return;
    }

    for (const entry of entries) {
      const entryName = entry.name;
      const fullPath = path.join(currentDir, entryName);

      // 1. Skip hidden files/directories if configured
      if (skipHidden && entryName.startsWith(".")) {
        continue;
      }

      // 2. Handle symlinks
      if (entry.isSymbolicLink()) {
        if (!followSymlinks) {
          continue; // Do not follow symbolic links by default
        }
        try {
          const realTarget = fs.realpathSync(fullPath);
          // Don't follow symlinks escaping workspace
          if (!isWithinBoundary(realTarget, resolvedRoot)) {
            continue;
          }
        } catch {
          continue;
        }
      }

      // 3. Process directories
      if (entry.isDirectory()) {
        if (ignored.has(entryName)) {
          continue;
        }
        await walk(fullPath);
        continue;
      }

      // 4. Process files
      if (entry.isFile()) {
        try {
          const ext = path.extname(entryName).toLowerCase();
          if (IGNORED_FILE_EXTENSIONS.has(ext) || entryName.endsWith("-wal") || entryName.endsWith("-shm")) {
            continue;
          }

          const fileStat = fs.statSync(fullPath);
          const relativePath = path.relative(resolvedRoot, fullPath);
          const mimeType = getMimeType(fullPath);

          // Content extraction (safe, bounded, never raw binary to LLM)
          const extracted = await extractFileSample(
            fullPath,
            maxSampleChars,
            maxFileSizeMB
          );

          // SHA-256 stream hash computation
          const sha256 = await computeFileHash(fullPath);

          // Track duplicate metrics
          const currentCount = hashMap.get(sha256) || 0;
          if (currentCount > 0) {
            duplicateCount += 1;
            duplicateBytes += fileStat.size;
          }
          hashMap.set(sha256, currentCount + 1);

          if (extracted.isSupported) {
            supportedCount += 1;
          }

          const fileRecord: ScannedFile = {
            id: crypto.randomUUID(),
            scanId,
            relativePath,
            absolutePath: fullPath,
            filename: entryName,
            extension: ext,
            size: fileStat.size,
            modifiedAt: fileStat.mtime.toISOString(),
            mimeType,
            sha256Hash: sha256,
            isSupported: extracted.isSupported,
            contentSample: extracted.sample,
            status: extracted.isSupported ? "scanned" : "unsupported",
          };

          files.push(fileRecord);
          options.onProgress?.(files.length, relativePath);
        } catch (err: any) {
          // File reading error (e.g. locked file) - record as unreadable
          const relativePath = path.relative(resolvedRoot, fullPath);
          files.push({
            id: crypto.randomUUID(),
            scanId,
            relativePath,
            absolutePath: fullPath,
            filename: entryName,
            extension: path.extname(entryName).toLowerCase(),
            size: 0,
            modifiedAt: new Date().toISOString(),
            mimeType: "application/octet-stream",
            sha256Hash: "",
            isSupported: false,
            contentSample: undefined,
            status: "unsupported",
          });
        }
      }
    }
  }

  await walk(resolvedRoot);

  const completedAt = new Date().toISOString();

  const scanRecord: ScanRecord = {
    id: scanId,
    folderPath: resolvedRoot,
    status: "completed",
    totalFiles: files.length,
    supportedFiles: supportedCount,
    duplicateCount,
    duplicateBytes,
    startedAt,
    completedAt,
  };

  return { scan: scanRecord, files };
}
