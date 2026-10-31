import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseSiteConfig } from "../../template/src/domain";
import {
  DEFAULT_CHOICES,
  heroProblems,
  heroSnippet,
} from "../../e2e/recipes/tool-page/site/src/presentation/tools/heroSnippet";
import { callModule } from "./support/esm";

const ROOT = join(__dirname, "..", "..");
const RECIPES = join(ROOT, "scripts", "recipes.mjs");
const RECIPE_DOCS = join(ROOT, "scripts", "build-recipe-docs.mjs");
const CONFIG_PATH = "site/sitekit.config.json";
interface RecipeFile {
  path: string;
  kind: "file" | "config" | "diff";
}
const mergeConfig = (base: unknown, patch: unknown) =>
  callModule<unknown>(RECIPES, "mergeConfig", base, patch);
const kindOf = (path: string) => callModule<string>(RECIPES, "kindOf", path);
const recipeNames = () => callModule<string[]>(RECIPES, "recipeNames");
const recipeFiles = (name: string) => callModule<RecipeFile[]>(RECIPES, "recipeFiles", name);
const markersOf = (markdown: string) =>
  callModule<Array<{ recipe: string; path: string }>>(RECIPE_DOCS, "markersOf", markdown);
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const DOCS = readdirSync(join(ROOT, "docs"));
const GUIDES = DOCS.filter((file) => /^extend-.+\.md$/.test(file)).sort();
const SPEC = read("e2e/specs/recipes.spec.ts");

describe("mergeConfig", () => {
  it("merges objects key by key, adds the items of a list after the ones there, and replaces the rest", () => {
    const base = { a: { x: 1, list: [1] }, keep: true, text: "old" };
    const patch = { a: { y: 2, list: [2, 3] }, text: "new", added: [{ id: 1 }] };
    expect(mergeConfig(base, patch)).toEqual({
      a: { x: 1, y: 2, list: [1, 2, 3] },
      keep: true,
      text: "new",
      added: [{ id: 1 }],
    });
  });
});

describe("the files of a recipe", () => {
  it("are told apart by their path: the config is merged, a .diff is applied, the rest is copied", () => {
    expect(kindOf(CONFIG_PATH)).toBe("config");
    expect(kindOf("site/design/tokens.json.diff")).toBe("diff");
    expect(kindOf("site/src/pages/tool.astro")).toBe("file");
    expect(kindOf("notes/sitekit.config.json")).toBe("file");
  });

  it("are listed for each recipe, and an unknown recipe says which ones there are", () => {
    expect(recipeFiles("tool-page").map((file) => file.path)).toEqual([
      "site/src/pages/configurator.astro",
      "site/src/presentation/tools/heroSnippet.ts",
    ]);
    expect(() => recipeFiles("nope")).toThrow(/no recipe "nope".*brand-and-layout, collection/);
  });

  it("only write under site/ or in a folder of content, never outside the repository", () => {
    for (const name of recipeNames())
      for (const { path } of recipeFiles(name)) {
        expect(path.startsWith("/") || path.includes("..")).toBe(false);
      }
  });
});

describe("heroSnippet, the function of the interactive page", () => {
  const SITE = { name: "Demo", description: "A demo", url: "https://me.github.io" };
  const hero = (choices = DEFAULT_CHOICES) => JSON.parse(heroSnippet(choices)).hero;

  it("writes the hero key with two spaces of indent", () => {
    expect(heroSnippet(DEFAULT_CHOICES)).toBe(`{
  "hero": {
    "title": "Documentation that looks like a product",
    "lede": "Guides, reference and examples in one place.",
    "primary": {
      "label": "Get started",
      "href": "/docs/getting-started/"
    }
  }
}`);
  });

  it("leaves out the badge when it is empty or only spaces, and trims it otherwise", () => {
    expect(hero({ ...DEFAULT_CHOICES, badge: "   " })).not.toHaveProperty("badge");
    expect(hero({ ...DEFAULT_CHOICES, badge: " Beta " }).badge).toBe("Beta");
  });

  it("adds the second button only when asked", () => {
    expect(hero()).not.toHaveProperty("secondary");
    expect(hero({ ...DEFAULT_CHOICES, secondary: true }).secondary).toEqual({
      label: "Read the changelog",
      href: "/changelog/",
    });
  });

  it("keeps the text typed, whatever it holds, as JSON", () => {
    const title = 'Say "hi" \\ <b>x</b>\nnext';
    expect(hero({ ...DEFAULT_CHOICES, title }).title).toBe(title);
  });

  it("writes a hero that the real config schema accepts, in each combination of the options", () => {
    for (const badge of ["", "Beta"])
      for (const secondary of [false, true]) {
        const choices = { ...DEFAULT_CHOICES, badge, secondary };
        const config = parseSiteConfig({ site: SITE, hero: hero(choices) });
        expect(config.hero.title).toBe(choices.title);
        expect(config.hero.secondary !== undefined).toBe(secondary);
      }
  });

  it("names each text the schema would refuse, and only those", () => {
    expect(heroProblems(DEFAULT_CHOICES)).toEqual([]);
    expect(heroProblems({ ...DEFAULT_CHOICES, title: "  ", action: "" })).toEqual([
      "The title is empty.",
      "The button text is empty.",
    ]);
    expect(() =>
      parseSiteConfig({ site: SITE, hero: hero({ ...DEFAULT_CHOICES, lede: "" }) }),
    ).toThrow();
    expect(heroProblems({ ...DEFAULT_CHOICES, lede: "" })).toEqual(["The lede is empty."]);
  });
});

