import { describe, it, expect, vi } from "vitest";
import {
  scanVault,
  getMarkdownFiles,
  getMarkdownFileCount,
} from "../src/scanner.js";
import { defaultScanOptions } from "./helpers.js";

describe("scanVault", () => {
  it("finds all markdown files excluding .obsidian", async () => {
    const result = await scanVault(defaultScanOptions());

    const mdFiles = result.files.filter((f) => f.relativePath.endsWith(".md"));
    expect(mdFiles.length).toBe(8);

    // .obsidian should be excluded
    const obsidianFiles = result.files.filter((f) =>
      f.relativePath.startsWith(".obsidian"),
    );
    expect(obsidianFiles).toHaveLength(0);
  });

  it("builds fileIndex with relative paths", async () => {
    const result = await scanVault(defaultScanOptions());

    expect(result.fileIndex.has("FolderA/Page One.md")).toBe(true);
    expect(result.fileIndex.has("Root Note.md")).toBe(true);
  });

  it("builds nameIndex grouping files by bare name", async () => {
    const result = await scanVault(defaultScanOptions());

    // "Overview" appears in both FolderA and FolderB
    const overviews = result.nameIndex.get("Overview");
    expect(overviews).toBeDefined();
    expect(overviews!.length).toBe(2);
  });

  it("extracts links from all markdown files", async () => {
    const result = await scanVault(defaultScanOptions());

    expect(result.links.length).toBeGreaterThan(0);

    // Root Note has links to several targets
    const rootLinks = result.links.filter(
      (l) => l.sourceFile === "Root Note.md",
    );
    expect(rootLinks.length).toBe(4);
  });

  it("writes progress to stderr when verbose", async () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const result = await scanVault({
      ...defaultScanOptions(),
      verbose: true,
    });
    expect(result.files.length).toBeGreaterThan(0);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Scanned \d+ files/),
    );
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Found \d+ links/),
    );
    stderrSpy.mockRestore();
  });
});

describe("getMarkdownFiles", () => {
  it("returns only .md files from scan", async () => {
    const result = await scanVault(defaultScanOptions());
    const mdFiles = getMarkdownFiles(result);
    expect(mdFiles.every((f) => f.relativePath.endsWith(".md"))).toBe(true);
    expect(mdFiles.length).toBe(8);
  });
});

describe("getMarkdownFileCount", () => {
  it("returns count of markdown files without full array", async () => {
    const result = await scanVault(defaultScanOptions());
    const count = getMarkdownFileCount(result);
    expect(count).toBe(8);
  });
});
