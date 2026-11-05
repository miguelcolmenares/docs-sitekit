import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initSite, LOCK_FILE } from "../../application";
import type { SiteLock, TemplateSource } from "../../application";
import { nodeEnvironment, nodeFileSystem, packagedTemplate, sha256 } from "../../infrastructure";
import { runCli } from "../../presentation";
import { loadSiteConfig } from "../../../template/src/infrastructure";

const TEMPLATE_ROOT = join(__dirname, "..", "..", "..", "template");
const current = packagedTemplate(TEMPLATE_ROOT);

// Files the kit changed since the older version, and files it did not.
const KIT_CHANGED = "src/domain/describe.ts";
const BOTH_CHANGED = "src/styles/prose.css";
const ONLY_YOU_CHANGED = "src/domain/glob.ts";

/**
 * A template as an earlier version shipped it: no search, no llms.txt, and an older copy of the
 * files the kit has changed since. It is the current template with those differences, so the test
 * stays true to the real files without a copy of an old release in the repository.
 */
function olderTemplate(): TemplateSource {
  const files = current
    .files()
    .filter(
      (file) => !/search|llms|Llms/.test(file.path) && file.path !== "src/pages/[name].json.ts",
    )
    .map((file) =>
      file.path === KIT_CHANGED || file.path === BOTH_CHANGED
        ? { ...file, content: `${file.content}/* an older line */\n` }
        : file,
    );
  return { ...current, files: () => files, version: () => "0.1.0" };
}

const git = (root: string, ...args: string[]) =>
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
      cwd: root,
      stdio: "pipe",
      // A git hook sets GIT_DIR and GIT_INDEX_FILE, which would aim these commands at the real repository.
      env: Object.fromEntries(
        Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
      ),
    },
  );

/** Every file under a folder with its text, for comparing before and after. */
function snapshot(directory: string, prefix = ""): Record<string, string> {
  return Object.assign(
    {},
    ...readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.name !== ".git")
      .map((entry) =>
        entry.isDirectory()
          ? snapshot(join(directory, entry.name), `${prefix}${entry.name}/`)
          : { [`${prefix}${entry.name}`]: readFileSync(join(directory, entry.name), "utf8") },
      ),
  );
}

let root: string;
const SITE = () => join(root, "site");
const lock = () => JSON.parse(readFileSync(join(SITE(), LOCK_FILE), "utf8")) as SiteLock;

