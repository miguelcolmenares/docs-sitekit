import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../presentation";
import { buildDocuments, validateContent } from "../../../template/src/application";
import { formatFinding } from "../../../template/src/domain";
import { loadSite, loadSiteConfig, readSources } from "../../../template/src/infrastructure";

let repo: string;
let site: string;

const write = (path: string, content: string) => {
  const full = join(repo, path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
};

const config = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    site: { name: "Demo", description: "d", url: "https://me.github.io" },
    hero: { title: "Demo", lede: "l", primary: { label: "Go", href: "/docs/" } },
    collections: [{ id: "docs", label: "Docs", dir: "../docs" }],
    deploy: { repositoryVisibility: "public" },
    anonymize: { excludePaths: ["docs/internal/**"] },
    ...extra,
  });

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "sitekit-findings-"));
  site = join(repo, "site");
  mkdirSync(site);
  writeFileSync(join(site, "sitekit.config.json"), config());
  write("docs/internal/plan.md", "# Plan\n\nPrivate.\n");
  write("docs/img/flow.png", "not really a png");
  write("docs/guide.md", "# Guide\n\nThe guide.\n\n## Advanced\n\nMore.\n");
  // Frontmatter shifts the content: line 1 and 2 are the fences and the title, the heading is line 5.
  write(
    "docs/start.md",
    [
      "---",
      "titel: Start",
      "order: 1",
      "---",
      "",
      "# Start",
      "",
      "Good [guide](./guide.md#advanced), bad [anchor](./guide.md#nope), [gone](./gone.md).",
      "",
      "![flow](./img/flow.png) ![missing](./img/missing.png)",
      "",
      "A [plan](./internal/plan.md) is not on the site.",
      "",
      "`[in code](./gone.md)`",
      "",
      "```md",
      "[in a fence](./gone.md) ![x](./gone.png)",
      "```",
      "",
    ].join("\n"),
  );
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

function findings() {
  const loaded = loadSiteConfig(site);
  const sources = readSources(site, loaded);
  const documents = buildDocuments(sources.files, { base: "/", collections: loaded.collections });
  return validateContent(sources.files, documents, { config: loaded, existing: sources.existing });
}

describe("content findings on real files", () => {
  it("reports each problem at the line of the file where it is written, frontmatter included", () => {
    expect(findings().map(formatFinding)).toEqual([
      expect.stringMatching(
        /^docs\/start\.md:2: warning: Frontmatter key "titel".*Did you mean "title"\?$/,
      ),
      'docs/start.md:8: warning: Link "./guide.md#nope" points to a heading that does not exist in docs/guide.md',
      'docs/start.md:8: warning: Link "./gone.md" does not match any file',
      'docs/start.md:10: error: Image "./img/missing.png" does not exist',
      'docs/start.md:12: warning: Link "./internal/plan.md" points to an excluded file, so only its text is kept',
    ]);
  });

  it("counts lines the same way in a file with Windows line endings", () => {
    write(
      "docs/windows.md",
      "---\r\ntitle: Windows\r\n---\r\n\r\n# Windows\r\n\r\n[gone](./gone.md)\r\n",
    );
    const found = findings().filter((item) => item.file === "docs/windows.md");
    expect(found.map((item) => item.line)).toEqual([7]);
  });

  it("counts from line 1 in a file with no frontmatter", () => {
    write("docs/plain.md", "# Plain\n\n[gone](./gone.md)\n");
    expect(findings().find((item) => item.file === "docs/plain.md")!.line).toBe(3);
  });

  it("does not read a file that is excluded", () => {
    write("docs/internal/plan.md", "# Plan\n\n![x](./nope.png) [y](./nope.md)\n");
    expect(findings().filter((item) => item.file.startsWith("docs/internal"))).toEqual([]);
  });

  it("is what loadSite hands to the build to print", () => {
    const loaded = loadSite(site);
    expect(loaded.findings.map(formatFinding)).toEqual(findings().map(formatFinding));
  });
});

describe("sitekit check on real files", () => {
  const run = () => {
    const out: string[] = [];
    const err: string[] = [];
    const code = runCli(["check", "--root", repo], {
      out: (text) => out.push(text),
      err: (text) => err.push(text),
      cwd: repo,
      templateRoot: join(__dirname, "..", "..", "..", "template"),
    });
    return { code, out: out.join(""), err: err.join("") };
  };

  it("prints warnings and errors with file and line, counts them, and exits non-zero on an error", () => {
    const { code, out, err } = run();
    expect(code).toBe(1);
    expect(out).toMatch(/docs\/start\.md:8: warning: Link "\.\/gone\.md" does not match any file/);
    expect(err).toContain('docs/start.md:10: error: Image "./img/missing.png" does not exist\n');
    expect(out).toContain("Content: 1 error, 4 warnings.");
    expect(out).toContain("1 problem(s). Not safe to publish.");
  });

  it("exits zero when the image is only a warning by the config", () => {
    writeFileSync(join(site, "sitekit.config.json"), config({ check: { images: "warning" } }));
    const { code, out } = run();
    expect(code).toBe(0);
    expect(out).toContain("docs/start.md:10: warning: Image");
    expect(out).toContain("Safe to publish.");
  });

  it("exits zero with the warnings printed once every kind that found something is off", () => {
    writeFileSync(
      join(site, "sitekit.config.json"),
      config({
        check: {
          images: "off",
          links: "off",
          anchors: "off",
          excludedLinks: "off",
          frontmatter: "off",
        },
      }),
    );
    const { code, out } = run();
    expect(code).toBe(0);
    expect(out).not.toContain("docs/start.md");
    expect(out).toContain("Safe to publish.");
  });

  it("fails on an unknown kind and names it", () => {
    writeFileSync(join(site, "sitekit.config.json"), config({ check: { linkz: "error" } }));
    const { code, err } = run();
    expect(code).toBe(1);
    expect(err).toMatch(/check\.linkz: "linkz" is not a kind of finding/);
  });
});
