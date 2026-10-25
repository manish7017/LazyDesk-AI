import { Router, type Request, type Response } from "express";
import { OllamaProvider } from "../ai/ollama.provider.js";
import { getSettings } from "../db/database.js";

export const aiRouter = Router();

function getOllama(): OllamaProvider {
  const settings = getSettings();
  return new OllamaProvider(settings.ollamaBaseUrl, settings.defaultModel);
}

// GET /api/ai/status
aiRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    const provider = getOllama();
    const isAvailable = await provider.isAvailable();
    const models = isAvailable ? await provider.listModels() : [];
    const settings = getSettings();

    res.json({
      isAvailable,
      provider: provider.name,
      endpoint: settings.ollamaBaseUrl,
      defaultModel: settings.defaultModel,
      installedModels: models.map((m) => m.name),
      instructions: {
        title: "Ollama Local Inference Setup",
        steps: [
          "1. Download and install Ollama from https://ollama.ai",
          "2. Start Ollama in your terminal: `ollama serve`",
          `3. Pull the recommended model: \`ollama pull ${settings.defaultModel || "llama3.2"}\``,
          "4. Refresh this page or click 'Test Connection'.",
        ],
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/models
aiRouter.get("/models", async (_req: Request, res: Response) => {
  try {
    const provider = getOllama();
    const models = await provider.listModels();
    res.json({ models });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/test
aiRouter.post("/test", async (_req: Request, res: Response) => {
  try {
    const provider = getOllama();
    const result = await provider.testConnection();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});
