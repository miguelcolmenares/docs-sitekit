import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDocuments, validateContent } from "../../../template/src/application";
import { FINDING_KINDS, formatFinding } from "../../../template/src/domain";
import { loadSiteConfig, readSources } from "../../../template/src/infrastructure";

const ROOT = join(__dirname, "..", "..", "..");

let repo: string;
let site: string;

const write = (path: string, content: string) => {
  const full = join(repo, path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
};

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "sitekit-options-"));
  site = join(repo, "site");
  mkdirSync(site);
  writeFileSync(
    join(site, "sitekit.config.json"),
    JSON.stringify({
      site: { name: "Demo", description: "d", url: "https://me.github.io" },
      hero: { title: "Demo", lede: "l", primary: { label: "Go", href: "/docs/" } },
      collections: [{ id: "docs", label: "Docs", dir: "../docs" }],
      anonymize: { excludePaths: ["docs/hidden.md"] },
    }),
  );
  write("docs/guide.md", "# Guide\n\nThe guide.\n\n## Part one\n\nText.\n");
  write("docs/hidden.md", "# Hidden\n");
  // One problem of each kind on the lines that the page "Options: content checks and publishing" shows.
  write(
    "docs/problems.md",
    [
      "---",
      "titel: x",
      "order: first",
      "---",
      "",
      "# Problems",
      "",
      "Link [one](./nope.md), excluded [two](./hidden.md), anchor [three](./guide.md#nowhere).",
      "",
      "![pic](./pic.png)",
      "",
      "> [!NOTES]",
      "> A note.",
      "",
      "<!-- include: missing.md -->",
      "",
      "Variable {{ undeclared }}.",
      "",
      "## Same",
      "",
      "## Same",
      "",
    ].join("\n"),
  );
  write(
    "docs/card.md",
    '---\nmeta:\n  - lable: Version\n    value: "1"\n---\n\n# Card page\n\nText.\n',
  );
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("the findings that the page Options: content checks and publishing shows", () => {
  it("are the lines that the build prints for a page with one problem of each kind", () => {
    const config = loadSiteConfig(site);
    const sources = readSources(site, config);
    const documents = buildDocuments(sources.files, {
      base: "/",
      collections: config.collections,
    });
    const found = validateContent(sources.files, documents, {
      config,
      existing: sources.existing,
    });
    const page = readFileSync(join(ROOT, "docs", "options-checks.md"), "utf8");
    for (const kind of FINDING_KINDS) {
      const finding = found.find((candidate) => candidate.kind === kind);
      expect({ kind, found: finding !== undefined }).toEqual({ kind, found: true });
      expect({ kind, line: page.includes(`\`${formatFinding(finding!)}\``) }).toEqual({
        kind,
        line: true,
      });
    }
  });
});
