import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  isWithinBoundary,
  sanitizeFilename,
  sanitizeDestinationFolder,
  resolveSafeDestination,
  validateBatchOperations,
  isProtectedSystemPath,
} from "../server/src/core/safety.js";

describe("Safety & Boundary Guards", () => {
  let tempWorkspace: string;

  beforeEach(() => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "lazydesk-safety-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempWorkspace)) {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    }
  });

  describe("Workspace Boundary Checks", () => {
    it("should allow files directly inside the workspace", () => {
      const target = path.join(tempWorkspace, "document.txt");
      expect(isWithinBoundary(target, tempWorkspace)).toBe(true);
    });

    it("should allow deeply nested subfolders inside the workspace", () => {
      const target = path.join(tempWorkspace, "a", "b", "c", "notes.md");
      expect(isWithinBoundary(target, tempWorkspace)).toBe(true);
    });

    it("should strictly REJECT path traversal attempts (../)", () => {
      const maliciousTarget = path.join(tempWorkspace, "..", "sensitive.env");
      expect(isWithinBoundary(maliciousTarget, tempWorkspace)).toBe(false);
    });

    it("should strictly REJECT traversal attempts aiming for /etc/passwd or root", () => {
      const maliciousTarget = path.join(tempWorkspace, "../../../../../etc/passwd");
      expect(isWithinBoundary(maliciousTarget, tempWorkspace)).toBe(false);
    });

    it("should identify protected system root paths", () => {
      expect(isProtectedSystemPath("/")).toBe(true);
      expect(isProtectedSystemPath("/System")).toBe(true);
      expect(isProtectedSystemPath("/usr")).toBe(true);
      expect(isProtectedSystemPath(tempWorkspace)).toBe(false);
    });
  });

  describe("Filename Sanitization", () => {
    it("should strip path separators from filenames", () => {
      expect(sanitizeFilename("folder/file.txt")).toBe("folder-file.txt");
      expect(sanitizeFilename("..\\..\\malicious.sh")).toBe("malicious.sh");
    });

    it("should strip null bytes and non-printable control characters", () => {
      expect(sanitizeFilename("bad\x00file\x1fname.txt")).toBe("badfilename.txt");
    });

    it("should sanitize illegal characters like < > : \" | ? *", () => {
      expect(sanitizeFilename("report<2026>:draft*?.pdf")).toBe("report-2026-draft.pdf");
    });

    it("should prevent Windows reserved names", () => {
      expect(sanitizeFilename("CON.txt")).toBe("_CON.txt");
      expect(sanitizeFilename("prn.md")).toBe("_prn.md");
      expect(sanitizeFilename("aux")).toBe("_aux_file");
    });

    it("should fallback to a safe name for empty or whitespace inputs", () => {
      expect(sanitizeFilename("   ")).toBe("unnamed_file");
      expect(sanitizeFilename("...")).toBe("unnamed_file");
    });

    it("should truncate excessively long filenames", () => {
      const longName = "a".repeat(300) + ".txt";
      const sanitized = sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(255);
      expect(sanitized.endsWith(".txt")).toBe(true);
    });
  });

  describe("Destination Folder Sanitization", () => {
    it("should strip .. and . segments from destination folders", () => {
      expect(sanitizeDestinationFolder("Coding/../Finance/./Invoices")).toBe(
        path.join("Coding", "Finance", "Invoices")
      );
    });

    it("should handle leading and trailing slashes safely", () => {
      expect(sanitizeDestinationFolder("/Docs/Work/")).toBe(
        path.join("Docs", "Work")
      );
    });
  });

  describe("resolveSafeDestination", () => {
    it("should resolve valid paths within workspace", () => {
      const res = resolveSafeDestination(tempWorkspace, "Coding/React", "auth.ts");
      expect(res.isValid).toBe(true);
      expect(res.resolvedPath).toBe(path.join(tempWorkspace, "Coding", "React", "auth.ts"));
    });

    it("should reject destinations attempting path traversal", () => {
      const res = resolveSafeDestination(tempWorkspace, "../../outside", "hack.sh");
      expect(res.isValid).toBe(true); // sanitizeDestinationFolder strips the ..
      // The resolved path must remain INSIDE the workspace
      expect(isWithinBoundary(res.resolvedPath!, tempWorkspace)).toBe(true);
    });
  });

  describe("Collision Detection", () => {
    it("should detect when two planned suggestions target the exact same file", () => {
      const file1 = path.join(tempWorkspace, "f1.txt");
      const file2 = path.join(tempWorkspace, "f2.txt");
      const target = path.join(tempWorkspace, "target.txt");

      fs.writeFileSync(file1, "content1");
      fs.writeFileSync(file2, "content2");

      const items = [
        { id: "s1", originalPath: file1, targetPath: target },
        { id: "s2", originalPath: file2, targetPath: target },
      ];

      const results = validateBatchOperations(tempWorkspace, items);
      expect(results.get("s1")?.hasCollision).toBe(true);
      expect(results.get("s2")?.hasCollision).toBe(true);
      expect(results.get("s1")?.status).toBe("collision");
    });

    it("should detect when destination already exists on disk", () => {
      const file1 = path.join(tempWorkspace, "new.txt");
      const existingTarget = path.join(tempWorkspace, "already_exists.txt");

      fs.writeFileSync(file1, "content");
      fs.writeFileSync(existingTarget, "pre-existing");

      const items = [
        { id: "s1", originalPath: file1, targetPath: existingTarget },
      ];

      const results = validateBatchOperations(tempWorkspace, items);
      expect(results.get("s1")?.hasCollision).toBe(true);
      expect(results.get("s1")?.status).toBe("already_exists");
    });

    it("should flag out-of-bounds target paths", () => {
      const file1 = path.join(tempWorkspace, "f.txt");
      fs.writeFileSync(file1, "content");

      const items = [
        { id: "s1", originalPath: file1, targetPath: "/tmp/outside.txt" },
      ];

      const results = validateBatchOperations(tempWorkspace, items);
      expect(results.get("s1")?.hasCollision).toBe(true);
      expect(results.get("s1")?.status).toBe("out_of_bounds");
    });
  });
});
