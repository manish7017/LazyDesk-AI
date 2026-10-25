import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { scanDirectory } from "../server/src/core/scanner.js";

describe("Directory Scanner & Safe Traversal", () => {
  let tempWorkspace: string;
  let outsideDir: string;

  beforeEach(() => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "lazydesk-scan-test-"));
    outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "lazydesk-outside-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempWorkspace)) {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    }
    if (fs.existsSync(outsideDir)) {
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it("should scan files within workspace and extract metadata", async () => {
    fs.writeFileSync(path.join(tempWorkspace, "note.md"), "# Hello Markdown");
    fs.mkdirSync(path.join(tempWorkspace, "subfolder"));
    fs.writeFileSync(path.join(tempWorkspace, "subfolder", "data.json"), JSON.stringify({ key: "val" }));

    const { scan, files } = await scanDirectory(tempWorkspace, "scan-1");

    expect(scan.status).toBe("completed");
    expect(scan.totalFiles).toBe(2);
    expect(files.some((f) => f.filename === "note.md")).toBe(true);
    expect(files.some((f) => f.filename === "data.json")).toBe(true);
  });

  it("should SKIP hidden files by default", async () => {
    fs.writeFileSync(path.join(tempWorkspace, "visible.txt"), "visible");
    fs.writeFileSync(path.join(tempWorkspace, ".hidden_secret"), "secret");
    fs.mkdirSync(path.join(tempWorkspace, ".git"));
    fs.writeFileSync(path.join(tempWorkspace, ".git", "config"), "git-config");

    const { files } = await scanDirectory(tempWorkspace, "scan-2", {
      skipHiddenFiles: true,
    });

    expect(files.length).toBe(1);
    expect(files[0].filename).toBe("visible.txt");
  });

  it("should SKIP ignored directories such as node_modules", async () => {
    fs.writeFileSync(path.join(tempWorkspace, "app.ts"), "console.log('hi');");
    fs.mkdirSync(path.join(tempWorkspace, "node_modules", "package"), { recursive: true });
    fs.writeFileSync(path.join(tempWorkspace, "node_modules", "package", "index.js"), "lib");

    const { files } = await scanDirectory(tempWorkspace, "scan-3", {
      ignoredFolders: ["node_modules"],
    });

    expect(files.length).toBe(1);
    expect(files[0].filename).toBe("app.ts");
  });

  it("should NOT follow symbolic links by default", async () => {
    fs.writeFileSync(path.join(tempWorkspace, "real_file.txt"), "real file");

    const outsideFile = path.join(outsideDir, "outside_secret.txt");
    fs.writeFileSync(outsideFile, "confidential outside data");

    const symlinkPath = path.join(tempWorkspace, "symlink_to_outside.txt");
    try {
      fs.symlinkSync(outsideFile, symlinkPath);
    } catch {
      // If symlink not permitted on test runner, skip test
      return;
    }

    const { files } = await scanDirectory(tempWorkspace, "scan-4", {
      followSymlinks: false,
    });

    // Only real_file.txt should be scanned; symlink must be ignored
    expect(files.length).toBe(1);
    expect(files[0].filename).toBe("real_file.txt");
  });

  it("should detect duplicate files based on content hash", async () => {
    const content = "Unique invoice text content";
    fs.writeFileSync(path.join(tempWorkspace, "inv1.txt"), content);
    fs.writeFileSync(path.join(tempWorkspace, "inv2.txt"), content);

    const { scan } = await scanDirectory(tempWorkspace, "scan-5");
    expect(scan.totalFiles).toBe(2);
    expect(scan.duplicateCount).toBe(1); // 1 duplicate found
    expect(scan.duplicateBytes).toBeGreaterThan(0);
  });

  it("should strictly REFUSE to scan root filesystem", async () => {
    await expect(scanDirectory("/", "scan-root")).rejects.toThrow(
      /Refusing to scan protected root filesystem path/
    );
  });
});
