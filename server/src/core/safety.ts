import path from "node:path";
import fs from "node:fs";

// Reserved names on Windows and general OS safety
const WINDOWS_RESERVED_NAMES = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

// Protected system roots that must never be scanned as entire workspaces
const PROTECTED_SYSTEM_PATHS = new Set([
  "/",
  "/bin",
  "/sbin",
  "/usr",
  "/usr/bin",
  "/System",
  "/Library",
  "/Windows",
  "/Windows/System32",
  "C:\\",
  "C:\\Windows",
  "C:\\Program Files",
]);

/**
 * Checks whether a root directory is a forbidden system root.
 */
export function isProtectedSystemPath(dirPath: string): boolean {
  const resolved = path.resolve(dirPath);
  if (PROTECTED_SYSTEM_PATHS.has(resolved)) return true;
  // Check if it's filesystem root
  const root = path.parse(resolved).root;
  return resolved === root;
}

/**
 * Ensures target path resides strictly inside rootPath.
 * Prevents directory traversal attacks like ../../../etc/passwd.
 */
export function isWithinBoundary(targetPath: string, rootPath: string): boolean {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootPath);

  // Target can be root itself or a subpath
  if (resolvedTarget === resolvedRoot) return true;
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  return resolvedTarget.startsWith(prefix);
}

/**
 * Sanitizes a single filename (not a path).
 * Removes illegal characters, null bytes, control codes, and Windows reserved names.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== "string") {
    return "untitled_file";
  }

  // Remove null bytes and control characters
  let clean = filename.replace(/[\x00-\x1f\x7f-\x9f]/g, "");

  // Remove directory separators and illegal path characters
  clean = clean.replace(/[/\\:*?"<>|]/g, "-");

  // Separate basename and ext to clean trailing dashes before extension
  let ext = path.extname(clean);
  if (/^[\.\-]+$/.test(ext)) {
    ext = "";
  }
  let base = path.basename(clean, ext);

  // Collapse multiple dashes or spaces
  base = base.replace(/\s+/g, " ").replace(/-+/g, "-");

  // Trim leading/trailing whitespace, periods, and hyphens from base
  base = base.trim().replace(/^[\.\-]+|[\.\-]+$/g, "");

  // Handle empty or whitespace-only name
  if (!base) {
    base = "unnamed_file";
  }

  clean = `${base}${ext}`;

  // Check Windows reserved names (e.g. CON.txt, NUL.md)
  const upperBase = base.toUpperCase();
  if (WINDOWS_RESERVED_NAMES.has(upperBase)) {
    clean = `_${base}${ext ? ext : "_file"}`;
  }

  // Enforce max filename length (255 characters standard)
  if (clean.length > 255) {
    const ext = path.extname(clean);
    const nameWithoutExt = path.basename(clean, ext);
    clean = nameWithoutExt.substring(0, 255 - ext.length) + ext;
  }

  return clean;
}

/**
 * Sanitizes relative directory paths (e.g., "Coding/React/Notes" or "Docs\\Invoices").
 * Rejects or strips any ".." traversal components.
 */
export function sanitizeDestinationFolder(folderPath: string): string {
  if (!folderPath || typeof folderPath !== "string") {
    return "";
  }

  // Split by either slash
  const segments = folderPath.split(/[/\\]+/);
  const safeSegments: string[] = [];

  for (const seg of segments) {
    const trimmed = seg.trim();
    // Block traversal attempts
    if (!trimmed || trimmed === "." || trimmed === "..") {
      continue;
    }
    const cleanSeg = sanitizeFilename(trimmed);
    if (cleanSeg) {
      safeSegments.push(cleanSeg);
    }
  }

  return safeSegments.join(path.sep);
}

export interface PathResolutionResult {
  isValid: boolean;
  resolvedPath?: string;
  error?: string;
}

/**
 * Resolves and validates a complete destination file path against workspace boundaries.
 */
export function resolveSafeDestination(
  workspaceRoot: string,
  destinationFolder: string,
  suggestedFilename: string
): PathResolutionResult {
  const resolvedRoot = path.resolve(workspaceRoot);

  if (!fs.existsSync(resolvedRoot)) {
    return { isValid: false, error: "Workspace root does not exist" };
  }

  const cleanFolder = sanitizeDestinationFolder(destinationFolder);
  const cleanFilename = sanitizeFilename(suggestedFilename);

  if (!cleanFilename) {
    return { isValid: false, error: "Invalid or empty filename" };
  }

  const destinationDir = path.join(resolvedRoot, cleanFolder);
  const finalPath = path.join(destinationDir, cleanFilename);

  if (!isWithinBoundary(finalPath, resolvedRoot)) {
    return {
      isValid: false,
      error: "Destination path traverses outside workspace boundary",
    };
  }

  return {
    isValid: true,
    resolvedPath: finalPath,
  };
}

export interface CollisionCheckItem {
  id: string;
  originalPath: string;
  targetPath: string;
}

export interface CollisionResult {
  hasCollision: boolean;
  status: "valid" | "collision" | "out_of_bounds" | "already_exists" | "invalid_name";
  message?: string;
}

/**
 * Pre-execution collision and safety validation for a batch of planned file moves.
 * Detects:
 * - Already existing destination files
 * - Multiple operations attempting to write to the exact same destination
 * - Boundary violations
 */
export function validateBatchOperations(
  workspaceRoot: string,
  items: CollisionCheckItem[]
): Map<string, CollisionResult> {
  const results = new Map<string, CollisionResult>();
  const targetOccurrences = new Map<string, string[]>();

  const resolvedRoot = path.resolve(workspaceRoot);

  for (const item of items) {
    const resolvedTarget = path.resolve(item.targetPath);
    const resolvedOriginal = path.resolve(item.originalPath);

    // 1. Boundary check
    if (!isWithinBoundary(resolvedTarget, resolvedRoot)) {
      results.set(item.id, {
        hasCollision: true,
        status: "out_of_bounds",
        message: "Destination path is outside the selected workspace",
      });
      continue;
    }

    // 2. Track destinations to catch duplicates in the same batch
    const existingIds = targetOccurrences.get(resolvedTarget) || [];
    existingIds.push(item.id);
    targetOccurrences.set(resolvedTarget, existingIds);

    // 3. Check if target already exists on disk (and is not the same file)
    if (fs.existsSync(resolvedTarget)) {
      if (resolvedTarget !== resolvedOriginal) {
        results.set(item.id, {
          hasCollision: true,
          status: "already_exists",
          message: `Target file already exists: ${path.basename(resolvedTarget)}`,
        });
        continue;
      }
    }

    results.set(item.id, {
      hasCollision: false,
      status: "valid",
    });
  }

  // Mark all colliding batch targets
  for (const [targetPath, ids] of targetOccurrences.entries()) {
    if (ids.length > 1) {
      for (const id of ids) {
        results.set(id, {
          hasCollision: true,
          status: "collision",
          message: `Collision: ${ids.length} files target identical destination "${path.basename(targetPath)}"`,
        });
      }
    }
  }

  return results;
}
