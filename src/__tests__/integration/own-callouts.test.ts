import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CALLOUT_KINDS, parseCalloutMarker } from "../../../template/src/domain";

const ROOT = join(__dirname, "..", "..", "..");

// The project documents itself with its own kit, so its callouts page is also the proof that the
// documentation shows every kind, and that the page is on the site.
describe("the Callouts page of this project's documentation", () => {
  const page = readFileSync(join(ROOT, "docs", "callouts.md"), "utf8");
  const config = JSON.parse(
    readFileSync(join(ROOT, "template", "sitekit.config.json"), "utf8"),
  ) as {
    collections: Array<{ id: string; groups?: Array<{ items: string[] }> }>;
  };

  it("shows each of the five kinds as a blockquote that opens with its marker", () => {
    const markers = page.split("\n").flatMap((line) => {
      const marker = parseCalloutMarker(line.replace(/^(\s*>\s?)+/, ""));
      return line.trimStart().startsWith(">") && marker ? [marker.kind] : [];
    });
    for (const kind of CALLOUT_KINDS) expect(markers).toContain(kind);
  });

  it("is listed in a group of the docs collection, so it is on the site", () => {
    const docs = config.collections.find((collection) => collection.id === "docs");
    expect(docs?.groups?.flatMap((group) => group.items)).toContain("callouts");
  });

  it("is described in docs/content.md, which links to it", () => {
    const content = readFileSync(join(ROOT, "docs", "content.md"), "utf8");
    expect(content).toMatch(/^## Callouts$/m);
    expect(content).toContain("(./callouts.md)");
    for (const kind of CALLOUT_KINDS) expect(content).toContain(`[!${kind.toUpperCase()}]`);
  });
});
