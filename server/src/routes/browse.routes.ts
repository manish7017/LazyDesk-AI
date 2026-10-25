import { Router, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const browseRouter = Router();

// GET /api/browse?dir=...
browseRouter.get("/", (req: Request, res: Response) => {
  const reqDir = (req.query.dir as string) || process.cwd();
  const resolved = path.resolve(reqDir);

  try {
    if (!fs.existsSync(resolved)) {
      res.status(404).json({ error: "Directory not found", path: resolved });
      return;
    }

    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      res.status(400).json({ error: "Path is not a directory", path: resolved });
      return;
    }

    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const subdirectories = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => ({
        name: e.name,
        path: path.join(resolved, e.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const quickBookmarks = [
      { name: "Current Project", path: process.cwd() },
      { name: "Home Directory", path: os.homedir() },
      { name: "Downloads", path: path.join(os.homedir(), "Downloads") },
      { name: "Desktop", path: path.join(os.homedir(), "Desktop") },
      { name: "Documents", path: path.join(os.homedir(), "Documents") },
      { name: "Sample Test Folder", path: path.join(process.cwd(), "test-data") },
    ].filter((b) => fs.existsSync(b.path));

    res.json({
      currentPath: resolved,
      parentPath: path.dirname(resolved) !== resolved ? path.dirname(resolved) : null,
      subdirectories,
      quickBookmarks,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
