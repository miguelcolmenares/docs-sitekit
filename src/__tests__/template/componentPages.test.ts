import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { KIT_ONLY_PATHS } from "../../infrastructure";
import { PAGES, PAGE_BY_NAME } from "../../../template/src/examples/catalog";

const ROOT = join(__dirname, "..", "..", "..");
const TEMPLATE = join(ROOT, "template");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

interface Entry {
  files: string[];
  requires: string[];
  example?: string;
}
const registry = JSON.parse(read("template/registry.json")) as {
  components: Record<string, Entry>;
};
const names = Object.keys(registry.components);
const withPointer = names.filter((name) => registry.components[name]!.example !== undefined);
const index = read("docs/components.md");

describe("the component pages and the registry", () => {
  it("has a page for exactly the entries that point at examples", () => {
    expect(PAGES.map((page) => page.name).sort()).toEqual([...withPointer].sort());
  });

  it("gives every entry of the registry a page or a place in the list of entries without one, and never both", () => {
    const listed = [...index.matchAll(/^### (.+)$/gm)].map((match) => match[1]!);
    const withoutPage = names.filter((name) => !PAGE_BY_NAME.has(name));
    expect(listed.sort()).toEqual([...withoutPage].sort());
  });

  it("points each entry at the folder of its own name", () => {
    for (const name of withPointer) {
      expect(registry.components[name]!.example).toBe(`src/examples/${name}`);
    }
  });

  it("links every page from the index, and nothing else as a component page", () => {
    for (const page of PAGES) expect(index).toContain(`](./components/${page.name}.md)`);
    const linked = [...index.matchAll(/\]\(\.\/components\/([a-z-]+)\.md\)/g)].map((m) => m[1]);
    expect(new Set(linked)).toEqual(new Set(PAGES.map((page) => page.name)));
  });

  it("builds the tables of a page from files that belong to its registry entry", () => {
    for (const page of PAGES) {
      expect(page.tables.length).toBeGreaterThan(0);
      for (const table of page.tables) {
        expect(registry.components[page.name]!.files).toContain(table.file);
      }
    }
  });
});

describe.each(PAGES.map((page) => [page.name, page] as const))("the page of %s", (name, page) => {
  const folder = join(TEMPLATE, "src", "examples", name);
  const files = existsSync(folder) ? readdirSync(folder).sort() : [];

  it("has an example, and a file for each variant and for nothing else", () => {
    const expected = ["example", ...page.variants.map((variant) => variant.id)].map(
      (id) => `${id}.astro`,
    );
    expect(files).toEqual([...expected].sort());
  });

  it("shows the component it is about: an example imports one of the files of the entry", () => {
    const entryFiles = registry.components[name]!.files;
    const source = readFileSync(join(folder, "example.astro"), "utf8");
    const imported = [...source.matchAll(/from "@\/([^"]+)"/g)].map((match) => `src/${match[1]}`);
    const matches = imported.some((path) =>
      entryFiles.some((file) => file === path || file.replace(/\.[a-z]+$/, "") === path),
    );
    expect(matches).toBe(true);
  });

  it("has examples that are plain text the copy button can copy: no marker comment, no tabs", () => {
    for (const file of files) {
      const source = readFileSync(join(folder, file), "utf8");
      expect(source).not.toContain("[!code");
      expect(source).not.toContain("\t");
      expect(source.startsWith("---\n")).toBe(true);
    }
  });

  it("has a document with the title of the page, a description, and its notes", () => {
    const document = read(`docs/components/${name}.md`);
    expect(document).toMatch(
      new RegExp(`^---\\ntitle: ${page.title}\\ndescription: ".+"\\n---\\n`),
    );
    expect(document).toContain("\n## Accessibility\n");
    expect(document).toContain("\n## Source\n");
    expect(document).not.toContain("—");
  });

  it("is in a group of the components collection", () => {
    const config = JSON.parse(read("template/sitekit.config.json")) as {
      collections: { id: string; groups: { items: string[] }[] }[];
    };
    const collection = config.collections.find((candidate) => candidate.id === "components")!;
    const grouped = collection.groups.flatMap((group) => group.items);
    expect(grouped.filter((item) => item === name)).toHaveLength(1);
  });
});

describe("the components collection", () => {
  it("has a document for every page and for nothing else", () => {
    const documents = readdirSync(join(ROOT, "docs", "components"))
      .map((file) => file.replace(/\.md$/, ""))
      .sort();
    expect(documents).toEqual(PAGES.map((page) => page.name).sort());
  });

  it("is a collection of the project site only: its layout, its examples and its pages stay out of the package", () => {
    const { files } = JSON.parse(read("package.json")) as { files: string[] };
    for (const path of KIT_ONLY_PATHS) expect(files).toContain(`!template/${path}`);
    for (const path of KIT_ONLY_PATHS) expect(existsSync(join(TEMPLATE, path))).toBe(true);
  });

  it("lets a collection have its own layout by the name of its id, and a site without one uses DocPage", () => {
    const route = read("template/src/pages/[collection]/[...slug].astro");
    expect(route).toContain("layouts/collections/*.astro");
    expect(route).toContain("|| DocPage");
    expect(
      existsSync(
        join(TEMPLATE, "src", "presentation", "layouts", "collections", "components.astro"),
      ),
    ).toBe(true);
  });
});

describe("the layout of a component page", () => {
  const layout = read("template/src/presentation/layouts/collections/components.astro");

  it("draws the preview and the code of one file: the page imports the example as a component and as text", () => {
    const loader = read("template/src/examples/host/examples.ts");
    expect(loader).toMatch(/import\.meta\.glob[\s\S]*eager: true/);
    expect(loader).toContain('query: "?raw"');
    expect(layout).toContain("exampleFor(");
  });

  it("makes no request to another host", () => {
    for (const path of [
      "template/src/presentation/layouts/collections/components.astro",
      "template/src/examples/host/ExampleBlock.astro",
      "template/src/examples/host/exampleTabs.ts",
    ]) {
      expect(read(path)).not.toMatch(/https?:\/\//);
      expect(read(path)).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon/);
    }
  });
});
