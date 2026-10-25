import { Router, type Request, type Response } from "express";
import { UpdateSettingsSchema } from "@lazydesk/shared";
import { getSettings, updateSettings } from "../db/database.js";

export const settingsRouter = Router();

// GET /api/settings
settingsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const settings = getSettings();
    res.json({ settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/settings
settingsRouter.patch("/", async (req: Request, res: Response) => {
  const parseResult = UpdateSettingsSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "Invalid settings payload",
      details: parseResult.error.flatten(),
    });
    return;
  }

  try {
    const updated = updateSettings(parseResult.data);
    res.json({ settings: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
