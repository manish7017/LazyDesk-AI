import crypto from "node:crypto";
import fs from "node:fs";

/**
 * Computes SHA-256 hash of a file using streams to handle files of any size safely.
 */
export async function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(filePath);

      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Synchronous hash computation for smaller files or tests.
 */
export function computeFileHashSync(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}
