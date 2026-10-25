import { Router, type Request, type Response } from "express";
import path from "node:path";
import { DeleteDuplicatesSchema } from "@lazydesk/shared";
import {
  getDuplicatesByScanId,
  getAllDuplicates,
  getScanById,
  getAllScans,
} from "../db/database.js";
import { safeDeleteDuplicates } from "../core/journal.js";

export const duplicateRouter = Router();

// GET /api/duplicates
duplicateRouter.get("/", async (req: Request, res: Response) => {
  const scanId = req.query.scanId as string | undefined;
  try {
    const duplicates = scanId
      ? getDuplicatesByScanId(scanId)
      : getAllDuplicates();

    res.json({ duplicates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/duplicates/delete
duplicateRouter.post("/delete", async (req: Request, res: Response) => {
  const parseResult = DeleteDuplicatesSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "Invalid request payload",
      details: parseResult.error.flatten(),
    });
    return;
  }

  const { filePaths, moveToTrash } = parseResult.data;

  try {
    // Determine workspace root from latest scan
    const scans = getAllScans();
    const latest = scans[0];
    const workspaceRoot = latest ? latest.folderPath : path.dirname(filePaths[0]);

    const result = await safeDeleteDuplicates(
      workspaceRoot,
      filePaths,
      moveToTrash ?? true
    );

    res.json({
      deletedCount: result.deleted.length,
      failedCount: result.errors.length,
      deleted: result.deleted,
      errors: result.errors,
      trashLocation: moveToTrash ? path.join(workspaceRoot, ".lazydesk_trash") : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
