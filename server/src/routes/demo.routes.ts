import { Router, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  insertScan,
  insertScannedFiles,
  insertSuggestions,
  updateSettings,
} from "../db/database.js";
import { computeFileHashSync } from "../core/hasher.js";
import type { ScanRecord, ScannedFile, AISuggestion } from "@lazydesk/shared";

export const demoRouter = Router();

// POST /api/demo/seed-files: creates real sample files in test-data/ folder
demoRouter.post("/seed-files", (_req: Request, res: Response) => {
  const testDir = path.join(process.cwd(), "test-data");
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Realistic sample files that people who procrastinate on file organization typically have:
  const sampleFiles = [
    {
      name: "IMG_20261012_draft_header.png",
      content: Buffer.from("fake-png-content-header-banner-hacktoberfest-2026"),
    },
    {
      name: "IMG_20261012_draft_header_copy.png",
      content: Buffer.from("fake-png-content-header-banner-hacktoberfest-2026"), // Exact duplicate!
    },
    {
      name: "invoice_aug_unpaid_final_v2.txt",
      content: "INVOICE #2026-081\nDate: 2026-08-15\nClient: Acme Corp\nAmount: $1,250.00\nStatus: Pending Payment\nDescription: Frontend UI design and testing.",
    },
    {
      name: "invoice_aug_backup.txt",
      content: "INVOICE #2026-081\nDate: 2026-08-15\nClient: Acme Corp\nAmount: $1,250.00\nStatus: Pending Payment\nDescription: Frontend UI design and testing.", // Exact duplicate!
    },
    {
      name: "notes_react_auth_jwt.md",
      content: "# React Authentication Notes\n\nImplementing refresh token rotation with HTTP-only cookies in React 19.\nUse Zod for token schema validation.",
    },
    {
      name: "untitled_scraper_script.py",
      content: "import requests\nfrom bs4 import BeautifulSoup\n\ndef scrape_hacktoberfest_stats():\n    url = 'https://hacktoberfest.com'\n    resp = requests.get(url)\n    print('Fetched stats')",
    },
    {
      name: "quarterly_budget_q3_final_final.csv",
      content: "Quarter,Department,Budget,Spent,Difference\nQ3,Engineering,45000,42100,2900\nQ3,Marketing,15000,16500,-1500\nQ3,Design,8000,7200,800",
    },
    {
      name: "passport_scan_id_preview.pdf",
      content: "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\nDocument: Identity Verification Document for Traveler 2026\nIssued by Passport Authority\nValid through 2036",
    },
  ];

  for (const item of sampleFiles) {
    const dest = path.join(testDir, item.name);
    fs.writeFileSync(dest, item.content);
  }

  res.json({
    message: "Sample test files created successfully",
    folderPath: testDir,
    fileCount: sampleFiles.length,
  });
});

