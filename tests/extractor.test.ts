import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import * as xlsx from "xlsx";
import { extractFileSample, getMimeType } from "../server/src/core/extractor.js";

describe("Content Extractor - Spreadsheet Support (.xlsx & .xlsb)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lazydesk-excel-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should extract structured sheet data and preview from .xlsx file", async () => {
    const filePath = path.join(tempDir, "company_finances.xlsx");

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([
      ["Category", "Q1 Budget", "Q1 Actual"],
      ["Engineering", "$50,000", "$48,500"],
      ["Marketing", "$20,000", "$19,200"],
    ]);
    xlsx.utils.book_append_sheet(wb, ws, "Financials 2026");
    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    fs.writeFileSync(filePath, buf);

    const result = await extractFileSample(filePath, 3000, 50);

    expect(result.isSupported).toBe(true);
    expect(result.mimeType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(result.sample).toContain("Financials 2026");
    expect(result.sample).toContain("Engineering");
    expect(result.sample).toContain("Marketing");
  });

  it("should extract structured sheet data and preview from binary .xlsb file", async () => {
    const filePath = path.join(tempDir, "big_dataset.xlsb");

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([
      ["Product ID", "Units Sold", "Revenue"],
      ["P-101", 1500, "$150,000"],
      ["P-204", 820, "$82,000"],
    ]);
    xlsx.utils.book_append_sheet(wb, ws, "Sales Summary");
    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsb" });
    fs.writeFileSync(filePath, buf);

    const result = await extractFileSample(filePath, 3000, 50);

    expect(result.isSupported).toBe(true);
    expect(result.mimeType).toBe("application/vnd.ms-excel.sheet.binary.macroEnabled.12");
    expect(result.sample).toContain("Sales Summary");
    expect(result.sample).toContain("Units Sold");
    expect(result.sample).toContain("P-101");
  });
});
