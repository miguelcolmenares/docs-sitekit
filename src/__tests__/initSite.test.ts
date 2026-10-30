import { initSite, LOCK_FILE } from "../application";
import type { SiteLock } from "../application";
import { fakeEnv, fakeTemplate, MemoryFileSystem, sha } from "./support/memory";

const ROOT = "/work/widget";

function setup(
  initial: Record<string, string> = {},
  remoteUrl: string | undefined = "https://github.com/me/widget.git",
) {
  const fs = new MemoryFileSystem({
    [`${ROOT}/package.json`]: JSON.stringify({
      name: "@me/widget",
      description: "A widget.",
      license: "MIT",
    }),
    [`${ROOT}/src/index.ts`]: "export {}",
    [`${ROOT}/docs/start.md`]: "# Start",
    ...initial,
  });
  const deps = { fs, env: fakeEnv({ remoteUrl }), template: fakeTemplate(), hash: sha };
  return {
    fs,
    deps,
    run: (options: Partial<Parameters<typeof initSite>[1]> = {}) =>
      initSite(deps, { root: ROOT, siteDir: "site", ...options }),
  };
}

describe("initSite", () => {
  it("writes the template, the config, the lock, a gitignore and the workflow", () => {
    const { fs, run } = setup();
    const result = run();
    expect(fs.exists(`${ROOT}/site/src/cn.ts`)).toBe(true);
    expect(fs.exists(`${ROOT}/site/sitekit.config.json`)).toBe(true);
    expect(fs.readText(`${ROOT}/site/.gitignore`)).toContain("node_modules/");
    expect(result.written).toEqual(
      expect.arrayContaining(["site/sitekit.config.json", ".github/workflows/docs.yml"]),
    );
  });

  it("writes the search key, on, so a new site has search and says so in its config", () => {
    const { fs, run } = setup();
    run();
    expect(JSON.parse(fs.readText(`${ROOT}/site/sitekit.config.json`)).search).toEqual({
      enabled: true,
    });
  });

  it("derives the config from the repository", () => {
    const { fs, run } = setup();
    const { config } = run();
    expect(config.site).toMatchObject({
      name: "widget",
      base: "/widget/",
      url: "https://me.github.io",
      installCommand: "npm install @me/widget",
    });
    expect(JSON.parse(fs.readText(`${ROOT}/site/sitekit.config.json`)).site.name).toBe("widget");
  });

  it("writes the llms key on for a new site, with no optional collections and no Markdown pages", () => {
    const { fs, run } = setup();
    run();
    expect(JSON.parse(fs.readText(`${ROOT}/site/sitekit.config.json`)).llms).toEqual({
      enabled: true,
      optional: [],
      markdownPages: false,
    });
  });

  it("writes only inside the site folder, even when the repository has a src/ of its own", () => {
    const { fs, run } = setup();
    run();
    expect(fs.readText(`${ROOT}/src/index.ts`)).toBe("export {}"); // untouched
    expect(fs.exists(`${ROOT}/src/cn.ts`)).toBe(false);
    expect(fs.exists(`${ROOT}/site/src/cn.ts`)).toBe(true);
  });

  it("renames the site package and its lockfile", () => {
    const { fs, run } = setup();
    run();
    expect(JSON.parse(fs.readText(`${ROOT}/site/package.json`)).name).toBe("widget-docs");
    const lock = JSON.parse(fs.readText(`${ROOT}/site/package-lock.json`));
    expect(lock.name).toBe("widget-docs");
    expect(lock.packages[""].name).toBe("widget-docs");
  });

  it("pins this package version in the workflow", () => {
    const { fs, run } = setup();
    run();
    expect(fs.readText(`${ROOT}/.github/workflows/docs.yml`)).toBe(
      "run: npx sitekit@0.1.0 check\n",
    );
  });

  it("records a hash of each template file in the lock", () => {
    const { fs, run } = setup();
    run();
    const lock = JSON.parse(fs.readText(`${ROOT}/site/${LOCK_FILE}`)) as SiteLock;
    expect(lock.sitekit).toBe("0.1.0");
    expect(lock.files["src/cn.ts"]).toBe(sha(fs.readText(`${ROOT}/site/src/cn.ts`)));
  });

  it("refuses a folder that already has files, and says how to continue", () => {
    const { run } = setup({ [`${ROOT}/site/notes.md`]: "mine" });
    expect(() => run()).toThrow(/already has files.*--dir.*--force/);
  });

  it("overwrites an existing folder with force", () => {
    const { fs, run } = setup({ [`${ROOT}/site/src/cn.ts`]: "old" });
    run({ force: true });
    expect(fs.readText(`${ROOT}/site/src/cn.ts`)).not.toBe("old");
  });

  it("does not touch an existing workflow without force", () => {
    const { fs, run } = setup({ [`${ROOT}/.github/workflows/docs.yml`]: "mine" });
    const result = run();
    expect(fs.readText(`${ROOT}/.github/workflows/docs.yml`)).toBe("mine");
    expect(result.skipped).toContain(".github/workflows/docs.yml");
  });

  it("writes nothing in a dry run, and reports what it would write", () => {
    const { fs, run } = setup();
    const before = fs.files.size;
    const result = run({ dryRun: true });
    expect(fs.files.size).toBe(before);
    expect(result.written.length).toBeGreaterThan(5);
  });

  it("finds docs, tutorials and examples, including the ones inside docs/", () => {
    const { run } = setup({
      [`${ROOT}/docs/tutorials/first.md`]: "# First",
      [`${ROOT}/docs/examples/one.md`]: "# One",
    });
    const { config } = run();
    expect(config.collections.map((c) => [c.id, c.dir])).toEqual([
      ["docs", "../docs"],
      ["tutorials", "../docs/tutorials"],
      ["examples", "../docs/examples"],
    ]);
  });

  it("prefers docs/examples over examples when both exist, so the ids stay unique", () => {
    const { run } = setup({
      [`${ROOT}/docs/examples/one.md`]: "# One",
      [`${ROOT}/examples/two.md`]: "# Two",
    });
    expect(
      run()
        .config.collections.filter((c) => c.id === "examples")
        .map((c) => c.dir),
    ).toEqual(["../docs/examples"]);
  });

  it("makes no collections for a repository without documentation folders", () => {
    const fs = new MemoryFileSystem({
      [`${ROOT}/package.json`]: JSON.stringify({ name: "x" }),
      [`${ROOT}/src/a.ts`]: "export {}",
    });
    const result = initSite(
      { fs, env: fakeEnv(), template: fakeTemplate(), hash: sha },
      { root: ROOT, siteDir: "site" },
    );
    expect(result.config.collections).toEqual([]);
  });

  it("keeps what it derived when the command line passes undefined, as the CLI does", () => {
    const { run } = setup();
    const { config } = run({ overrides: { name: undefined, description: undefined } });
    expect(config.site).toMatchObject({ name: "widget", description: "A widget." });
  });

  it("applies a name and a description given on the command line", () => {
    const { run } = setup();
    const { config } = run({ overrides: { name: "Gadget", description: "Does gadget things." } });
    expect(config.site).toMatchObject({ name: "Gadget", description: "Does gadget things." });
    expect(config.hero).toMatchObject({ title: "Gadget", lede: "Does gadget things." });
  });
});
