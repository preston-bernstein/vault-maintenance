import { describe, it, expect } from "vitest";
import { parseWikiLinks } from "../src/utils/wiki-link-parser.js";

describe("parseWikiLinks", () => {
  it("extracts simple wiki-links", () => {
    const content = "See [[Some Page]] for details.";
    const links = parseWikiLinks(content, "test.md");

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      raw: "[[Some Page]]",
      target: "Some Page",
      alias: null,
      isEmbed: false,
      line: 1,
      sourceFile: "test.md",
    });
  });

  it("extracts aliased links", () => {
    const content = "Check [[Real Page|display text]] here.";
    const links = parseWikiLinks(content, "test.md");

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      target: "Real Page",
      alias: "display text",
    });
  });

  it("extracts pathed links", () => {
    const content = "See [[Network/Devices/Router]] for config.";
    const links = parseWikiLinks(content, "test.md");

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      target: "Network/Devices/Router",
    });
  });

  it("extracts embedded links", () => {
    const content = "Image: ![[photo.png]]";
    const links = parseWikiLinks(content, "test.md");

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      target: "photo.png",
      isEmbed: true,
    });
  });

  it("extracts multiple links on one line", () => {
    const content = "See [[Page A]] and [[Page B]] and [[Page C]].";
    const links = parseWikiLinks(content, "test.md");

    expect(links).toHaveLength(3);
    expect(links.map((l) => l.target)).toEqual(["Page A", "Page B", "Page C"]);
  });

  it("tracks line numbers correctly", () => {
    const content = [
      "Line one",
      "[[Link on line 2]]",
      "",
      "[[Link on line 4]]",
    ].join("\n");
    const links = parseWikiLinks(content, "test.md");

    expect(links).toHaveLength(2);
    expect(links[0].line).toBe(2);
    expect(links[1].line).toBe(4);
  });

  it("skips links inside fenced code blocks", () => {
    const content = [
      "Before code.",
      "```",
      "[[Should Be Skipped]]",
      "```",
      "[[Should Be Found]]",
    ].join("\n");
    const links = parseWikiLinks(content, "test.md");

    expect(links).toHaveLength(1);
    expect(links[0].target).toBe("Should Be Found");
  });

  it("handles nested code fences correctly", () => {
    const content = [
      "[[Before]]",
      "```markdown",
      "[[Inside First]]",
      "```",
      "[[Between]]",
      "```js",
      "[[Inside Second]]",
      "```",
      "[[After]]",
    ].join("\n");
    const links = parseWikiLinks(content, "test.md");

    expect(links).toHaveLength(3);
    expect(links.map((l) => l.target)).toEqual(["Before", "Between", "After"]);
  });

  it("returns empty array for content with no links", () => {
    const content = "Just some plain text without any links.";
    const links = parseWikiLinks(content, "test.md");

    expect(links).toHaveLength(0);
  });

  it("handles aliased pathed embedded links", () => {
    const content = "![[Folder/Image.png|alt text]]";
    const links = parseWikiLinks(content, "test.md");

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      target: "Folder/Image.png",
      alias: "alt text",
      isEmbed: true,
    });
  });
});
