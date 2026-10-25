import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { computeFileHash, computeFileHashSync } from "../server/src/core/hasher.js";

describe("SHA-256 Hasher & Exact Duplicate Detection", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lazydesk-hasher-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should compute accurate SHA-256 hashes", async () => {
    const file = path.join(tempDir, "test.txt");
    fs.writeFileSync(file, "hello world");

    const hash = await computeFileHash(file);
    const syncHash = computeFileHashSync(file);

    // Known SHA-256 of "hello world"
    expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
    expect(syncHash).toBe(hash);
  });

  it("should produce identical hashes for identical file contents regardless of filename", async () => {
    const fileA = path.join(tempDir, "original.txt");
    const fileB = path.join(tempDir, "renamed_copy.txt");
    const content = "Exact duplicate content for Hacktoberfest 2026";

    fs.writeFileSync(fileA, content);
    fs.writeFileSync(fileB, content);

    const hashA = await computeFileHash(fileA);
    const hashB = await computeFileHash(fileB);

    expect(hashA).toBe(hashB);
  });

  it("should NEVER flag files as duplicates if contents differ even by one byte", async () => {
    const fileA = path.join(tempDir, "file_a.txt");
    const fileB = path.join(tempDir, "file_b.txt");

    fs.writeFileSync(fileA, "Content A");
    fs.writeFileSync(fileB, "Content B");

    const hashA = await computeFileHash(fileA);
    const hashB = await computeFileHash(fileB);

    expect(hashA).not.toBe(hashB);
  });
});
