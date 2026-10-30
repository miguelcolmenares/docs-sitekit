import { initSite, LOCK_FILE, upgradeSite } from "../application";
import type { SiteLock, TemplateFile } from "../application";
import { fakeEnv, fakeTemplate, MemoryFileSystem, sha } from "./support/memory";

const ROOT = "/work/widget";
const SITE = `${ROOT}/site`;

const pkg = (dependencies: Record<string, string>) =>
  JSON.stringify({ name: "sitekit-site", private: true, dependencies });

const OLD: TemplateFile[] = [
  { path: "package.json", content: pkg({ clsx: "^2.0.0" }) },
  { path: "src/same.ts", content: "export const same = 1;\n" },
  { path: "src/kit-changes.ts", content: "export const value = 1;\n" },
  { path: "src/you-change.ts", content: "export const mine = 1;\n" },
  { path: "src/both.ts", content: "export const both = 1;\n" },
];

/** The kit one version later: one file changed, one new, one dependency added, one file dropped. */
const NEW: TemplateFile[] = [
  { path: "package.json", content: pkg({ clsx: "^2.0.0", zod: "^4.0.0" }) },
  { path: "src/same.ts", content: "export const same = 1;\n" },
  { path: "src/kit-changes.ts", content: "export const value = 2;\n" },
  { path: "src/you-change.ts", content: "export const mine = 1;\n" },
  { path: "src/both.ts", content: "export const both = 2;\n" },
  { path: "src/presentation/search/SearchDialog.astro", content: "<dialog />\n" },
];

interface Setup {
  oldFiles?: TemplateFile[];
  newFiles?: TemplateFile[];
  uncommittedChanges?: boolean;
  /** Edits the owner makes after `init`, as path -> text. */
  edits?: Record<string, string>;
  extra?: Record<string, string>;
}

function setup({
  oldFiles = OLD,
  newFiles = NEW,
  uncommittedChanges,
  edits = {},
  extra = {},
}: Setup = {}) {
  const fs = new MemoryFileSystem({
    [`${ROOT}/package.json`]: JSON.stringify({ name: "@me/widget", description: "A widget." }),
    [`${ROOT}/docs/start.md`]: "# Start\n",
    [`${ROOT}/CHANGELOG.md`]: "# Changelog\n",
    ...extra,
  });
  const env = fakeEnv({ remoteUrl: "https://github.com/me/widget.git", uncommittedChanges });
  initSite(
    { fs, env, template: fakeTemplate({ files: oldFiles, version: "0.1.0" }), hash: sha },
    { root: ROOT, siteDir: "site" },
  );
  // `init` writes a config without the newer options, as a site made by 0.1.0 has it.
  const config = JSON.parse(fs.readText(`${SITE}/sitekit.config.json`)) as Record<string, unknown>;
  for (const key of ["theme", "search", "llms"]) delete config[key];
  fs.writeText(`${SITE}/sitekit.config.json`, `${JSON.stringify(config, null, 2)}\n`);
  for (const [path, text] of Object.entries(edits)) fs.writeText(`${SITE}/${path}`, text);
  const lockBefore = fs.readText(`${SITE}/${LOCK_FILE}`);
  return {
    fs,
    lockBefore,
    lock: () => JSON.parse(fs.readText(`${SITE}/${LOCK_FILE}`)) as SiteLock,
    upgrade: (options: { dryRun?: boolean; apply?: boolean } = {}, files = newFiles) =>
      upgradeSite(
        { fs, env, template: fakeTemplate({ files, version: "0.2.0" }), hash: sha },
        { root: ROOT, siteDir: "site", ...options },
      ),
  };
}