describe("the guides of Extending your site", () => {
  const index = read("docs/extending.md");

  it("are one page for each recipe, named after it, and the index", () => {
    expect(GUIDES).toEqual(
      recipeNames()
        .map((name) => `extend-${name}.md`)
        .sort(),
    );
    expect(DOCS).toContain("extending.md");
  });

  it("are the group Extending your site of the project site, with the index first", () => {
    const config = JSON.parse(read("template/sitekit.config.json"));
    const docs = config.collections.find((collection: { id: string }) => collection.id === "docs");
    const group = docs.groups.find(
      (entry: { name: string }) => entry.name === "Extending your site",
    );
    expect(group.items).toEqual(
      ["extending", ...GUIDES.map((file) => file.replace(/\.md$/, ""))].sort(
        (a: string, b: string) => group.items.indexOf(a) - group.items.indexOf(b),
      ),
    );
    expect(group.items[0]).toBe("extending");
  });

  it("are linked from the index, and the index links nothing else as a guide", () => {
    const linked = [...index.matchAll(/\]\(\.\/(extend-[a-z-]+)\.md\)/g)].map((match) => match[1]);
    expect(linked.sort()).toEqual(GUIDES.map((file) => file.replace(/\.md$/, "")));
  });

  it("are linked from the getting started page and the README", () => {
    expect(read("docs/getting-started.md")).toContain("](./extending.md)");
    expect(read("README.md")).toContain("](docs/extending.md)");
  });

  it.each(GUIDES)("%s shows every file of its recipe, and nothing that is not one", (file) => {
    const name = file.replace(/^extend-/, "").replace(/\.md$/, "");
    const shown = markersOf(read(`docs/${file}`));
    expect(shown.every((marker) => marker.recipe === name)).toBe(true);
    expect(shown.map((marker) => marker.path).sort()).toEqual(
      recipeFiles(name)
        .map((entry) => entry.path)
        .sort(),
    );
  });

  it.each(GUIDES)("%s says what covers it, and the files and groups it names exist", (file) => {
    const name = file.replace(/^extend-/, "").replace(/\.md$/, "");
    const page = read(`docs/${file}`);
    expect(page).toMatch(/## How it is tested/);
    const covered = page.split("## How it is tested")[1]!;
    for (const [, path] of covered.matchAll(/`((?:e2e|scripts|src)\/[\w./-]+)`/g)) {
      expect(existsSync(join(ROOT, path!))).toBe(true);
    }
    for (const [, group] of covered.matchAll(/group `(recipe [\w-]+)`/g)) {
      expect(SPEC).toContain(`test.describe("${group}:`);
    }
    // The tests are in the spec, in the script, or both, and the page says which.
    expect(covered).toMatch(/recipes\.spec\.ts|verify-package\.mjs|recipes\.test\.ts/);
    // A recipe with a browser group in the spec has the page say so.
    if (SPEC.includes(`test.describe("recipe ${name}:`)) {
      expect(covered).toContain(`group \`recipe ${name}\``);
    }
  });

  it("have a group in the spec for each recipe that the page says has one, and none without a page", () => {
    const groups = [...SPEC.matchAll(/test\.describe\("recipe ([\w-]+):/g)].map(
      (match) => match[1],
    );
    for (const name of groups) expect(recipeNames()).toContain(name);
  });
});
