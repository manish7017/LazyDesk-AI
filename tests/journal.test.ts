import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import {
  getDatabase,
  closeDatabase,
  initializeSchema,
  insertScan,
  insertScannedFiles,
  insertSuggestions,
  getSuggestionById,
} from "../server/src/db/database.js";
import { applySuggestionsBatch, rollbackOperation } from "../server/src/core/journal.js";
import type { AISuggestion, ScannedFile } from "@lazydesk/shared";

describe("Operation Journal & Rollback Behavior", () => {
  let tempWorkspace: string;
  let dbPath: string;

  beforeEach(() => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "lazydesk-journal-test-"));
    dbPath = path.join(tempWorkspace, "test.sqlite");
    const db = getDatabase(dbPath);
    initializeSchema(db);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(tempWorkspace)) {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    }
  });

  it("should apply file suggestions sequentially and record them in the operations journal", async () => {
    const scanId = crypto.randomUUID();
    insertScan({
      id: scanId,
      folderPath: tempWorkspace,
      status: "completed",
      totalFiles: 1,
      supportedFiles: 1,
      duplicateCount: 0,
      duplicateBytes: 0,
      startedAt: new Date().toISOString(),
    });

    const originalFile = path.join(tempWorkspace, "messy_notes.md");
    fs.writeFileSync(originalFile, "# My Notes");

    const fileId = crypto.randomUUID();
    const fileRecord: ScannedFile = {
      id: fileId,
      scanId,
      relativePath: "messy_notes.md",
      absolutePath: originalFile,
      filename: "messy_notes.md",
      extension: ".md",
      size: 10,
      modifiedAt: new Date().toISOString(),
      mimeType: "text/markdown",
      sha256Hash: "abcd",
      isSupported: true,
      status: "scanned",
    };
    insertScannedFiles([fileRecord]);

    const targetFile = path.join(tempWorkspace, "Documentation", "Notes", "react-notes.md");
    const suggestionId = crypto.randomUUID();

    const suggestion: AISuggestion = {
      id: suggestionId,
      fileId,
      scanId,
      originalPath: originalFile,
      originalFilename: "messy_notes.md",
      category: "Documentation",
      suggestedName: "react-notes.md",
      destinationFolder: "Documentation/Notes",
      targetPath: targetFile,
      reason: "Organized markdown notes",
      confidence: 0.9,
      needsReview: false,
      status: "pending",
      validationStatus: "valid",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    insertSuggestions([suggestion]);

    const result = await applySuggestionsBatch(tempWorkspace, scanId, [suggestionId]);

    expect(result.appliedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(fs.existsSync(originalFile)).toBe(false);
    expect(fs.existsSync(targetFile)).toBe(true);

    const updatedSuggestion = getSuggestionById(suggestionId);
    expect(updatedSuggestion?.status).toBe("applied");
  });

  it("should successfully rollback a completed file operation", async () => {
    const scanId = crypto.randomUUID();
    insertScan({
      id: scanId,
      folderPath: tempWorkspace,
      status: "completed",
      totalFiles: 1,
      supportedFiles: 1,
      duplicateCount: 0,
      duplicateBytes: 0,
      startedAt: new Date().toISOString(),
    });

    const originalFile = path.join(tempWorkspace, "budget_draft.csv");
    fs.writeFileSync(originalFile, "Q1,100");

    const fileId = crypto.randomUUID();
    insertScannedFiles([
      {
        id: fileId,
        scanId,
        relativePath: "budget_draft.csv",
        absolutePath: originalFile,
        filename: "budget_draft.csv",
        extension: ".csv",
        size: 6,
        modifiedAt: new Date().toISOString(),
        mimeType: "text/csv",
        sha256Hash: "ef12",
        isSupported: true,
        status: "scanned",
      },
    ]);

    const targetFile = path.join(tempWorkspace, "Finance", "budget-q1.csv");
    const suggestionId = crypto.randomUUID();

    insertSuggestions([
      {
        id: suggestionId,
        fileId,
        scanId,
        originalPath: originalFile,
        originalFilename: "budget_draft.csv",
        category: "Finance",
        suggestedName: "budget-q1.csv",
        destinationFolder: "Finance",
        targetPath: targetFile,
        reason: "Finance budget spreadsheet",
        confidence: 0.95,
        needsReview: false,
        status: "pending",
        validationStatus: "valid",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const applyResult = await applySuggestionsBatch(tempWorkspace, scanId, [suggestionId]);
    expect(applyResult.appliedCount).toBe(1);
    const opId = applyResult.operations[0].id;

    // Verify file moved to target
    expect(fs.existsSync(targetFile)).toBe(true);
    expect(fs.existsSync(originalFile)).toBe(false);

    // Rollback operation
    const rollbackResult = await rollbackOperation(tempWorkspace, opId);
    expect(rollbackResult.success).toBe(true);

    // Verify file returned to original source location
    expect(fs.existsSync(originalFile)).toBe(true);
    expect(fs.existsSync(targetFile)).toBe(false);
  });

  it("should prevent rollback if destination file was already deleted or moved by user", async () => {
    const scanId = crypto.randomUUID();
    insertScan({
      id: scanId,
      folderPath: tempWorkspace,
      status: "completed",
      totalFiles: 1,
      supportedFiles: 1,
      duplicateCount: 0,
      duplicateBytes: 0,
      startedAt: new Date().toISOString(),
    });

    const originalFile = path.join(tempWorkspace, "file.txt");
    fs.writeFileSync(originalFile, "abc");

    const fileId = crypto.randomUUID();
    insertScannedFiles([
      {
        id: fileId,
        scanId,
        relativePath: "file.txt",
        absolutePath: originalFile,
        filename: "file.txt",
        extension: ".txt",
        size: 3,
        modifiedAt: new Date().toISOString(),
        mimeType: "text/plain",
        sha256Hash: "1234",
        isSupported: true,
        status: "scanned",
      },
    ]);

    const targetFile = path.join(tempWorkspace, "Moved", "file.txt");
    const suggestionId = crypto.randomUUID();

    insertSuggestions([
      {
        id: suggestionId,
        fileId,
        scanId,
        originalPath: originalFile,
        originalFilename: "file.txt",
        category: "General",
        suggestedName: "file.txt",
        destinationFolder: "Moved",
        targetPath: targetFile,
        reason: "General organization",
        confidence: 0.8,
        needsReview: false,
        status: "pending",
        validationStatus: "valid",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const applyResult = await applySuggestionsBatch(tempWorkspace, scanId, [suggestionId]);
    const opId = applyResult.operations[0].id;

    // Simulate external deletion of target file
    fs.unlinkSync(targetFile);

    // Attempting rollback should fail gracefully with an informative error
    await expect(rollbackOperation(tempWorkspace, opId)).rejects.toThrow(
      /File no longer exists at destination path/
    );
  });
});
