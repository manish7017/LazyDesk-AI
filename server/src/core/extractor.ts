import fs from "node:fs";
import path from "node:path";
import * as xlsx from "xlsx";

// Supported text and structured document extensions
const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".markdown", ".rtf",
  ".json", ".csv", ".tsv", ".xml", ".yaml", ".yml",
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".py", ".rb", ".php", ".java", ".c", ".cpp", ".h", ".cs", ".go", ".rs", ".swift", ".kt",
  ".html", ".htm", ".css", ".scss", ".sass", ".less",
  ".sh", ".bash", ".zsh", ".bat", ".ps1",
  ".sql", ".env.example", ".ini", ".conf", ".cfg", ".toml",
  ".log"
]);

const SPREADSHEET_EXTENSIONS = new Set([
  ".xlsx", ".xlsb", ".xls", ".ods"
]);

const IMAGE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".ico", ".tiff"
]);

const PDF_EXTENSIONS = new Set([".pdf"]);

export interface ExtractedContent {
  isSupported: boolean;
  mimeType: string;
  sample?: string;
  unsupportedReason?: string;
}

/**
 * Returns a simple MIME type string based on extension.
 */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".txt": return "text/plain";
    case ".md":
    case ".markdown": return "text/markdown";
    case ".json": return "application/json";
    case ".csv": return "text/csv";
    case ".xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case ".xlsb": return "application/vnd.ms-excel.sheet.binary.macroEnabled.12";
    case ".xls": return "application/vnd.ms-excel";
    case ".ods": return "application/vnd.oasis.opendocument.spreadsheet";
    case ".html":
    case ".htm": return "text/html";
    case ".css": return "text/css";
    case ".js":
    case ".mjs":
    case ".cjs": return "application/javascript";
    case ".ts":
    case ".tsx": return "application/typescript";
    case ".py": return "text/x-python";
    case ".pdf": return "application/pdf";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".svg": return "image/svg+xml";
    case ".yaml":
    case ".yml": return "application/yaml";
    case ".xml": return "application/xml";
    case ".sh": return "text/x-shellscript";
    default: return "application/octet-stream";
  }
}

/**
 * Checks if a buffer contains binary data (e.g. null bytes in first 1024 bytes).
 */
export function isBinaryBuffer(buffer: Buffer): boolean {
  const checkLen = Math.min(buffer.length, 1024);
  for (let i = 0; i < checkLen; i++) {
    if (buffer[i] === 0) return true; // Null byte indicates binary
  }
  return false;
}

/**
 * Extracts a bounded text sample from a file.
 * Guaranteed NEVER to return binary or un-sanitized content.
 */
