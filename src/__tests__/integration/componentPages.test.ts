import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addComponent } from "../../application";
import { KIT_ONLY_PATHS, nodeFileSystem, packagedTemplate, sha256 } from "../../infrastructure";

const ROOT = join(__dirname, "..", "..", "..");
const SCRIPT = join(ROOT, "scripts", "build-component-docs.mjs");
const TEMPLATE = join(ROOT, "template");

jest.setTimeout(60_000);

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "sitekit-component-pages-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function run(args: string[]) {
  try {
    return {
      code: 0,
      output: execFileSync("node", [SCRIPT, ...args], { encoding: "utf8", stdio: "pipe" }),
    };
  } catch (error) {
    const failed = error as { status: number; stdout: string; stderr: string };
    return { code: failed.status, output: `${failed.stdout}${failed.stderr}` };
  }
}

describe("the template that `init` copies", () => {
  const files = packagedTemplate(TEMPLATE).files();
  const paths = files.map((file) => file.path);

  it("carries no example, and no layout that only the project site uses", () => {
    for (const folder of KIT_ONLY_PATHS) {
      expect(paths.filter((path) => path.startsWith(`${folder}/`))).toEqual([]);
    }
    expect(
      paths.filter((path) => path.includes("previewTheme") || path.endsWith("props.json")),
    ).toEqual([]);
  });

  it("still carries the layout every site uses, and the route that looks for a layout of a collection", () => {
    expect(paths).toContain("src/presentation/layouts/DocPage.astro");
    expect(paths).toContain("src/pages/[collection]/[...slug].astro");
  });

  it("is restored by `add` without the examples, though the registry points at them", () => {
    const registry = packagedTemplate(TEMPLATE).registry();
    expect(registry.components["stat-row"]?.example).toBe("src/examples/stat-row");
    const result = addComponent(
      { fs: nodeFileSystem, template: packagedTemplate(TEMPLATE), hash: sha256 },
      { siteAbs: dir, name: "stat-row" },
    );
    expect(result.written).toEqual(["src/presentation/components/site/StatRow.tsx"]);
  });
});

describe("npm run build:docs, the tables of props", () => {
  it("writes the file that is committed, and a second run changes nothing", () => {
    const out = join(dir, "props.json");
    expect(run(["--out", out]).code).toBe(0);
    const first = readFileSync(out, "utf8");
    expect(first).toBe(readFileSync(join(TEMPLATE, "src", "examples", "props.json"), "utf8"));
    expect(run(["--out", out]).code).toBe(0);
    expect(readFileSync(out, "utf8")).toBe(first);
  });

  it("--check passes on a fresh file and fails on a stale one, without writing", () => {
    const out = join(dir, "props.json");
    run(["--out", out]);
    expect(run(["--check", "--out", out]).code).toBe(0);
    const stale = readFileSync(out, "utf8").replace("The look of the button.", "A look.");
    writeFileSync(out, stale);
    const result = run(["--check", "--out", out]);
    expect(result.code).toBe(1);
    expect(result.output).toMatch(/out of date.*npm run build:docs/);
    expect(readFileSync(out, "utf8")).toBe(stale);
  });

  it("--check fails when the file does not exist", () => {
    expect(run(["--check", "--out", join(dir, "missing.json")]).code).toBe(1);
  });
});
