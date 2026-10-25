import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { createApp } from "../server/src/server.js";
import { getDatabase, closeDatabase, initializeSchema } from "../server/src/db/database.js";

describe("LazyDesk REST API Endpoints", () => {
  let app: any;
  let tempWorkspace: string;
  let dbPath: string;

  beforeEach(() => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "lazydesk-api-test-"));
    dbPath = path.join(tempWorkspace, "test-api.sqlite");
    process.env.DATABASE_PATH = dbPath;
    const db = getDatabase(dbPath);
    initializeSchema(db);
    app = createApp();
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(tempWorkspace)) {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    }
    delete process.env.DATABASE_PATH;
  });

  it("GET /api/health should return ok and service metadata", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toContain("LazyDesk AI");
  });

  it("GET /api/ai/status should return status and instructions", async () => {
    const res = await request(app).get("/api/ai/status");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("isAvailable");
    expect(res.body).toHaveProperty("provider");
    expect(res.body).toHaveProperty("instructions");
  });

  it("GET /api/settings & PATCH /api/settings should read and update config", async () => {
    const getRes = await request(app).get("/api/settings");
    expect(getRes.status).toBe(200);
    expect(getRes.body.settings.ollamaBaseUrl).toBe("http://127.0.0.1:11434");

    const patchRes = await request(app)
      .patch("/api/settings")
      .send({ confidenceThreshold: 0.85, theme: "light" });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.settings.confidenceThreshold).toBe(0.85);
    expect(patchRes.body.settings.theme).toBe("light");
  });

  it("POST /api/scan should validate input and reject empty folderPath", async () => {
    const res = await request(app).post("/api/scan").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid request payload");
  });

  it("POST /api/scan should scan directory and return scan results", async () => {
    fs.writeFileSync(path.join(tempWorkspace, "doc.txt"), "Testing LazyDesk");

    const res = await request(app)
      .post("/api/scan")
      .send({ folderPath: tempWorkspace });

    expect(res.status).toBe(201);
    expect(res.body.scan.totalFiles).toBe(1);
    expect(res.body.files.length).toBe(1);
    expect(res.body.files[0].filename).toBe("doc.txt");
  });

  it("Complete workflow: scan -> analyze -> edit suggestion -> apply -> undo", async () => {
    // 1. Create sample file
    const samplePath = path.join(tempWorkspace, "report_october.txt");
    fs.writeFileSync(samplePath, "Quarterly engineering progress report for October 2026");

    // 2. Scan
    const scanRes = await request(app)
      .post("/api/scan")
      .send({ folderPath: tempWorkspace });
    expect(scanRes.status).toBe(201);
    const scanId = scanRes.body.scan.id;

    // 3. Analyze (using offline rule-based fallback if Ollama isn't active)
    const analyzeRes = await request(app)
      .post("/api/organize/analyze")
      .send({ scanId });
    expect(analyzeRes.status).toBe(200);
    expect(analyzeRes.body.suggestions.length).toBeGreaterThan(0);
    const suggestionId = analyzeRes.body.suggestions[0].id;

    // 4. Edit suggestion
    const editRes = await request(app)
      .patch(`/api/organize/suggestions/${suggestionId}`)
      .send({
        suggestedName: "october-progress-report.txt",
        destinationFolder: "Reports/2026",
      });
    expect(editRes.status).toBe(200);
    expect(editRes.body.suggestion.suggestedName).toBe("october-progress-report.txt");

    // 5. Apply
    const applyRes = await request(app)
      .post("/api/organize/apply")
      .send({ scanId, suggestionIds: [suggestionId] });
    expect(applyRes.status).toBe(200);
    expect(applyRes.body.appliedCount).toBe(1);
    const opId = applyRes.body.operations[0].id;

    // Verify file moved to target
    const expectedTarget = path.join(tempWorkspace, "Reports", "2026", "october-progress-report.txt");
    expect(fs.existsSync(expectedTarget)).toBe(true);
    expect(fs.existsSync(samplePath)).toBe(false);

    // 6. Undo
    const undoRes = await request(app)
      .post("/api/organize/undo")
      .send({ operationId: opId });
    expect(undoRes.status).toBe(200);
    expect(undoRes.body.success).toBe(true);

    // Verify file restored to original
    expect(fs.existsSync(samplePath)).toBe(true);
    expect(fs.existsSync(expectedTarget)).toBe(false);
  });
});
