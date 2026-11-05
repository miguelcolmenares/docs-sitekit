import { buildDocuments, buildSearchIndex } from "../../../template/src/application";
import type { CollectionConfig, SourceFile } from "../../../template/src/domain";

const file = (
  path: string,
  content: string,
  collection = "docs",
  collectionPath = path.replace(/^docs\//, ""),
): SourceFile => ({ path, collection, collectionPath, frontmatter: {}, content });

const collections: CollectionConfig[] = [
  { id: "docs", label: "Guides", dir: "../docs", groups: [] },
  { id: "examples", label: "Examples", dir: "../examples", groups: [] },
];

describe("buildSearchIndex", () => {
  it("makes one entry per page, with its title, collection, headings and text", () => {
    const documents = buildDocuments(
      [file("docs/install.md", "# Install\n\nRun `npm ci`.\n\n## Options\n\nSet `enabled`.\n")],
      { base: "/", collections },
    );
    const index = buildSearchIndex(documents, { collections });
    expect(index.pages).toEqual([
      {
        url: "/docs/install/",
        title: "Install",
        description: "Run npm ci.",
        collection: "docs",
        headings: [expect.objectContaining({ text: "Options", id: "options" })],
        text: "Run npm ci.\nOptions\nSet enabled.",
      },
    ]);
  });

  it("puts the base path in front of every address, for a project page", () => {
    const documents = buildDocuments([file("docs/a.md", "# A")], {
      base: "/docs-sitekit/",
      collections,
    });
    const [page] = buildSearchIndex(documents, { collections }).pages;
    expect(page!.url).toBe("/docs-sitekit/docs/a/");
  });

  it("keeps the root path for a site served from the top of its domain", () => {
    const documents = buildDocuments([file("docs/a.md", "# A")], { base: "/", collections });
    expect(buildSearchIndex(documents, { collections }).pages[0]!.url).toBe("/docs/a/");
  });

  it("labels collections as the menu does, and labels the changelog", () => {
    const documents = buildDocuments(
      [
        file("docs/a.md", "# A"),
        file("examples/basic/README.md", "# Basic", "examples", "basic/README.md"),
        file("CHANGELOG.md", "# Changelog\n\n## 1.0.0", "changelog", "CHANGELOG.md"),
      ],
      { base: "/", collections },
    );
    const index = buildSearchIndex(documents, { collections });
    expect(index.collections).toEqual({
      docs: "Guides",
      examples: "Examples",
      changelog: "Changelog",
    });
    expect(index.pages.map((page) => [page.collection, page.url])).toEqual([
      ["docs", "/docs/a/"],
      ["examples", "/examples/basic/"],
      ["changelog", "/changelog/"],
    ]);
  });

  it("keeps the page order of the site", () => {
    const documents = buildDocuments([file("docs/b.md", "# B"), file("docs/a.md", "# A")], {
      base: "/",
      collections,
    });
    expect(buildSearchIndex(documents, { collections }).pages.map((page) => page.title)).toEqual([
      "A",
      "B",
    ]);
  });

  it("indexes a page with no body, so every page has an entry", () => {
    const documents = buildDocuments([file("docs/empty.md", "# Empty")], {
      base: "/",
      collections,
    });
    expect(buildSearchIndex(documents, { collections }).pages[0]).toMatchObject({
      text: "",
      headings: [],
    });
  });
});
