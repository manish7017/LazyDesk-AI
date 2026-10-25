import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { OperationLog, OperationType } from "@lazydesk/shared";
import {
  insertOperationLog,
  getOperationLogById,
  updateOperationLog,
  updateSuggestion,
  getSuggestionById,
  getDatabase,
} from "../db/database.js";
import { isWithinBoundary, validateBatchOperations } from "./safety.js";

export interface ApplyResult {
  appliedCount: number;
  failedCount: number;
  operations: OperationLog[];
  errors: { id: string; error: string }[];
}

export interface RollbackResult {
  success: boolean;
  operationId: string;
  sourceRestored: string;
  message?: string;
}

/**
 * Applies a batch of approved suggestions sequentially.
 * Validates collision, boundary, and file existence beforehand.
 * Records every step in the SQLite operations journal.
 */
export async function applySuggestionsBatch(
  workspaceRoot: string,
  scanId: string,
  suggestionIds: string[],
  dryRun = false
): Promise<ApplyResult> {
  const operations: OperationLog[] = [];
  const errors: { id: string; error: string }[] = [];

  const db = getDatabase();
  const suggestions = suggestionIds
    .map((id) => getSuggestionById(id))
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // 1. Pre-execution collision & safety check
  const checkItems = suggestions.map((s) => ({
    id: s.id,
    originalPath: s.originalPath,
    targetPath: s.targetPath,
  }));

  const validationMap = validateBatchOperations(workspaceRoot, checkItems);

  for (const s of suggestions) {
    const val = validationMap.get(s.id);
    if (val && val.hasCollision) {
      errors.push({
        id: s.id,
        error: val.message || `Validation error: ${val.status}`,
      });
      continue;
    }

    if (dryRun) {
      // In dry run, do not perform file system operations
      continue;
    }

    const opId = crypto.randomUUID();
    const sourcePath = path.resolve(s.originalPath);
    const targetPath = path.resolve(s.targetPath);

    // Final safety guards before write
    if (!fs.existsSync(sourcePath)) {
      errors.push({
        id: s.id,
        error: `Source file not found: ${sourcePath}`,
      });
      continue;
    }

    if (!isWithinBoundary(targetPath, workspaceRoot)) {
      errors.push({
        id: s.id,
        error: `Destination path escapes workspace: ${targetPath}`,
      });
      continue;
    }

    if (fs.existsSync(targetPath) && sourcePath !== targetPath) {
      errors.push({
        id: s.id,
        error: `Destination file already exists: ${targetPath}`,
      });
      continue;
    }

    try {
      // Ensure target directory exists
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Perform move/rename
      fs.renameSync(sourcePath, targetPath);

      // Record in journal
      const opLog: OperationLog = {
        id: opId,
        scanId,
        suggestionId: s.id,
        operationType: "move",
        sourcePath,
        targetPath,
        appliedAt: new Date().toISOString(),
        status: "applied",
      };

      insertOperationLog(opLog);
      operations.push(opLog);

      // Update suggestion status in DB
      updateSuggestion(s.id, {
        status: "applied",
        validationStatus: "valid",
      });

      // Update scanned_file record if present
      db.prepare(`
        UPDATE scanned_files
        SET absolute_path = ?,
            relative_path = ?,
            filename = ?,
            status = 'organized'
        WHERE id = ?
      `).run(
        targetPath,
        path.relative(workspaceRoot, targetPath),
        path.basename(targetPath),
        s.fileId
      );
    } catch (err: any) {
      errors.push({
        id: s.id,
        error: `Failed to move file: ${err.message}`,
      });

      // Record failed operation in journal
      insertOperationLog({
        id: opId,
        scanId,
        suggestionId: s.id,
        operationType: "move",
        sourcePath,
        targetPath,
        appliedAt: new Date().toISOString(),
        status: "failed",
        error: err.message,
      });
    }
  }

  return {
    appliedCount: operations.length,
    failedCount: errors.length,
    operations,
    errors,
  };
}

/**
 * Reverses a previously applied file operation from the journal.
 */
