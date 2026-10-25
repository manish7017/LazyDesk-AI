import type {
  AIModelInfo,
  AISuggestionOutput,
  FileAnalysisParams,
} from "@lazydesk/shared";

export interface AIProvider {
  readonly id: string;
  readonly name: string;

  /**
   * Quick ping to check if local server is listening.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Retrieves list of locally downloaded/installed models.
   */
  listModels(): Promise<AIModelInfo[]>;

  /**
   * Checks connectivity, latency, and model availability.
   */
  testConnection(): Promise<{ ok: boolean; message: string; latencyMs?: number }>;

  /**
   * Analyzes file content and generates structured organization suggestion.
   */
  analyzeFile(
    params: FileAnalysisParams,
    model?: string
  ): Promise<AISuggestionOutput>;
}
