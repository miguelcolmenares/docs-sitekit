import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../presentation";
import { loadSiteConfig } from "../../../template/src/infrastructure";
import { callModule } from "../support/esm";

const ROOT = join(__dirname, "..", "..", "..");
const TEMPLATE_ROOT = join(ROOT, "template");
const RECIPES = join(ROOT, "scripts", "recipes.mjs");
const RECIPE_DOCS = join(ROOT, "scripts", "build-recipe-docs.mjs");

jest.setTimeout(60_000);

/** Git without the variables a hook sets, which would aim these commands at the real repository. */
const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    {
      cwd,
      stdio: "pipe",
      encoding: "utf8",
      env: Object.fromEntries(
        Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
      ),
    },
  );

const apply = (name: string, repository: string) =>
  callModule<string[]>(RECIPES, "applyRecipe", name, repository);

let repo: string;
let site: string;

/** Run the CLI in the repository, in this process, and keep what it printed. */
function sitekit(...argv: string[]) {
  let out = "";
  let err = "";
  const code = runCli([...argv, "--root", repo], {
    out: (text) => (out += text),
    err: (text) => (err += text),
    cwd: repo,
    templateRoot: TEMPLATE_ROOT,
  });
  return { code, out, err };
}

const write = (path: string, text: string) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
};
const manifests = () =>
  readFileSync(join(site, "package.json"), "utf8") +
  readFileSync(join(site, "package-lock.json"), "utf8");
