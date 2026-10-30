import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDocuments, buildSearchIndex } from "../../../template/src/application";
import { loadSiteConfig, readSources } from "../../../template/src/infrastructure";

let repo: string;
let site: string;

const write = (path: string, content: string) => {
  const full = join(repo, path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
};

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "sitekit-search-"));
  site = join(repo, "site");
  mkdirSync(site);
  write(
    "site/sitekit.config.json",
    JSON.stringify({
      site: { name: "Demo", description: "d", url: "https://me.github.io", base: "/demo/" },
      hero: { title: "Demo", lede: "l", primary: { label: "Go", href: "/docs/" } },
      collections: [{ id: "docs", label: "Docs", dir: "../docs" }],
    }),
  );
  write(
    "docs/start.md",
    "---\ntitle: Start here\n---\n\n# Start here\n\nIntro.\n\n## Install\n\n```sh\nnpm ci\n```\n\n## Install\n\nAgain.\n",
  );
  write("docs/guide/README.md", "# Guide\n\nA `token` note.\n");
  write("CHANGELOG.md", "# Changelog\n\n## 1.0.0\n\nFirst release.\n");
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("buildSearchIndex on real files", () => {
  it("indexes every published page under the base path, with the anchors the pages render", () => {
    const config = loadSiteConfig(site);
    const { files } = readSources(site, config);
    const documents = buildDocuments(files, {
      base: config.site.base,
      collections: config.collections,
    });
    const index = buildSearchIndex(documents, { collections: config.collections });

    expect(index.pages.map((page) => page.url)).toEqual([
      "/demo/docs/guide/",
      "/demo/docs/start/",
      "/demo/changelog/",
    ]);
    const start = index.pages.find((page) => page.url === "/demo/docs/start/")!;
    expect(start.title).toBe("Start here");
    expect(start.headings.map((heading) => [heading.text, heading.id])).toEqual([
      ["Install", "install"],
      ["Install", "install-1"],
    ]);
    expect(start.text).toContain("npm ci");
    expect(start.text).not.toContain("```");
    expect(index.collections).toEqual({ docs: "Docs", changelog: "Changelog" });
  });

  it("maps a match to the heading it is under, by its offset", () => {
    const config = loadSiteConfig(site);
    const { files } = readSources(site, config);
    const documents = buildDocuments(files, {
      base: config.site.base,
      collections: config.collections,
    });
    const start = buildSearchIndex(documents, { collections: config.collections }).pages.find(
      (page) => page.url === "/demo/docs/start/",
    )!;
    const second = start.headings[1]!;
    expect(start.text.slice(second.offset).startsWith("Install\nAgain.")).toBe(true);
  });
});
