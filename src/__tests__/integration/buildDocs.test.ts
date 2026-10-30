import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addComponent, listComponents } from "../../application";
import { nodeFileSystem, packagedTemplate, sha256 } from "../../infrastructure";

const ROOT = join(__dirname, "..", "..", "..");
const SCRIPT = join(ROOT, "scripts", "build-docs.mjs");
const TEMPLATE = join(ROOT, "template");

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "sitekit-build-docs-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** Run the script. Returns the exit code and what it printed. */
function run(args: string[]) {
  try {
    const stdout = execFileSync("node", [SCRIPT, ...args], { encoding: "utf8", stdio: "pipe" });
    return { code: 0, output: stdout };
  } catch (error) {
    const failed = error as { status: number; stdout: string; stderr: string };
    return { code: failed.status, output: `${failed.stdout}${failed.stderr}` };
  }
}

describe("npm run build:docs", () => {
  it("writes the page, and a second run changes nothing", () => {
    const out = join(dir, "configuration.md");
    expect(run(["--out", out]).code).toBe(0);
    const first = readFileSync(out, "utf8");
    expect(run(["--out", out]).code).toBe(0);
    expect(readFileSync(out, "utf8")).toBe(first);
  });

  it("writes exactly the page that is committed in docs/", () => {
    const out = join(dir, "configuration.md");
    run(["--out", out]);
    expect(readFileSync(out, "utf8")).toBe(
      readFileSync(join(ROOT, "docs", "configuration.md"), "utf8"),
    );
  });

  it("--check passes on a fresh page and fails on a stale one, without writing", () => {
    const out = join(dir, "configuration.md");
    run(["--out", out]);
    expect(run(["--check", "--out", out]).code).toBe(0);
    const stale = readFileSync(out, "utf8").replace("`site.name`", "`site.title`");
    writeFileSync(out, stale);
    const result = run(["--check", "--out", out]);
    expect(result.code).toBe(1);
    expect(result.output).toMatch(/out of date.*npm run build:docs/);
    expect(readFileSync(out, "utf8")).toBe(stale);
  });

  it("--check fails when the page does not exist", () => {
    expect(run(["--check", "--out", join(dir, "missing.md")]).code).toBe(1);
  });
});

describe("the reference table, with the real template", () => {
  it("is in the registry that `list` prints", () => {
    const registry = packagedTemplate(TEMPLATE).registry();
    expect(listComponents(registry).map((component) => component.name)).toContain(
      "reference-table",
    );
  });

  it("is restored by `add` as the file the template ships, with nothing else to install", () => {
    const site = mkdtempSync(join(tmpdir(), "sitekit-reftable-"));
    try {
      writeFileSync(join(site, "package.json"), JSON.stringify({ dependencies: {} }));
      const deps = { fs: nodeFileSystem, template: packagedTemplate(TEMPLATE), hash: sha256 };
      const result = addComponent(deps, { siteAbs: site, name: "reference-table" });
      const path = "src/presentation/components/site/ReferenceTable.tsx";
      expect(result.written).toEqual([path]);
      expect(result.missingPackages).toEqual([]);
      expect(readFileSync(join(site, path), "utf8")).toBe(
        readFileSync(join(TEMPLATE, path), "utf8"),
      );
    } finally {
      rmSync(site, { recursive: true, force: true });
    }
  });
});