function upgrade(...args: string[]) {
  let out = "";
  let err = "";
  const code = runCli(["upgrade", "--root", root, ...args], {
    out: (text) => (out += text),
    err: (text) => (err += text),
    cwd: root,
    templateRoot: TEMPLATE_ROOT,
  });
  return { code, out, err };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sitekit-upgrade-"));
  git(root, "init", "-q", "-b", "main");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "widget", version: "1.0.0" }));
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "docs", "start.md"), "# Start\n\nThe first page.\n");
  writeFileSync(join(root, "README.md"), "# Widget\n\nA widget.\n");
  initSite(
    { fs: nodeFileSystem, env: nodeEnvironment, template: olderTemplate(), hash: sha256 },
    { root, siteDir: "site" },
  );
  // The config of a site made before the newer options existed.
  const path = join(SITE(), "sitekit.config.json");
  const config = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  for (const key of ["theme", "search", "llms"]) delete config[key];
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
  writeFileSync(join(SITE(), ONLY_YOU_CHANGED), "// my own change\n");
  writeFileSync(join(SITE(), BOTH_CHANGED), "/* my own styles */\n");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "A site and two edits");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("sitekit upgrade on real files", () => {
  it("replaces, keeps, adds and leaves for you to merge, and never loses your file", () => {
    const before = snapshot(root);
    const { code, out } = upgrade();
    expect(code).toBe(0);
    expect(out).toContain("Upgrading site/ from 0.1.0 to ");

    // replaced: you did not edit it, the kit changed it
    expect(readFileSync(join(SITE(), KIT_CHANGED), "utf8")).toBe(
      readFileSync(join(TEMPLATE_ROOT, KIT_CHANGED), "utf8"),
    );
    // kept: you edited it, the kit did not
    expect(readFileSync(join(SITE(), ONLY_YOU_CHANGED), "utf8")).toBe("// my own change\n");
    // conflict: yours is untouched and the kit's version is next to it
    expect(readFileSync(join(SITE(), BOTH_CHANGED), "utf8")).toBe("/* my own styles */\n");
    expect(readFileSync(join(SITE(), `${BOTH_CHANGED}.sitekit-new`), "utf8")).toBe(
      readFileSync(join(TEMPLATE_ROOT, BOTH_CHANGED), "utf8"),
    );
    // added: new in the kit
    expect(readFileSync(join(SITE(), "src/domain/llms.ts"), "utf8")).toBe(
      readFileSync(join(TEMPLATE_ROOT, "src/domain/llms.ts"), "utf8"),
    );
    expect(out).toContain(`! site/${BOTH_CHANGED}`);
    expect(out).toContain(`= site/${ONLY_YOU_CHANGED}`);

    // nothing outside the site and its lock was touched, and the content is as it was
    const after = snapshot(root);
    const changed = Object.keys({ ...before, ...after }).filter(
      (path) => before[path] !== after[path],
    );
    expect(changed.filter((path) => !path.startsWith("site/"))).toEqual([]);
    expect(after["docs/start.md"]).toBe(before["docs/start.md"]);
  });

  it("writes a lock for the replaced and added files only", () => {
    const old = lock();
    upgrade();
    const next = lock();
    expect(next.sitekit).toBe(current.version());
    expect(next.files[KIT_CHANGED]).toBe(
      sha256(readFileSync(join(TEMPLATE_ROOT, KIT_CHANGED), "utf8")),
    );
    expect(next.files["src/domain/llms.ts"]).toBeDefined();
    expect(next.files[BOTH_CHANGED]).toBe(old.files[BOTH_CHANGED]);
    expect(next.files[ONLY_YOU_CHANGED]).toBe(old.files[ONLY_YOU_CHANGED]);
  });

  it("keeps the site as it was: search and llms.txt are off, and the config still loads", () => {
    upgrade();
    const config = loadSiteConfig(SITE());
    expect(config.search.enabled).toBe(false);
    expect(config.llms.enabled).toBe(false);
    expect(config.theme.default).toBe("dark");
  });

  it("with --dry-run writes nothing, not even a .sitekit-new", () => {
    const before = snapshot(root);
    const { out } = upgrade("--dry-run");
    expect(snapshot(root)).toEqual(before);
    expect(out).toContain("Dry run: nothing was written.");
    expect(out).toContain("would be replaced");
  });

  it("is a dry run by default while the working tree has uncommitted changes, and says so", () => {
    writeFileSync(join(root, "docs", "start.md"), "# Start\n\nEdited, not committed.\n");
    const before = snapshot(root);
    const { out } = upgrade();
    expect(snapshot(root)).toEqual(before);
    expect(out).toContain("uncommitted changes");
    expect(out).toContain("--apply");
  });

  it("writes over a dirty working tree with --apply", () => {
    writeFileSync(join(root, "docs", "start.md"), "# Start\n\nEdited, not committed.\n");
    upgrade("--apply");
    expect(readFileSync(join(SITE(), KIT_CHANGED), "utf8")).toBe(
      readFileSync(join(TEMPLATE_ROOT, KIT_CHANGED), "utf8"),
    );
  });

  it("finds nothing to do the second time, and still has the conflict", () => {
    upgrade();
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "Upgrade");
    const { out } = upgrade();
    expect(out).toContain("Upgrading site/ at ");
    expect(out).toContain("0 replaced, 0 added");
    expect(out).toContain(`! site/${BOTH_CHANGED}`);
  });

  it("fails with a way forward in a folder that is not a site", () => {
    mkdirSync(join(root, "other"));
    const { code, err } = upgrade("--dir", "other");
    expect(code).toBe(1);
    expect(err).toContain("Only a site made by `sitekit init` can be upgraded");
  });
});
