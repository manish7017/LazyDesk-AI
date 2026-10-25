import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import path from "node:path";
import {
  AnalyzeRequestSchema,
  UpdateSuggestionSchema,
  ApplyOperationsSchema,
  RollbackRequestSchema,
  type AISuggestion,
} from "@lazydesk/shared";
import {
  getScanById,
  getScannedFiles,
  insertSuggestions,
  getSuggestions,
  getSuggestionById,
  updateSuggestion,
  getSettings,
} from "../db/database.js";
import { OllamaProvider, ruleBasedFallbackCategorizer } from "../ai/ollama.provider.js";
import { resolveSafeDestination, validateBatchOperations } from "../core/safety.js";
import { applySuggestionsBatch, rollbackOperation } from "../core/journal.js";

export const organizeRouter = Router();

// POST /api/organize/analyze
organizeRouter.post("/analyze", async (req: Request, res: Response) => {
  const parseResult = AnalyzeRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "Invalid request payload",
      details: parseResult.error.flatten(),
    });
    return;
  }

  const { scanId, model, fileIds, forceReanalyze } = parseResult.data;

  const scan = getScanById(scanId);
  if (!scan) {
    res.status(404).json({ error: "Scan record not found" });
    return;
  }

  const allFiles = getScannedFiles(scanId);
  const targetFiles = fileIds && fileIds.length > 0
    ? allFiles.filter((f) => fileIds.includes(f.id))
    : allFiles.filter((f) => f.isSupported);

  if (targetFiles.length === 0) {
    res.json({ suggestions: [], message: "No supported files to analyze" });
    return;
  }

  const existingSuggestions = getSuggestions(scanId);
  const analyzedFileIds = new Set(existingSuggestions.map((s) => s.fileId));

  const settings = getSettings();
  const provider = new OllamaProvider(settings.ollamaBaseUrl, model || settings.defaultModel);
  const isOllamaOnline = await provider.isAvailable();

  const newSuggestions: AISuggestion[] = [];
  const knownCategories = Array.from(new Set(existingSuggestions.map((s) => s.category)));

  for (const file of targetFiles) {
    if (!forceReanalyze && analyzedFileIds.has(file.id)) {
      continue;
    }

    let result;
    if (isOllamaOnline) {
      try {
        result = await provider.analyzeFile({
          filename: file.filename,
          extension: file.extension,
          relativePath: file.relativePath,
          fileSize: file.size,
          contentSample: file.contentSample || "",
          existingCategories: knownCategories,
        });
      } catch {
        // Fallback to rule-based categorizer if AI inference fails
        result = ruleBasedFallbackCategorizer({
          filename: file.filename,
          extension: file.extension,
          relativePath: file.relativePath,
          fileSize: file.size,
          contentSample: file.contentSample || "",
          existingCategories: knownCategories,
        });
      }
    } else {
      // Offline fallback: reliable, fast, private rule-based taxonomy
      result = ruleBasedFallbackCategorizer({
        filename: file.filename,
        extension: file.extension,
        relativePath: file.relativePath,
        fileSize: file.size,
        contentSample: file.contentSample || "",
        existingCategories: knownCategories,
      });
    }

    // Resolve safe destination path
    const dest = resolveSafeDestination(
      scan.folderPath,
      result.destinationFolder,
      result.suggestedName
    );

    const now = new Date().toISOString();
    const suggestionId = crypto.randomUUID();

    const suggestion: AISuggestion = {
      id: suggestionId,
      fileId: file.id,
      scanId,
      originalPath: file.absolutePath,
      originalFilename: file.filename,
      category: result.category,
      suggestedName: result.suggestedName,
      destinationFolder: result.destinationFolder,
      targetPath: dest.resolvedPath || path.join(scan.folderPath, result.suggestedName),
      reason: result.reason,
      confidence: result.confidence,
      needsReview: result.needsReview,
      status: "pending",
      validationStatus: dest.isValid ? "valid" : "out_of_bounds",
      validationMessage: dest.error,
      createdAt: now,
      updatedAt: now,
    };

    newSuggestions.push(suggestion);
    if (!knownCategories.includes(result.category)) {
      knownCategories.push(result.category);
    }
  }

  // Pre-validate collisions across the new batch
  const validationMap = validateBatchOperations(
    scan.folderPath,
    newSuggestions.map((s) => ({
      id: s.id,
      originalPath: s.originalPath,
      targetPath: s.targetPath,
    }))
  );

  for (const s of newSuggestions) {
    const v = validationMap.get(s.id);
    if (v && v.hasCollision) {
      s.validationStatus = v.status;
      s.validationMessage = v.message;
    }
  }

  insertSuggestions(newSuggestions);

  res.json({
    scanId,
    totalAnalyzed: newSuggestions.length,
    suggestions: getSuggestions(scanId),
    aiUsed: isOllamaOnline ? "Ollama Local Inference" : "Rule-based Engine (Ollama Offline)",
  });
});

