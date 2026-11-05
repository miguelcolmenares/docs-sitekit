import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCodeMeta, readDiffLanguage, readDiffMarkers } from "../../../template/src/domain";

const ROOT = join(__dirname, "..", "..", "..");

/** The fenced blocks of a page: the language, the meta string and the code. */
function fences(markdown: string) {
  return [...markdown.matchAll(/^(`{3,})(\w*)[ \t]*([^\n]*)\n([\s\S]*?)^\1[ \t]*$/gm)].map(
    (match) => ({
      lang: match[2]!,
      meta: match[3]!,
      code: match[4]!,
    }),
  );
}

// The project documents itself with its own kit, so its Code blocks page is also the proof that the site
// shows a title, highlighted lines and diff lines, and that the page is on the site for the browser meter.
describe("the Code blocks page of this project's documentation", () => {
  const page = readFileSync(join(ROOT, "docs", "code-blocks.md"), "utf8");
  const blocks = fences(page);
  const config = JSON.parse(
    readFileSync(join(ROOT, "template", "sitekit.config.json"), "utf8"),
  ) as { collections: Array<{ id: string; groups?: Array<{ items: string[] }> }> };

  it("shows a titled block, a block with highlighted lines, and a block with a title and highlighted lines", () => {
    const metas = blocks.map((block) => parseCodeMeta(block.meta));
    expect(metas.some((meta) => meta.title && meta.highlighted.length === 0)).toBe(true);
    expect(metas.some((meta) => !meta.title && meta.highlighted.length > 0)).toBe(true);
    expect(metas.some((meta) => meta.title && meta.highlighted.length > 0)).toBe(true);
  });

  it("highlights lines that exist: no range goes past the end of its block", () => {
    for (const block of blocks) {
      const lineCount = block.code.replace(/\n$/, "").split("\n").length;
      for (const [first, last] of parseCodeMeta(block.meta).highlighted) {
        expect(first).toBeLessThanOrEqual(lineCount);
        expect(last).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("shows added and removed lines both ways: with comments and in the diff language", () => {
    const marked = blocks.some((block) => {
      const marks = readDiffMarkers(block.code).marks;
      return marks.includes("add") && marks.includes("remove");
    });
    const diff = blocks.some((block) => {
      if (block.lang !== "diff") return false;
      const marks = readDiffLanguage(block.code);
      return marks.includes("add") && marks.includes("remove");
    });
    expect(marked).toBe(true);
    expect(diff).toBe(true);
  });

  it("has a line wider than a phone, so the layout of a long line is measured on the site", () => {
    expect(blocks.some((block) => block.code.split("\n").some((line) => line.length > 110))).toBe(
      true,
    );
  });

  it("is listed in a group of the docs collection, so it is on the site", () => {
    const docs = config.collections.find((collection) => collection.id === "docs");
    expect(docs?.groups?.flatMap((group) => group.items)).toContain("code-blocks");
  });

  it("is described in docs/content.md, which links to it", () => {
    const content = readFileSync(join(ROOT, "docs", "content.md"), "utf8");
    expect(content).toMatch(/^## Code blocks$/m);
    expect(content).toContain("(./code-blocks.md)");
  });
});
