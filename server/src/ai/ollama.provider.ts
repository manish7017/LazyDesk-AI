import {
  AISuggestionSchema,
  type AISuggestionOutput,
  type AIModelInfo,
  type FileAnalysisParams,
} from "@lazydesk/shared";
import type { AIProvider } from "./provider.interface.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompt.builder.js";
import path from "node:path";

export class OllamaProvider implements AIProvider {
  readonly id = "ollama";
  readonly name = "Ollama (Local)";

  private baseUrl: string;
  private defaultModel: string;

  constructor(baseUrl = "http://127.0.0.1:11434", defaultModel = "llama3.2") {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.defaultModel = defaultModel;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, "");
  }

  setDefaultModel(model: string): void {
    this.defaultModel = model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<AIModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) {
        throw new Error(`Failed to query Ollama tags: ${res.statusText}`);
      }
      const data = (await res.json()) as any;
      if (!data || !Array.isArray(data.models)) {
        return [];
      }

      return data.models.map((m: any) => ({
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
        family: m.details?.family,
        parameterSize: m.details?.parameter_size,
      }));
    } catch {
      return [];
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        return {
          ok: false,
          message: `Ollama returned HTTP ${res.status}: ${res.statusText}`,
          latencyMs,
        };
      }

      const data = (await res.json()) as any;
      const count = Array.isArray(data.models) ? data.models.length : 0;

      return {
        ok: true,
        message: `Connected to Ollama at ${this.baseUrl}. ${count} local model(s) available.`,
        latencyMs,
      };
    } catch (err: any) {
      return {
        ok: false,
        message: `Could not connect to Ollama at ${this.baseUrl}: ${err.message}. Ensure Ollama is running ('ollama serve').`,
      };
    }
  }

  async analyzeFile(
    params: FileAnalysisParams,
    modelOverride?: string
  ): Promise<AISuggestionOutput> {
    const targetModel = modelOverride || this.defaultModel;

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(params);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout for local inference

      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          format: "json",
          stream: false,
          options: {
            temperature: 0.1,
          },
        }),
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(
          `Ollama API error (${res.status}): ${errorText || res.statusText}`
        );
      }

      const json = (await res.json()) as any;
      const content = json?.message?.content;

      if (!content || typeof content !== "string") {
        throw new Error("Ollama returned an empty response message.");
      }

      // Parse JSON from model
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch (parseErr: any) {
        // Attempt clean-up of markdown fences if any slipped through
        const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
        parsed = JSON.parse(cleaned);
      }

      // Validate with strict Zod schema
      const validated = AISuggestionSchema.safeParse(parsed);
      if (!validated.success) {
        throw new Error(
          `Model response failed schema validation: ${validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`
        );
      }

      return validated.data;
    } catch (err: any) {
      // Re-throw with descriptive context or let caller handle fallback
      throw new Error(`AI Analysis failed: ${err.message}`);
    }
  }
}

/**
 * Deterministic rule-based categorizer for offline fallback or unreadable files.
 * Guarantees the application remains 100% useful even if Ollama is not running.
 */
export function ruleBasedFallbackCategorizer(
  params: FileAnalysisParams
): AISuggestionOutput {
  const ext = params.extension.toLowerCase();
  const name = params.filename;

  let category = "General";
  let destinationFolder = "General";
  let reason = "Categorized based on file extension and naming structure";
  let confidence = 0.65;
  let needsReview = true;

  // Code & Development
  if ([".ts", ".js", ".tsx", ".jsx", ".py", ".rs", ".go", ".cpp", ".c", ".java", ".html", ".css", ".sh"].includes(ext)) {
    category = "Coding";
    destinationFolder = `Coding/${ext.replace(".", "").toUpperCase()}`;
    reason = `Identified as source code (${ext})`;
    confidence = 0.85;
    needsReview = false;
  }
  // Documentation & Notes
  else if ([".md", ".markdown", ".txt", ".rtf"].includes(ext)) {
    category = "Documentation";
    destinationFolder = "Documentation/Notes";
    reason = `Plain text or markdown documentation file`;
    confidence = 0.8;
    needsReview = false;
  }
  // Spreadsheets & Financial Data
  else if ([".xlsx", ".xlsb", ".xls", ".ods", ".csv", ".tsv"].includes(ext)) {
    category = "Spreadsheets";
    destinationFolder = "Data/Spreadsheets";
    reason = `Spreadsheet workbook data (${ext.replace(".", "").toUpperCase()})`;
    confidence = 0.88;
    needsReview = false;
  }
  // Data & Configurations
  else if ([".json", ".yaml", ".yml", ".xml", ".toml", ".sql"].includes(ext)) {
    category = "Data";
    destinationFolder = "Data/Datasets";
    reason = `Structured data or configuration file`;
    confidence = 0.8;
    needsReview = false;
  }
  // Media & Images
  else if ([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".ico"].includes(ext)) {
    category = "Images";
    destinationFolder = "Media/Images";
    reason = `Image asset`;
    confidence = 0.85;
    needsReview = false;
  }
  // Documents & PDF
  else if (ext === ".pdf") {
    category = "Documents";
    destinationFolder = "Documents/PDF";
    reason = `Portable Document Format (PDF)`;
    confidence = 0.8;
    needsReview = false;
  }

  // Preserve extension and suggest clean kebab-case name
  const baseName = path.parse(name).name;
  const cleanBase = baseName
    .replace(/[^a-zA-Z0-9_\-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  const suggestedName = `${cleanBase}${ext}`;

  return {
    category,
    suggestedName,
    destinationFolder,
    reason,
    confidence,
    needsReview,
  };
}
