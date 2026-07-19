import { describe, it, expect } from "vitest";
import { generateReport, writeReport } from "../src/reporter.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ReportData } from "../src/types.js";

function makeReportData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    timestamp: new Date("2026-02-08T14:30:00"),
    totalFiles: 154,
    totalLinks: 347,
    brokenLinks: [],
    ambiguousLinks: [],
    indexReports: [],
    aiSuggestions: [],
    ...overrides,
  };
}

describe("generateReport", () => {
  it("generates a report with correct header", () => {
    const report = generateReport(makeReportData());

    expect(report).toContain("# Vault maintenance report");
    expect(report).toContain("2026-02-08");
    expect(report).toContain("Scanned 154 files. Found 347 links.");
  });

  it("shows broken links table when present", () => {
    const report = generateReport(
      makeReportData({
        brokenLinks: [
          {
            link: {
              raw: "[[Old Device]]",
              target: "Old Device",
              alias: null,
              isEmbed: false,
              line: 15,
              sourceFile: "Network/Change Log.md",
            },
            status: "broken",
            resolvedTo: null,
            candidates: [],
          },
        ],
      }),
    );

    expect(report).toContain("## 🔗 Broken links (1)");
    expect(report).toContain("`[[Old Device]]`");
    expect(report).toContain("[[Network/Change Log]]");
  });

  it('shows "None found" for empty sections', () => {
    const report = generateReport(makeReportData());

    expect(report).toContain("None found.");
  });

  it("includes AI suggestions when present", () => {
    const report = generateReport(
      makeReportData({
        brokenLinks: [
          {
            link: {
              raw: "[[Old Device]]",
              target: "Old Device",
              alias: null,
              isEmbed: false,
              line: 15,
              sourceFile: "Network/Change Log.md",
            },
            status: "broken",
            resolvedTo: null,
            candidates: [],
          },
        ],
        aiSuggestions: [
          {
            brokenLink: {
              raw: "[[Old Device]]",
              target: "Old Device",
              alias: null,
              isEmbed: false,
              line: 15,
              sourceFile: "Network/Change Log.md",
            },
            suggestedTarget: "Network/Devices/AT&T Router",
            confidence: 0.85,
            reasoning: "Similar device name",
          },
        ],
      }),
    );

    expect(report).toContain("### 🧠 AI suggestions");
    expect(report).toContain("0.85");
    expect(report).toContain("[[Network/Devices/AT&T Router]]");
  });

  it("includes summary table", () => {
    const report = generateReport(makeReportData());

    expect(report).toContain("## ✅ Summary");
    expect(report).toContain("| Total files | 154 |");
    expect(report).toContain("| Total links | 347 |");
  });

  it("includes stale index section with missing and stale links", () => {
    const report = generateReport(
      makeReportData({
        indexReports: [
          {
            indexFile: {
              relativePath: "Folder/Index.md",
              name: "Index",
              absolutePath: "/vault/Folder/Index.md",
            },
            missingLinks: [
              {
                relativePath: "Folder/Unlisted.md",
                name: "Unlisted",
                absolutePath: "/vault/Folder/Unlisted.md",
              },
            ],
            staleLinks: [
              {
                raw: "[[Gone]]",
                target: "Gone",
                alias: null,
                isEmbed: false,
                line: 5,
                sourceFile: "Folder/Index.md",
              },
            ],
          },
        ],
      }),
    );

    expect(report).toContain("## 📘 Stale indexes (1)");
    expect(report).toContain("### Folder/Index.md");
    expect(report).toContain("Missing links to:");
    expect(report).toContain("`Unlisted` (exists in folder, not linked)");
    expect(report).toContain("Stale links:");
    expect(report).toContain("`[[Gone]]` (linked but file does not exist)");
  });

  it('shows "All indexes are up to date" when no stale indexes', () => {
    const report = generateReport(makeReportData({ indexReports: [] }));
    expect(report).toContain("## 📘 Stale indexes (0)");
    expect(report).toContain("All indexes are up to date.");
  });

  it("formats timestamp with invalid date fallback", () => {
    const report = generateReport(
      makeReportData({ timestamp: new Date("invalid") as unknown as Date }),
    );
    expect(report).toContain("# Vault maintenance report");
    expect(report).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("writeReport", () => {
  it("writes a report file with date-based name", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "vault-test-"));
    try {
      const report = "# Test report";
      const timestamp = new Date("2026-02-08T14:30:00");

      const filePath = await writeReport(report, tmp, "Reports", timestamp);

      expect(filePath).toContain("2026-02-08.md");
      const content = await readFile(filePath, "utf-8");
      expect(content).toBe("# Test report");
    } finally {
      await rm(tmp, { recursive: true });
    }
  });

  it("adds counter suffix for same-day reports", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "vault-test-"));
    try {
      const report = "# Test report";
      const timestamp = new Date("2026-02-08T14:30:00");

      const first = await writeReport(report, tmp, "Reports", timestamp);
      const second = await writeReport(report, tmp, "Reports", timestamp);

      expect(first).toContain("2026-02-08.md");
      expect(second).toContain("2026-02-08-2.md");
    } finally {
      await rm(tmp, { recursive: true });
    }
  });
});