export async function rollbackOperation(
  workspaceRoot: string,
  operationId: string
): Promise<RollbackResult> {
  const op = getOperationLogById(operationId);
  if (!op) {
    throw new Error(`Operation record not found: ${operationId}`);
  }

  if (op.status === "rolled_back") {
    throw new Error(`Operation ${operationId} has already been rolled back`);
  }

  if (op.status !== "applied") {
    throw new Error(`Cannot rollback operation with status: ${op.status}`);
  }

  if (!op.targetPath) {
    throw new Error("No target path recorded for rollback");
  }

  const currentFile = path.resolve(op.targetPath);
  const originalDestination = path.resolve(op.sourcePath);

  // Safety checks
  if (!fs.existsSync(currentFile)) {
    throw new Error(
      `File no longer exists at destination path: ${currentFile}. Cannot rollback.`
    );
  }

  if (fs.existsSync(originalDestination)) {
    throw new Error(
      `Original location is already occupied: ${originalDestination}. Rollback prevented to avoid overwrite.`
    );
  }

  if (!isWithinBoundary(originalDestination, workspaceRoot)) {
    throw new Error(
      `Original path is outside workspace boundaries: ${originalDestination}`
    );
  }

  // Ensure original directory exists
  const origDir = path.dirname(originalDestination);
  if (!fs.existsSync(origDir)) {
    fs.mkdirSync(origDir, { recursive: true });
  }

  // Execute rollback move
  fs.renameSync(currentFile, originalDestination);

  // Update operation log in DB
  updateOperationLog(operationId, {
    status: "rolled_back",
    rolledBackAt: new Date().toISOString(),
  });

  // If associated with a suggestion, update suggestion status
  if (op.suggestionId) {
    updateSuggestion(op.suggestionId, {
      status: "approved",
    });
  }

  const db = getDatabase();
  db.prepare(`
    UPDATE scanned_files
    SET absolute_path = ?,
        relative_path = ?,
        filename = ?,
        status = 'scanned'
    WHERE absolute_path = ?
  `).run(
    originalDestination,
    path.relative(workspaceRoot, originalDestination),
    path.basename(originalDestination),
    currentFile
  );

  return {
    success: true,
    operationId,
    sourceRestored: originalDestination,
    message: `Successfully restored ${path.basename(originalDestination)}`,
  };
}

/**
 * Safely handles user-confirmed duplicate deletion.
 * Moves duplicates to a local workspace trash directory (.lazydesk_trash/)
 * so files can be recovered if needed.
 */
export async function safeDeleteDuplicates(
  workspaceRoot: string,
  filePaths: string[],
  moveToTrash = true
): Promise<{ deleted: string[]; errors: { path: string; error: string }[] }> {
  const deleted: string[] = [];
  const errors: { path: string; error: string }[] = [];
  const resolvedRoot = path.resolve(workspaceRoot);

  const trashDir = path.join(resolvedRoot, ".lazydesk_trash");
  if (moveToTrash && !fs.existsSync(trashDir)) {
    fs.mkdirSync(trashDir, { recursive: true });
  }

  const db = getDatabase();

  for (const fp of filePaths) {
    const resolvedPath = path.resolve(fp);

    // Boundary check
    if (!isWithinBoundary(resolvedPath, resolvedRoot)) {
      errors.push({
        path: fp,
        error: "Path is outside workspace boundary",
      });
      continue;
    }

    if (!fs.existsSync(resolvedPath)) {
      errors.push({
        path: fp,
        error: "File does not exist",
      });
      continue;
    }

    try {
      if (moveToTrash) {
        const timestamp = Date.now();
        const baseName = path.basename(resolvedPath);
        const trashPath = path.join(trashDir, `${timestamp}_${baseName}`);
        fs.renameSync(resolvedPath, trashPath);
      } else {
        fs.unlinkSync(resolvedPath);
      }

      // Remove from scanned_files table
      db.prepare("DELETE FROM scanned_files WHERE absolute_path = ?").run(resolvedPath);
      deleted.push(fp);
    } catch (err: any) {
      errors.push({
        path: fp,
        error: err.message,
      });
    }
  }

  return { deleted, errors };
}