// POST /api/demo/seed-db: seeds realistic scan history and AI queue
demoRouter.post("/seed-db", (_req: Request, res: Response) => {
  const scanId = crypto.randomUUID();
  const testDir = path.join(process.cwd(), "test-data");

  const scanRecord: ScanRecord = {
    id: scanId,
    folderPath: testDir,
    status: "completed",
    totalFiles: 8,
    supportedFiles: 8,
    duplicateCount: 2,
    duplicateBytes: 154,
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    completedAt: new Date(Date.now() - 3590000).toISOString(),
  };

  insertScan(scanRecord);
  updateSettings({ demoMode: true });

  const files: ScannedFile[] = [
    {
      id: crypto.randomUUID(),
      scanId,
      relativePath: "invoice_aug_unpaid_final_v2.txt",
      absolutePath: path.join(testDir, "invoice_aug_unpaid_final_v2.txt"),
      filename: "invoice_aug_unpaid_final_v2.txt",
      extension: ".txt",
      size: 112,
      modifiedAt: new Date(Date.now() - 86400000).toISOString(),
      mimeType: "text/plain",
      sha256Hash: "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
      isSupported: true,
      contentSample: "INVOICE #2026-081\nDate: 2026-08-15\nClient: Acme Corp...",
      status: "scanned",
    },
    {
      id: crypto.randomUUID(),
      scanId,
      relativePath: "invoice_aug_backup.txt",
      absolutePath: path.join(testDir, "invoice_aug_backup.txt"),
      filename: "invoice_aug_backup.txt",
      extension: ".txt",
      size: 112,
      modifiedAt: new Date(Date.now() - 86400000).toISOString(),
      mimeType: "text/plain",
      sha256Hash: "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592", // exact duplicate
      isSupported: true,
      contentSample: "INVOICE #2026-081\nDate: 2026-08-15\nClient: Acme Corp...",
      status: "scanned",
    },
    {
      id: crypto.randomUUID(),
      scanId,
      relativePath: "notes_react_auth_jwt.md",
      absolutePath: path.join(testDir, "notes_react_auth_jwt.md"),
      filename: "notes_react_auth_jwt.md",
      extension: ".md",
      size: 145,
      modifiedAt: new Date(Date.now() - 43200000).toISOString(),
      mimeType: "text/markdown",
      sha256Hash: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
      isSupported: true,
      contentSample: "# React Authentication Notes\n\nImplementing refresh token rotation...",
      status: "scanned",
    },
    {
      id: crypto.randomUUID(),
      scanId,
      relativePath: "untitled_scraper_script.py",
      absolutePath: path.join(testDir, "untitled_scraper_script.py"),
      filename: "untitled_scraper_script.py",
      extension: ".py",
      size: 198,
      modifiedAt: new Date(Date.now() - 172800000).toISOString(),
      mimeType: "text/x-python",
      sha256Hash: "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
      isSupported: true,
      contentSample: "import requests\nfrom bs4 import BeautifulSoup...",
      status: "scanned",
    },
  ];

  insertScannedFiles(files);

  const suggestions: AISuggestion[] = [
    {
      id: crypto.randomUUID(),
      fileId: files[0].id,
      scanId,
      originalPath: files[0].absolutePath,
      originalFilename: files[0].filename,
      category: "Finance",
      suggestedName: "invoice-acme-corp-2026-08.txt",
      destinationFolder: "Finance/Invoices/2026",
      targetPath: path.join(testDir, "Finance", "Invoices", "2026", "invoice-acme-corp-2026-08.txt"),
      reason: "Invoice for Acme Corp from August 2026",
      confidence: 0.94,
      needsReview: false,
      status: "pending",
      validationStatus: "valid",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      fileId: files[2].id,
      scanId,
      originalPath: files[2].absolutePath,
      originalFilename: files[2].filename,
      category: "Coding",
      suggestedName: "react-auth-jwt-refresh-tokens.md",
      destinationFolder: "Coding/React",
      targetPath: path.join(testDir, "Coding", "React", "react-auth-jwt-refresh-tokens.md"),
      reason: "Documentation notes on React JWT auth flow",
      confidence: 0.92,
      needsReview: false,
      status: "pending",
      validationStatus: "valid",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      fileId: files[3].id,
      scanId,
      originalPath: files[3].absolutePath,
      originalFilename: files[3].filename,
      category: "Coding",
      suggestedName: "hacktoberfest-stats-scraper.py",
      destinationFolder: "Coding/Python/Scrapers",
      targetPath: path.join(testDir, "Coding", "Python", "Scrapers", "hacktoberfest-stats-scraper.py"),
      reason: "Python script scraping Hacktoberfest statistics",
      confidence: 0.89,
      needsReview: false,
      status: "pending",
      validationStatus: "valid",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  insertSuggestions(suggestions);

  res.json({
    message: "Demo mode activated with realistic sample workspace",
    scan: scanRecord,
    filesCount: files.length,
    suggestionsCount: suggestions.length,
  });
});