const commit = (message: string) => {
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", message);
};

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "sitekit-recipes-"));
  site = join(repo, "site");
  git(repo, "init", "-q", "-b", "main");
  git(repo, "remote", "add", "origin", "https://github.com/demo/recipes.git");
  write(
    join(repo, "package.json"),
    JSON.stringify({
      name: "recipes",
      version: "1.0.0",
      description: "A project.",
      license: "MIT",
    }),
  );
  write(join(repo, "README.md"), "# Recipes\n\nA project.\n");
  write(join(repo, "docs", "getting-started.md"), "# Getting started\n\nInstall it.\n");
  write(join(repo, "examples", "basic", "README.md"), "# Basic example\n\nThe smallest.\n");
  expect(sitekit("init").code).toBe(0);
  const configPath = join(site, "sitekit.config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.deploy.repositoryVisibility = "public";
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  commit("A site made by init");
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("every recipe applied to a site made by init", () => {
  it("leaves a config that the closed schema accepts, with the keys the recipes add", () => {
    const before = manifests();
    for (const name of callModule<string[]>(RECIPES, "recipeNames")) apply(name, repo);
    const config = loadSiteConfig(site);
    expect(config.collections.map((collection) => collection.id)).toEqual([
      "docs",
      "examples",
      "notes",
    ]);
    expect(config.stats).toHaveLength(3);
    expect(config.features.at(-1)?.icon).toBe("brand:custom/compass");
    expect(config.anonymize.denyPatterns).toEqual(["ACME-\\d{4}"]);
    // No recipe adds a package.
    expect(manifests()).toBe(before);
  });

  it("passes sitekit check", () => {
    for (const name of callModule<string[]>(RECIPES, "recipeNames")) apply(name, repo);
    const result = sitekit("check");
    expect(result.err).toBe("");
    expect(result.out).toMatch(/Safe to publish/);
  });

  it("writes every file of a recipe, and returns the paths it wrote", () => {
    const written = apply("tool-page", repo);
    expect(written).toEqual([
      "site/src/pages/configurator.astro",
      "site/src/presentation/tools/heroSnippet.ts",
    ]);
    for (const path of written) expect(existsSync(join(repo, path))).toBe(true);
  });

  it("says which recipe and which file when a change does not apply", () => {
    rmSync(join(site, "src", "presentation", "components", "site", "StatRow.tsx"));
    expect(() => apply("component", repo)).toThrow(
      /Recipe "component": site\/src\/presentation\/components\/site\/StatRow\.tsx\.diff does not apply/,
    );
  });
});

describe("recipe collection", () => {
  it("stops sitekit check on a page that no group lists, and says how to fix it", () => {
    apply("collection", repo);
    expect(sitekit("check").code).toBe(0);
    write(join(repo, "notes", "draft.md"), "# Draft\n\nNot in a group yet.\n");
    const result = sitekit("check");
    expect(result.code).not.toBe(0);
    expect(result.err).toMatch(
      /draft is in no group of "Notes"\. Add it to a group, or remove the groups to sort by name\./,
    );
  });

  it("builds the documents in the order of the groups and of their items", () => {
    apply("collection", repo);
    const { collections } = loadSiteConfig(site);
    const notes = collections.find((collection) => collection.id === "notes")!;
    expect(notes.groups.map((group) => [group.name, group.items])).toEqual([
      ["Start", ["welcome", "glossary"]],
      ["Process", ["release-process"]],
    ]);
  });
});

describe("recipe component", () => {
  const STAT_ROW = "src/presentation/components/site/StatRow.tsx";

  it("add restores the file, keeps it once it was changed, and upgrade keeps it too", () => {
    rmSync(join(site, STAT_ROW));
    expect(sitekit("add", "stat-row", "--dir", "site").out).toContain(STAT_ROW);
    expect(readFileSync(join(site, STAT_ROW), "utf8")).toContain("text-fg-bright");

    apply("component", repo);
    const changed = readFileSync(join(site, STAT_ROW), "utf8");
    expect(changed).toContain("wrap-anywhere text-brand");
    expect(changed).not.toContain("wrap-anywhere text-fg-bright");

    const again = sitekit("add", "stat-row", "--dir", "site");
    expect(again.out).toContain("you changed it, kept; use --force to replace");
    expect(readFileSync(join(site, STAT_ROW), "utf8")).toBe(changed);

    commit("Change StatRow");
    const upgrade = sitekit("upgrade", "--dir", "site");
    expect(upgrade.out).toContain(`= site/${STAT_ROW} (you changed it, the kit did not, kept)`);
    expect(upgrade.out).toMatch(/0 replaced, 0 added, 1 kept, 0 to merge/);
    expect(readFileSync(join(site, STAT_ROW), "utf8")).toBe(changed);
    expect(git(repo, "status", "--porcelain").trim()).toBe("");
  });

  it("add --force writes the kit's version over the change", () => {
    apply("component", repo);
    sitekit("add", "stat-row", "--dir", "site", "--force");
    expect(readFileSync(join(site, STAT_ROW), "utf8")).toContain("wrap-anywhere text-fg-bright");
  });
});

describe("recipe safe-build", () => {
  it("makes check fail on a leak of the pattern, masked, and pass again once the text is allowed", () => {
    apply("safe-build", repo);
    expect(sitekit("check").code).toBe(0);
    write(join(repo, "docs", "ticket.md"), "# Ticket\n\nThe fix is tracked in ACME-1042.\n");
    const failed = sitekit("check");
    expect(failed.code).not.toBe(0);
    expect(failed.err).toContain('docs/ticket.md: deny-pattern-1 (high) "ACM…"');
    expect(failed.err).not.toContain("ACME-1042");

    const configPath = join(site, "sitekit.config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    config.anonymize.allow = ["ACME-1042"];
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    expect(sitekit("check").code).toBe(0);
  });
});

describe("recipe tokens", () => {
  const run = (script: string, args: string[] = []) =>
    spawnSync("node", [script, ...args], { cwd: site, encoding: "utf8" });

  it("the site has the script, which follows tokens.json and fails --check while the CSS is behind", () => {
    expect(readFileSync(join(site, "package.json"), "utf8")).toContain(
      '"build:tokens": "node scripts/build-tokens.mjs"',
    );
    expect(run("scripts/build-tokens.mjs", ["--check"]).status).toBe(0);
    apply("tokens", repo);
    const stale = run("scripts/build-tokens.mjs", ["--check"]);
    expect(stale.status).toBe(1);
    expect(stale.stderr).toMatch(/src\/styles\/tokens\.css is out of date/);
    expect(run("scripts/build-tokens.mjs").status).toBe(0);
    const css = readFileSync(join(site, "src", "styles", "tokens.css"), "utf8");
    expect(css).toContain("--sk-accent: #2dd4bf;");
    expect(css).toContain("--sk-accent-strong: #0f766e;");
    expect(css).toContain("--sk-accent: #0b5f59;");
    expect(run("scripts/build-tokens.mjs", ["--check"]).status).toBe(0);
  });

  it("writes the same CSS as the script of the kit for the tokens of the kit", () => {
    const before = readFileSync(join(site, "src", "styles", "tokens.css"), "utf8");
    expect(before).toBe(readFileSync(join(TEMPLATE_ROOT, "src", "styles", "tokens.css"), "utf8"));
    rmSync(join(site, "src", "styles", "tokens.css"));
    expect(run("scripts/build-tokens.mjs").status).toBe(0);
    expect(readFileSync(join(site, "src", "styles", "tokens.css"), "utf8")).toBe(before);
  });

  it("refuses a light set that does not have the keys of the dark one", () => {
    const file = join(site, "design", "tokens.json");
    const tokens = JSON.parse(readFileSync(file, "utf8"));
    delete tokens.themes.light.color["accent-strong"];
    writeFileSync(file, JSON.stringify(tokens));
    const result = run("scripts/build-tokens.mjs");
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Only in dark: accent-strong/);
  });

  it("the contrast script passes for the new accent and for the default one", () => {
    expect(run("scripts/build-tokens.mjs").status).toBe(0);
    apply("tokens", repo);
    const result = run("scripts/check-contrast.mjs");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^102 pairs reach the contrast they need\./);
  });

  it.each([
    [
      "accent-strong",
      "#6d28d9",
      /dark: accent-strong #6d28d9 on surface-3 #1c1c21 is 2\.39:1, the focus ring needs 3:1/,
    ],
    ["accent", "#3b3b46", /dark: accent #3b3b46 on bg #09090b is \d\.\d\d:1, text needs 4\.5:1/],
    [
      "accent-contrast",
      "#a1a1aa",
      /dark: accent-contrast #a1a1aa on accent-strong #0f766e is [\d.]+:1, text on a fill needs 4\.5:1/,
    ],
  ])("the contrast script names the pair of a bad %s", (token, color, message) => {
    apply("tokens", repo);
    const file = join(site, "design", "tokens.json");
    const tokens = JSON.parse(readFileSync(file, "utf8"));
    tokens.color[token] = color;
    writeFileSync(file, JSON.stringify(tokens));
    const result = run("scripts/check-contrast.mjs");
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(message);
    expect(result.stderr).toMatch(/\d+ of 102 pairs are too low\./);
  });

  it("the contrast script finds a pair that is low only in the light set", () => {
    apply("tokens", repo);
    const file = join(site, "design", "tokens.json");
    const tokens = JSON.parse(readFileSync(file, "utf8"));
    tokens.themes.light.color.accent = "#7dd3c8";
    writeFileSync(file, JSON.stringify(tokens));
    const result = run("scripts/check-contrast.mjs");
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/light: accent #7dd3c8 on bg #ffffff/);
    expect(result.stderr).not.toMatch(/dark:/);
  });
});

describe("the pages of the guides", () => {
  const DOCS = join(ROOT, "docs");
  const build = (docs: string, ...args: string[]) =>
    spawnSync("node", [RECIPE_DOCS, "--docs", docs, ...args], { encoding: "utf8" });
  let copy: string;
  beforeEach(() => {
    copy = join(repo, "docs-copy");
    cpSync(DOCS, copy, { recursive: true });
  });

  it("are up to date: they show the files of the folders of the recipes", () => {
    const result = build(DOCS, "--check");
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("fail the check when a file shown differs from its fixture, name the page, and are repaired by a run", () => {
    const page = join(copy, "extend-tool-page.md");
    writeFileSync(
      page,
      readFileSync(page, "utf8").replace("Read the changelog", "Read the history"),
    );
    const stale = build(copy, "--check");
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain("docs/extend-tool-page.md is out of date");
    expect(readFileSync(page, "utf8")).toContain("Read the history");

    expect(build(copy).status).toBe(0);
    expect(readFileSync(page, "utf8")).toContain("Read the changelog");
    expect(build(copy, "--check").status).toBe(0);
  });

  it("fill a marker that has no block yet, and fail on a file the recipe does not have", () => {
    write(
      join(copy, "new.md"),
      "# New\n\n<!-- recipe-file: collection notes/welcome.md -->\n<!-- /recipe-file -->\n",
    );
    expect(build(copy).status).toBe(0);
    const text = readFileSync(join(copy, "new.md"), "utf8");
    expect(text).toContain('```md title="notes/welcome.md"');
    expect(text).toContain("Short notes the team keeps next to the code.");

    write(
      join(copy, "bad.md"),
      "<!-- recipe-file: collection notes/nope.md -->\n<!-- /recipe-file -->\n",
    );
    const failed = build(copy);
    expect(failed.status).toBe(1);
    expect(failed.stderr).toMatch(/Recipe "collection" has no file notes\/nope\.md\. It has: /);
  });

  it("show a diff with the name of the file it changes, not of the diff", () => {
    const page = readFileSync(join(DOCS, "extend-tokens.md"), "utf8");
    expect(page).toContain('```diff title="site/design/tokens.json"');
    expect(page).not.toContain('title="site/design/tokens.json.diff"');
  });
});