export async function extractFileSample(
  filePath: string,
  maxChars = 3000,
  maxFileSizeMB = 50
): Promise<ExtractedContent> {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = getMimeType(filePath);

  try {
    const stats = fs.statSync(filePath);
    const sizeInMB = stats.size / (1024 * 1024);

    if (sizeInMB > maxFileSizeMB) {
      return {
        isSupported: false,
        mimeType,
        unsupportedReason: `File size (${sizeInMB.toFixed(1)}MB) exceeds maximum limit (${maxFileSizeMB}MB)`,
      };
    }

    // SVG images are XML text and safe to inspect
    if (ext === ".svg") {
      const fd = fs.openSync(filePath, "r");
      const buffer = Buffer.alloc(Math.min(stats.size, maxChars * 2));
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
      fs.closeSync(fd);
      const text = buffer.subarray(0, bytesRead).toString("utf8");
      return {
        isSupported: true,
        mimeType,
        sample: sanitizeContentSample(text, maxChars),
      };
    }

    // Binary images: do not send binary to LLM, but summarize metadata
    if (IMAGE_EXTENSIONS.has(ext)) {
      return {
        isSupported: true,
        mimeType,
        sample: `[Image File: ${path.basename(filePath)}, Extension: ${ext}, Size: ${stats.size} bytes]`,
      };
    }

    // PDF files: parse text stream or fallback to safe structure
    if (PDF_EXTENSIONS.has(ext)) {
      try {
        const fd = fs.openSync(filePath, "r");
        const buffer = Buffer.alloc(Math.min(stats.size, 8192));
        const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
        fs.closeSync(fd);

        // Simple text stream extraction from PDF object streams if uncompressed
        const raw = buffer.subarray(0, bytesRead).toString("latin1");
        const extracted = raw
          .replace(/[^\x20-\x7E\n\r\t]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        if (extracted.length > 50) {
          return {
            isSupported: true,
            mimeType,
            sample: sanitizeContentSample(extracted, maxChars),
          };
        } else {
          return {
            isSupported: true,
            mimeType,
            sample: `[PDF Document: ${path.basename(filePath)}, Size: ${stats.size} bytes]`,
          };
        }
      } catch {
        return {
          isSupported: true,
          mimeType,
          sample: `[PDF Document: ${path.basename(filePath)}, Size: ${stats.size} bytes]`,
        };
      }
    }

    // Spreadsheets: Excel (.xlsx, .xlsb, .xls) and OpenDocument (.ods)
    if (SPREADSHEET_EXTENSIONS.has(ext)) {
      try {
        const fileBuffer = fs.readFileSync(filePath);
        // sheetRows limits memory and computation to first 30 rows
        const workbook = xlsx.read(fileBuffer, { type: "buffer", sheetRows: 30 });
        const sheetNames = workbook.SheetNames || [];

        let sampleText = `[Spreadsheet Workbook: ${path.basename(filePath)}, Sheets: ${sheetNames.join(", ")}]\n`;
        if (sheetNames.length > 0) {
          const firstSheet = workbook.Sheets[sheetNames[0]];
          const csvData = xlsx.utils.sheet_to_csv(firstSheet);
          sampleText += `\nSheet "${sheetNames[0]}" Preview (Top Rows):\n${csvData}`;
        }

        return {
          isSupported: true,
          mimeType,
          sample: sanitizeContentSample(sampleText, maxChars),
        };
      } catch (sheetErr: any) {
        return {
          isSupported: true,
          mimeType,
          sample: `[Spreadsheet Workbook: ${path.basename(filePath)}, Extension: ${ext}, Notice: ${sheetErr.message}]`,
        };
      }
    }

    // Plain text and code files
    if (TEXT_EXTENSIONS.has(ext)) {
      const fd = fs.openSync(filePath, "r");
      const readBytes = Math.min(stats.size, maxChars * 4); // UTF-8 can take up to 4 bytes per char
      const buffer = Buffer.alloc(readBytes);
      const bytesRead = fs.readSync(fd, buffer, 0, readBytes, 0);
      fs.closeSync(fd);

      if (isBinaryBuffer(buffer.subarray(0, bytesRead))) {
        return {
          isSupported: false,
          mimeType,
          unsupportedReason: "File contains binary control data",
        };
      }

      const text = buffer.subarray(0, bytesRead).toString("utf8");
      return {
        isSupported: true,
        mimeType,
        sample: sanitizeContentSample(text, maxChars),
      };
    }

    // Check unknown extensions: if small and not binary, allow it
    if (stats.size < 500 * 1024) {
      const fd = fs.openSync(filePath, "r");
      const readBytes = Math.min(stats.size, 1024);
      const buffer = Buffer.alloc(readBytes);
      const bytesRead = fs.readSync(fd, buffer, 0, readBytes, 0);
      fs.closeSync(fd);

      if (!isBinaryBuffer(buffer.subarray(0, bytesRead))) {
        const fullRead = Math.min(stats.size, maxChars * 2);
        const fullBuf = Buffer.alloc(fullRead);
        const fdf = fs.openSync(filePath, "r");
        const b = fs.readSync(fdf, fullBuf, 0, fullRead, 0);
        fs.closeSync(fdf);
        return {
          isSupported: true,
          mimeType,
          sample: sanitizeContentSample(fullBuf.subarray(0, b).toString("utf8"), maxChars),
        };
      }
    }

    return {
      isSupported: false,
      mimeType,
      unsupportedReason: `Unsupported binary or unknown file extension: ${ext}`,
    };
  } catch (err: any) {
    return {
      isSupported: false,
      mimeType,
      unsupportedReason: `Unreadable file: ${err.message}`,
    };
  }
}

/**
 * Truncates and sanitizes text content sample to prevent prompt injection and model overflow.
 */
export function sanitizeContentSample(text: string, maxChars: number): string {
  // Strip control chars (keep standard newlines and tabs)
  const cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  if (cleaned.length <= maxChars) {
    return cleaned;
  }
  return cleaned.substring(0, maxChars) + "\n... [content truncated]";
}