describe("upgradeSite", () => {
  it("replaces a file you did not edit and the kit changed", () => {
    const { fs, upgrade } = setup();
    const result = upgrade();
    expect(result.replaced).toContain("site/src/kit-changes.ts");
    expect(fs.readText(`${SITE}/src/kit-changes.ts`)).toBe("export const value = 2;\n");
  });

  it("keeps a file you edited and the kit did not change", () => {
    const { fs, upgrade } = setup({ edits: { "src/you-change.ts": "export const mine = 99;\n" } });
    const result = upgrade();
    expect(result.kept).toEqual(["site/src/you-change.ts"]);
    expect(fs.readText(`${SITE}/src/you-change.ts`)).toBe("export const mine = 99;\n");
    expect(fs.exists(`${SITE}/src/you-change.ts.sitekit-new`)).toBe(false);
  });

  it("leaves a file you and the kit both changed, with the new version next to it", () => {
    const mine = "export const both = 'mine';\n";
    const { fs, upgrade } = setup({ edits: { "src/both.ts": mine } });
    const result = upgrade();
    expect(result.conflicts).toEqual(["site/src/both.ts"]);
    expect(fs.readText(`${SITE}/src/both.ts`)).toBe(mine);
    expect(fs.readText(`${SITE}/src/both.ts.sitekit-new`)).toBe("export const both = 2;\n");
  });

  it("adds a file that is new in the kit", () => {
    const { fs, upgrade } = setup();
    const result = upgrade();
    expect(result.added).toEqual(["site/src/presentation/search/SearchDialog.astro"]);
    expect(fs.readText(`${SITE}/src/presentation/search/SearchDialog.astro`)).toBe("<dialog />\n");
  });

  it("counts a file that neither side changed as current", () => {
    const { upgrade } = setup();
    expect(upgrade().unchanged).toEqual(["site/src/same.ts", "site/src/you-change.ts"]);
  });

  it("writes the new lock for the files that were replaced or added, and keeps the old hash of a conflict", () => {
    const { lock, upgrade } = setup({ edits: { "src/both.ts": "export const both = 'mine';\n" } });
    const before = lock();
    upgrade();
    const after = lock();
    expect(after.sitekit).toBe("0.2.0");
    expect(after.files["src/kit-changes.ts"]).toBe(sha("export const value = 2;\n"));
    expect(after.files["src/presentation/search/SearchDialog.astro"]).toBe(sha("<dialog />\n"));
    expect(after.files["src/both.ts"]).toBe(before.files["src/both.ts"]);
    expect(after.files["src/same.ts"]).toBe(before.files["src/same.ts"]);
  });

  it("renders the manifest with the name the site already has, so the name is not a change", () => {
    const { fs, upgrade } = setup();
    const result = upgrade();
    expect(result.replaced).toContain("site/package.json");
    const manifest = JSON.parse(fs.readText(`${SITE}/package.json`)) as {
      name: string;
      description: string;
      dependencies: Record<string, string>;
    };
    expect(manifest.name).toBe("widget-docs");
    expect(manifest.description).toBe("Documentation site for widget.");
    expect(manifest.dependencies.zod).toBe("^4.0.0");
  });

  it("does not report the manifest as changed when the kit left it alone", () => {
    const { upgrade } = setup({ oldFiles: NEW });
    expect(upgrade().replaced).toEqual([]);
  });

  describe("never writes outside the lock", () => {
    it("leaves content, the repository and files of your own alone", () => {
      const { fs, upgrade } = setup({
        edits: { "src/mine.ts": "export const unrelated = 1;\n" },
        extra: { [`${ROOT}/src/index.ts`]: "export {}\n" },
      });
      const outside = new Map(
        [...fs.files].filter(
          ([path]) => !path.startsWith(`${SITE}/src/`) && !path.endsWith("package.json"),
        ),
      );
      upgrade();
      expect(fs.readText(`${SITE}/src/mine.ts`)).toBe("export const unrelated = 1;\n");
      for (const [path, text] of outside) {
        if (path.endsWith(LOCK_FILE) || path.endsWith("sitekit.config.json")) continue;
        expect(fs.readText(path)).toBe(text);
      }
      expect(fs.readText(`${ROOT}/docs/start.md`)).toBe("# Start\n");
    });

    it("leaves a file the kit no longer ships where it is, and says so", () => {
      const { fs, upgrade } = setup();
      const result = upgrade(
        {},
        NEW.filter((file) => file.path !== "src/same.ts"),
      );
      expect(result.retired).toEqual(["site/src/same.ts"]);
      expect(fs.readText(`${SITE}/src/same.ts`)).toBe("export const same = 1;\n");
    });

    it("does not bring back a file you deleted", () => {
      const { fs, upgrade } = setup();
      fs.files.delete(`${SITE}/src/kit-changes.ts`);
      const result = upgrade();
      expect(result.deleted).toEqual(["site/src/kit-changes.ts"]);
      expect(fs.exists(`${SITE}/src/kit-changes.ts`)).toBe(false);
    });

    it("does not overwrite a file of yours that sits where a new file of the kit goes", () => {
      const { fs, upgrade } = setup();
      fs.writeText(`${SITE}/src/presentation/search/SearchDialog.astro`, "<mine />\n");
      const result = upgrade();
      expect(result.conflicts).toEqual(["site/src/presentation/search/SearchDialog.astro"]);
      expect(fs.readText(`${SITE}/src/presentation/search/SearchDialog.astro`)).toBe("<mine />\n");
      expect(fs.readText(`${SITE}/src/presentation/search/SearchDialog.astro.sitekit-new`)).toBe(
        "<dialog />\n",
      );
    });
  });

  it("takes a file you already copied from the new version as current", () => {
    const { lock, upgrade } = setup({ edits: { "src/both.ts": "export const both = 2;\n" } });
    const result = upgrade();
    expect(result.conflicts).toEqual([]);
    expect(result.unchanged).toContain("site/src/both.ts");
    expect(lock().files["src/both.ts"]).toBe(sha("export const both = 2;\n"));
  });

  it("is safe to run twice: a conflict stays a conflict and a replaced file is current", () => {
    const { fs, upgrade } = setup({ edits: { "src/both.ts": "export const both = 'mine';\n" } });
    upgrade();
    const second = upgrade();
    expect(second.replaced).toEqual([]);
    expect(second.added).toEqual([]);
    expect(second.conflicts).toEqual(["site/src/both.ts"]);
    expect(fs.readText(`${SITE}/src/both.ts`)).toBe("export const both = 'mine';\n");
  });

  describe("options that did not exist before", () => {
    it("adds theme, search and llms with the values that keep the site as it was", () => {
      const { fs, upgrade } = setup();
      const result = upgrade();
      expect(result.options.map((option) => option.key)).toEqual(["theme", "search", "llms"]);
      const config = JSON.parse(fs.readText(`${SITE}/sitekit.config.json`)) as Record<
        string,
        unknown
      >;
      expect(config.theme).toEqual({ default: "dark" });
      expect(config.search).toEqual({ enabled: false });
      expect(config.llms).toEqual({ enabled: false, optional: [], markdownPages: false });
      expect((config.site as { name: string }).name).toBe("widget");
    });

    it("does not touch an option the owner has set", () => {
      const { fs, upgrade } = setup();
      const path = `${SITE}/sitekit.config.json`;
      const config = JSON.parse(fs.readText(path)) as Record<string, unknown>;
      config.search = { enabled: true };
      config.theme = { default: "light" };
      fs.writeText(path, JSON.stringify(config));
      const result = upgrade();
      expect(result.options.map((option) => option.key)).toEqual(["llms"]);
      const after = JSON.parse(fs.readText(path)) as Record<string, unknown>;
      expect(after.search).toEqual({ enabled: true });
      expect(after.theme).toEqual({ default: "light" });
    });

    it("does not turn search off on a site that already has the search files", () => {
      const withSearch = [...OLD, NEW[NEW.length - 1]!];
      const { upgrade } = setup({ oldFiles: withSearch });
      expect(upgrade().options.map((option) => option.key)).not.toContain("search");
    });
  });

  describe("dry run", () => {
    it("writes nothing, and reports what it would do", () => {
      const { fs, upgrade } = setup({ edits: { "src/both.ts": "export const both = 'mine';\n" } });
      const before = new Map(fs.files);
      const result = upgrade({ dryRun: true });
      expect(new Map(fs.files)).toEqual(before);
      expect(result.dryRun).toBe(true);
      expect(result.dryRunReason).toBe("requested");
      expect(result.replaced).toContain("site/src/kit-changes.ts");
      expect(result.conflicts).toEqual(["site/src/both.ts"]);
      expect(result.added).toHaveLength(1);
      expect(result.options).toHaveLength(3);
    });

    it("is the default while the working tree has uncommitted changes", () => {
      const { fs, upgrade } = setup({ uncommittedChanges: true });
      const before = new Map(fs.files);
      const result = upgrade();
      expect(result.dryRun).toBe(true);
      expect(result.dryRunReason).toBe("uncommitted-changes");
      expect(new Map(fs.files)).toEqual(before);
    });

    it("is overridden by --apply, which writes over a dirty working tree", () => {
      const { fs, upgrade } = setup({ uncommittedChanges: true });
      const result = upgrade({ apply: true });
      expect(result.dryRun).toBe(false);
      expect(fs.readText(`${SITE}/src/kit-changes.ts`)).toBe("export const value = 2;\n");
    });

    it("stays a dry run when both --dry-run and --apply are given", () => {
      const { lock, lockBefore, upgrade } = setup({ uncommittedChanges: true });
      expect(upgrade({ dryRun: true, apply: true }).dryRun).toBe(true);
      expect(JSON.stringify(lock())).toBe(JSON.stringify(JSON.parse(lockBefore)));
    });

    it("writes on a clean working tree, and when git cannot tell", () => {
      expect(setup({ uncommittedChanges: false }).upgrade().dryRun).toBe(false);
      expect(setup({ uncommittedChanges: undefined }).upgrade().dryRun).toBe(false);
    });
  });

  describe("the deploy workflow", () => {
    it("is reported when it still pins the old version, and is never edited", () => {
      const { fs, upgrade } = setup();
      const workflow = fs.readText(`${ROOT}/.github/workflows/docs.yml`);
      const result = upgrade();
      expect(result.workflowPinned).toBe(".github/workflows/docs.yml");
      expect(fs.readText(`${ROOT}/.github/workflows/docs.yml`)).toBe(workflow);
    });

    it("is not reported when the site is already at this version", () => {
      const { fs, upgrade } = setup();
      fs.writeText(`${ROOT}/.github/workflows/docs.yml`, "run: npx sitekit@0.2.0 check\n");
      expect(upgrade().workflowPinned).toBeUndefined();
    });
  });

  describe("errors", () => {
    it("says what to do when the folder has no lock", () => {
      const { fs, upgrade } = setup();
      fs.files.delete(`${SITE}/${LOCK_FILE}`);
      expect(() => upgrade()).toThrow(/\.sitekit\.json not found.*--dir/);
    });

    it("refuses a lock that is not one of ours, without writing", () => {
      const { fs, upgrade } = setup();
      fs.writeText(`${SITE}/${LOCK_FILE}`, JSON.stringify({ files: [] }));
      expect(() => upgrade()).toThrow(/not a lock file/);
      expect(fs.exists(`${SITE}/src/presentation/search/SearchDialog.astro`)).toBe(false);
    });
  });
});
