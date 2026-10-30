import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addComponent, listComponents } from "../../application";
import { buildDocuments } from "../../../template/src/application";
import { collectTags, filterText, matchesFilter, tagKey } from "../../../template/src/domain";
import { loadSiteConfig, readSources } from "../../../template/src/infrastructure";
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
  repo = mkdtempSync(join(tmpdir(), "sitekit-filter-"));
  site = join(repo, "site");
  mkdirSync(site);
  write("src/index.ts", "export {}");
  writeFileSync(
    join(site, "sitekit.config.json"),
    JSON.stringify({
      site: { name: "Demo", description: "d", url: "https://me.github.io" },
      hero: { title: "Demo", lede: "l", primary: { label: "Go", href: "/docs/" } },
      collections: [{ id: "docs", label: "Docs", dir: "../docs" }],
    }),
  );
  write("docs/button.md", "---\ntags: [UI, Forms]\n---\n\n# Button\n\nA clickable control.\n");
  write("docs/table.md", "---\ntags: ui, Data\n---\n\n# Table\n\nRows and columns.\n");
  write("docs/guide.md", "# Guide\n\nNo tags here.\n");
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("the catalog filter, with real files", () => {
  it("reads the tags of each page from its frontmatter and builds the buttons from them", () => {
    const config = loadSiteConfig(site);
    const documents = buildDocuments(readSources(site, config).files, {
      base: "/",
      collections: config.collections,
    });
    const bySlug = Object.fromEntries(documents.map((doc) => [doc.slug, doc]));
    expect(bySlug.button!.tags).toEqual(["UI", "Forms"]);
    expect(bySlug.table!.tags).toEqual(["ui", "Data"]);
    expect(bySlug.guide!.tags).toEqual([]);
    expect(collectTags(documents).map((tag) => [tag.label, tag.count])).toEqual([
      ["Data", 1],
      ["Forms", 1],
      ["UI", 2],
    ]);
  });

  it("narrows those pages by tag and by text, as the browser does with the same functions", () => {
    const config = loadSiteConfig(site);
    const documents = buildDocuments(readSources(site, config).files, { base: "/" });
    const items = documents.map((doc) => ({
      slug: doc.slug,
      tags: doc.tags.map(tagKey),
      text: filterText(doc),
    }));
    const shown = (tags: string[], query = "") =>
      items.filter((item) => matchesFilter(item, { tags, query })).map((item) => item.slug);
    expect(shown(["ui"]).sort()).toEqual(["button", "table"]);
    expect(shown(["ui", "data"])).toEqual(["table"]);
    expect(shown([], "rows")).toEqual(["table"]);
    expect(shown([], "no tags")).toEqual(["guide"]);
  });

  it("is in the registry that `list` prints, and every file it lists is in the template", () => {
    const registry = packagedTemplate(TEMPLATE).registry();
    expect(listComponents(registry).map((component) => component.name)).toContain("catalog-filter");
    for (const file of registry.components["catalog-filter"]!.files) {
      expect(() => readFileSync(join(TEMPLATE, file), "utf8")).not.toThrow();
    }
  });

  it("is restored by `add` as the files the template ships, with nothing else to install", () => {
    writeFileSync(join(site, "package.json"), JSON.stringify({ dependencies: {} }));
    const deps = { fs: nodeFileSystem, template: packagedTemplate(TEMPLATE), hash: sha256 };
    const result = addComponent(deps, { siteAbs: site, name: "catalog-filter" });
    expect(result.written).toContain("src/presentation/components/site/CatalogFilter.astro");
    expect(result.written).toContain("src/presentation/filter/catalogFilter.ts");
    expect(result.written).toContain("src/domain/filter/catalogFilter.ts");
    expect(result.missingPackages).toEqual([]);
    for (const file of result.written) {
      expect(readFileSync(join(site, file), "utf8")).toBe(
        readFileSync(join(TEMPLATE, file), "utf8"),
      );
    }
  });
});
