import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addComponent, listComponents } from "../../application";
import { runCli } from "../../presentation";
import { formatFinding } from "../../../template/src/domain";
import { buildDocuments, validateContent } from "../../../template/src/application";
import { loadSite, loadSiteConfig, readSources } from "../../../template/src/infrastructure";
import { nodeFileSystem, packagedTemplate, sha256 } from "../../infrastructure";

const TEMPLATE = join(__dirname, "..", "..", "..", "template");

let repo: string;
let site: string;

const write = (path: string, content: string) => {
  const full = join(repo, path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
};

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "sitekit-sidecard-"));
  site = join(repo, "site");
  mkdirSync(site);
  write("src/index.ts", "export {}");
  write("LICENSE", "MIT");
  writeFileSync(
    join(site, "sitekit.config.json"),
    JSON.stringify({
      site: {
        name: "Demo",
        description: "d",
        url: "https://me.github.io",
        repository: "https://github.com/me/proj",
      },
      hero: { title: "Demo", lede: "l", primary: { label: "Go", href: "/docs/" } },
      collections: [{ id: "docs", label: "Docs", dir: "../docs" }],
      deploy: { repositoryVisibility: "public" },
    }),
  );
  write("docs/guide.md", "# Guide\n\nHow to use it.\n");
  write(
    "docs/widget.md",
    [
      "---",
      "meta:",
      "  - label: Version",
      '    value: "1.2.0"',
      "  - lable: License",
      "    value: MIT",
      "links:",
      "  - label: Guide",
      "    href: ./guide.md",
      "  - label: License file",
      "    href: ../LICENSE",
      "  - label: Missing",
      "    href: ./nope.md",
      "tags: [Plugin]",
      "---",
      "",
      "# Widget",
      "",
      "A widget.",
      "",
    ].join("\n"),
  );
  write("docs/plain.md", "---\ntags: [Plugin]\n---\n\n# Plain\n\nNo card.\n");
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("the side card, with real files", () => {
  it("is in the registry that `list` prints", () => {
    const registry = packagedTemplate(TEMPLATE).registry();
    expect(listComponents(registry).map((component) => component.name)).toContain("side-card");
  });

  it("is restored by `add` with the files it needs, and the filter it builds on", () => {
    const deps = { fs: nodeFileSystem, template: packagedTemplate(TEMPLATE), hash: sha256 };
    const result = addComponent(deps, { siteAbs: site, name: "side-card" });
    for (const path of [
      "src/presentation/components/site/SideCard.tsx",
      "src/presentation/sideCard/sideCard.ts",
      "src/domain/sideCard.ts",
      "src/domain/filter/tags.ts",
    ]) {
      expect(result.written).toContain(path);
      expect(readFileSync(join(site, path), "utf8")).toBe(
        readFileSync(join(TEMPLATE, path), "utf8"),
      );
    }
    expect(result.missingPackages).toEqual([]);
  });

  it("gives a page its card from the frontmatter, with links resolved like the links in the text", () => {
    const { documents } = loadSite(site);
    const bySlug = Object.fromEntries(documents.map((doc) => [doc.slug, doc]));
    expect(bySlug.widget!.card).toEqual({
      rows: [{ label: "Version", value: "1.2.0" }],
      links: [
        { label: "Guide", href: "/docs/guide/", item: 0 },
        { label: "License file", href: "https://github.com/me/proj/blob/HEAD/LICENSE", item: 1 },
      ],
      tags: ["Plugin"],
    });
    expect(bySlug.plain!.card).toBeUndefined();
    expect(bySlug.guide!.card).toBeUndefined();
  });

  it("hands the problems of the card to the build as findings with the line of the key in the file", () => {
    const { findings } = loadSite(site);
    expect(findings.map(formatFinding)).toEqual([
      expect.stringMatching(/^docs\/widget\.md:5: error: Item 2 of "meta" has the key "lable"/),
      expect.stringMatching(/^docs\/widget\.md:5: error: Item 2 of "meta" needs "label" as text/),
      'docs/widget.md:13: warning: Card link "Missing": Link "./nope.md" does not match any file',
    ]);
  });
});

describe("a link with a script scheme, with real files", () => {
  it("never reaches the card, and is an error that names the link and its line", () => {
    write(
      "docs/script.md",
      [
        "---",
        "links:",
        "  - label: Script",
        '    href: "javascript:alert(1)"',
        "  - label: Guide",
        "    href: ./guide.md",
        "---",
        "",
        "# Script",
        "",
      ].join("\n"),
    );
    // `loadSite` keeps its first result for the process, so the pieces it is made of are called here.
    const loaded = loadSiteConfig(site);
    const sources = readSources(site, loaded);
    const documents = buildDocuments(sources.files, { base: "/", collections: loaded.collections });
    const findings = validateContent(sources.files, documents, {
      config: loaded,
      existing: sources.existing,
    });
    expect(documents.find((doc) => doc.slug === "script")!.card!.links).toEqual([
      { label: "Guide", href: "./guide.md", item: 1 },
    ]);
    expect(findings.filter((item) => item.file === "docs/script.md")).toEqual([
      expect.objectContaining({ kind: "card", severity: "error", line: 4 }),
    ]);
  });
});

describe("sitekit check, with a side card", () => {
  const check = () => {
    const out: string[] = [];
    const err: string[] = [];
    const code = runCli(["check", "--root", repo], {
      out: (text) => out.push(text),
      err: (text) => err.push(text),
      cwd: repo,
      templateRoot: TEMPLATE,
    });
    return { code, out: out.join(""), err: err.join("") };
  };

  it("fails on an unknown key under meta, with the file and the line of the key", () => {
    const { code, err, out } = check();
    expect(code).toBe(1);
    expect(err).toContain('docs/widget.md:5: error: Item 2 of "meta" has the key "lable"');
    expect(out).toContain('docs/widget.md:13: warning: Card link "Missing"');
    expect(out).toContain("Not safe to publish.");
  });

  it("passes once the key is fixed, and a link to a missing file stays a warning", () => {
    const widget = readFileSync(join(repo, "docs/widget.md"), "utf8").replace(
      "lable: License",
      "label: License",
    );
    write("docs/widget.md", widget);
    const { code, out } = check();
    expect(code).toBe(0);
    expect(out).toContain("docs/widget.md:13: warning");
    expect(out).toContain("Safe to publish.");
  });

  it("follows check.card in the config", () => {
    const path = join(site, "sitekit.config.json");
    const config = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    writeFileSync(path, JSON.stringify({ ...config, check: { card: "warning" } }));
    const { code, out } = check();
    expect(code).toBe(0);
    expect(out).toContain("docs/widget.md:5: warning: Item 2");
  });
});
