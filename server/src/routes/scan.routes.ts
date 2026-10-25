import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { ScanRequestSchema } from "@lazydesk/shared";
import { scanDirectory } from "../core/scanner.js";
import {
  insertScan,
  insertScannedFiles,
  getAllScans,
  getScanById,
  getScannedFiles,
  getDuplicatesByScanId,
  getSettings,
} from "../db/database.js";

export const scanRouter = Router();

// POST /api/scan
scanRouter.post("/", async (req: Request, res: Response) => {
  const parseResult = ScanRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "Invalid request payload",
      details: parseResult.error.flatten(),
    });
    return;
  }

  const { folderPath, skipHiddenFiles, followSymlinks, ignoredFolders } =
    parseResult.data;

  const scanId = crypto.randomUUID();
  const settings = getSettings();

  try {
    const { scan, files } = await scanDirectory(folderPath, scanId, {
      skipHiddenFiles: skipHiddenFiles ?? settings.skipHiddenFiles,
      followSymlinks: followSymlinks ?? settings.followSymlinks,
      ignoredFolders: ignoredFolders ?? settings.ignoredFolders,
      maxFileSizeMB: settings.maxFileSizeMB,
      maxContentSampleChars: settings.maxContentSampleChars,
    });

    insertScan(scan);
    insertScannedFiles(files);

    const duplicates = getDuplicatesByScanId(scanId);

    res.status(201).json({
      scan,
      files,
      duplicates,
    });
  } catch (err: any) {
    res.status(400).json({
      error: err.message || "Failed to scan folder",
    });
  }
});

// GET /api/scans
scanRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const scans = getAllScans();
    res.json({ scans });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scans/:id
scanRouter.get("/:id", async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
  try {
    const scan = getScanById(id);
    if (!scan) {
      res.status(404).json({ error: "Scan record not found" });
      return;
    }

    const files = getScannedFiles(id);
    const duplicates = getDuplicatesByScanId(id);

    res.json({
      scan,
      files,
      duplicates,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