// GET /api/organize/suggestions
organizeRouter.get("/suggestions", async (req: Request, res: Response) => {
  const scanId = req.query.scanId as string | undefined;
  try {
    const suggestions = getSuggestions(scanId);
    res.json({ suggestions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/organize/suggestions/:id
organizeRouter.patch("/suggestions/:id", async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
  const parseResult = UpdateSuggestionSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      error: "Invalid update payload",
      details: parseResult.error.flatten(),
    });
    return;
  }

  const existing = getSuggestionById(id);
  if (!existing) {
    res.status(404).json({ error: "Suggestion not found" });
    return;
  }

  const scan = getScanById(existing.scanId);
  const workspaceRoot = scan ? scan.folderPath : path.dirname(existing.originalPath);

  const newSuggestedName = parseResult.data.suggestedName ?? existing.suggestedName;
  const newFolder = parseResult.data.destinationFolder ?? existing.destinationFolder;

  // Re-resolve target path safely
  const dest = resolveSafeDestination(workspaceRoot, newFolder, newSuggestedName);

  const updated = updateSuggestion(id, {
    ...parseResult.data,
    suggestedName: newSuggestedName,
    destinationFolder: newFolder,
    targetPath: dest.resolvedPath || existing.targetPath,
    validationStatus: dest.isValid ? "valid" : "out_of_bounds",
    validationMessage: dest.error,
  });

  res.json({ suggestion: updated });
});

// POST /api/organize/apply
organizeRouter.post("/apply", async (req: Request, res: Response) => {
  const parseResult = ApplyOperationsSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "Invalid request payload",
      details: parseResult.error.flatten(),
    });
    return;
  }

  const { scanId, suggestionIds, dryRun } = parseResult.data;
  const scan = getScanById(scanId);
  if (!scan) {
    res.status(404).json({ error: "Scan record not found" });
    return;
  }

  try {
    const result = await applySuggestionsBatch(
      scan.folderPath,
      scanId,
      suggestionIds,
      dryRun
    );

    res.json({
      scanId,
      appliedCount: result.appliedCount,
      failedCount: result.failedCount,
      operations: result.operations,
      errors: result.errors,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/organize/undo
organizeRouter.post("/undo", async (req: Request, res: Response) => {
  const parseResult = RollbackRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "Invalid request payload",
      details: parseResult.error.flatten(),
    });
    return;
  }

  const { operationId } = parseResult.data;

  try {
    // Need workspace root; find via scan record
    const allScans = getScanById(operationId);
    // Or fetch operation log directly
    const db = await import("../db/database.js");
    const op = db.getOperationLogById(operationId);
    if (!op) {
      res.status(404).json({ error: "Operation log not found" });
      return;
    }

    const scan = db.getScanById(op.scanId);
    const workspaceRoot = scan ? scan.folderPath : path.dirname(op.sourcePath);

    const result = await rollbackOperation(workspaceRoot, operationId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
