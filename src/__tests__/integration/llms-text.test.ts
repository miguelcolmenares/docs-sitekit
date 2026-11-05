import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDocuments, buildLlmsText, publishedRoutes } from "../../../template/src/application";
import { absoluteUrl, matchesAny, renderMarkdownPage } from "../../../template/src/domain";
import type { Document, LinkContext } from "../../../template/src/domain";
import { loadSiteConfig, readSources } from "../../../template/src/infrastructure";

const ORIGIN = "https://me.github.io";

const START = [
  "---",
  "order: 1",
  "---",
  "",
  "# Start here",
  "",
  "[![CI](https://img.shields.io/ci.svg)](https://ci.example.com) [![npm](https://img.shields.io/npm.svg)](https://npm.example.com)",
  "",
  "| Option | Default |",
  "| ------ | ------- |",
  "| `base` | `/` |",
  "",
  "```sh",
  "# install the tool, then read [the guide](deploy.md)",
  "npm ci",
  "```",
  "",
  "Install it, then run the **first** build.",
  "",
  "A `[note](deploy.md)` in code stays as written.",
  "",
  "Next, read [deploying](deploy.md#pages), the [changelog](../CHANGELOG.md), the [license](../LICENSE),",
  "the [secret plan](internal/plan.md), [docs](https://example.com/docs) and [the top](#install).",
  "",
  "## Install",
  "",
  "Done.",
  "",
].join("\n");

let repo: string;
let site: string;

const write = (path: string, content: string) => {
  const full = join(repo, path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
};

const writeConfig = (base: string) =>
  write(
    "site/sitekit.config.json",
    JSON.stringify({
      site: {
        name: "Demo",
        description: "A demo of the llms.txt builder.",
        url: ORIGIN,
        base,
        repository: "https://github.com/me/demo",
      },
      hero: { title: "Demo", lede: "l", primary: { label: "Go", href: "/docs/" } },
      collections: [
        { id: "docs", label: "Docs", dir: "../docs" },
        { id: "notes", label: "Notes", dir: "../notes" },
        { id: "examples", label: "Examples", dir: "../examples" },
      ],
      llms: { enabled: true, optional: ["notes"], markdownPages: true },
      anonymize: { excludePaths: ["docs/internal/**"] },
    }),
  );

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "sitekit-llms-"));
  site = join(repo, "site");
  mkdirSync(site);
  write("docs/start.md", START);
  write("docs/deploy.md", "---\ntitle: Deploy [beta]\n---\n\nPublish the site to GitHub Pages.\n");
  write("docs/internal/plan.md", "# Plan\n\nPrivate.\n");
  write("notes/ideas.md", "# Ideas\n\nThings to try later.\n");
  write("examples/basic/README.md", "# Basic example\n\nThe smallest site.\n");
  write("CHANGELOG.md", "# Changelog\n\n## 1.0.0\n\nFirst release.\n");
  write("LICENSE", "MIT");
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

/** Everything the build does with the files: the same steps as `loadSite`, over the real loaders. */
function build(base: string) {
  writeConfig(base);
  const config = loadSiteConfig(site);
  const sources = readSources(site, config);
  const documents = buildDocuments(sources.files, {
    base: config.site.base,
    collections: config.collections,
  });
  const published = publishedRoutes(documents);
  const context = (document: Document): LinkContext => ({
    file: document.path,
    published,
    existing: sources.existing,
    isExcluded: (path) => matchesAny(path, config.anonymize.excludePaths),
    repositoryUrl: config.site.repository,
  });
  const markdownCopy = (path: string) => {
    const document = documents.find((candidate) => candidate.path === path)!;
    return renderMarkdownPage(document, {
      context: context(document),
      origin: config.site.url,
      pageUrl: absoluteUrl(config.site.url, document.route),
    });
  };
  return { llms: buildLlmsText(config, documents), markdownCopy };
}

describe("llms.txt from a folder of real markdown", () => {
  it("under a project base, writes the H1, the blockquote, one H2 per collection in order and Optional last", () => {
    expect(build("/demo/").llms).toBe(
      [
        "# Demo",
        "",
        "> A demo of the llms.txt builder.",
        "",
        "Repository: https://github.com/me/demo.",
        "",
        "## Docs",
        "",
        "- [Start here](https://me.github.io/demo/docs/start/): Install it, then run the first build.",
        "- [Deploy \\[beta\\]](https://me.github.io/demo/docs/deploy/): Publish the site to GitHub Pages.",
        "",
        "## Examples",
        "",
        "- [Basic example](https://me.github.io/demo/examples/basic/): The smallest site.",
        "",
        "## Changelog",
        "",
        "- [Changelog](https://me.github.io/demo/changelog/): First release.",
        "",
        "## Optional",
        "",
        "- [Ideas](https://me.github.io/demo/notes/ideas/): Things to try later.",
        "",
      ].join("\n"),
    );
  });

  it("under the root, writes the same list with addresses that have no base", () => {
    const { llms } = build("/");
    expect(llms).toContain("- [Start here](https://me.github.io/docs/start/): ");
    expect(llms).toContain("- [Basic example](https://me.github.io/examples/basic/): ");
    expect(llms).toContain("- [Ideas](https://me.github.io/notes/ideas/): ");
    expect(llms).not.toContain("/demo/");
    const headings = llms.split("\n").filter((line) => line.startsWith("## "));
    expect(headings).toEqual(["## Docs", "## Examples", "## Changelog", "## Optional"]);
    for (const link of llms.matchAll(/\]\((\S+?)\)/g)) expect(link[1]).toMatch(/^https:\/\//);
  });

  it("takes the description from the prose, not from the badges, the table or the fence", () => {
    const line = build("/")
      .llms.split("\n")
      .find((entry) => entry.includes("Start here"))!;
    expect(line).toContain(": Install it, then run the first build.");
    expect(line).not.toMatch(/shields|Option|Default|install the tool|npm ci/);
  });
});

describe("the Markdown copy of a page from real files", () => {
  it("makes every link absolute and leaves code as written", () => {
    const copy = build("/demo/").markdownCopy("docs/start.md");

    expect(copy.startsWith("# Start here\n\n")).toBe(true);
    // Links to published pages and to files outside the site become absolute addresses.
    expect(copy).toContain("[deploying](https://me.github.io/demo/docs/deploy/#pages)");
    expect(copy).toContain("[changelog](https://me.github.io/demo/changelog/)");
    expect(copy).toContain("[license](https://github.com/me/demo/blob/HEAD/LICENSE)");
    expect(copy).toContain("[docs](https://example.com/docs)");
    expect(copy).toContain("[the top](https://me.github.io/demo/docs/start/#install)");
    // A link to an excluded file keeps its words and loses its address.
    expect(copy).toContain("the secret plan,");
    expect(copy).not.toContain("internal/plan.md");
    // The badges, the table, the fence and the inline code are not touched.
    expect(copy).toContain(
      "[![CI](https://img.shields.io/ci.svg)](https://ci.example.com) [![npm](https://img.shields.io/npm.svg)](https://npm.example.com)",
    );
    expect(copy).toContain("| `base` | `/` |");
    expect(copy).toContain(
      "```sh\n# install the tool, then read [the guide](deploy.md)\nnpm ci\n```",
    );
    expect(copy).toContain("A `[note](deploy.md)` in code stays as written.");
    expect(copy.endsWith("\n")).toBe(true);
  });
});
