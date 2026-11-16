import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { readDemoCatalog } from "../../../template/src/infrastructure/read-demos";
import { parseSiteConfig } from "../../../template/src/domain";
import { checkSite, isSafeToPublish } from "../../application";
import { fakeEnv, MemoryFileSystem } from "../support/memory";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sitekit-previews-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
const put = (file: string, text: string) => {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};
const config = (extra: Record<string, unknown> = {}) =>
  parseSiteConfig({
    site: {
      name: "Examples",
      description: "Examples",
      url: "https://example.com",
      base: "/project/",
    },
    hero: { title: "Examples", lede: "Examples", primary: { label: "Read", href: "/docs/" } },
    sources: { root: ".." },
    demos: { dir: "../demos" },
    deploy: { target: "none" },
    ...extra,
  });
const manifest = {
  schemaVersion: 1,
  examples: [
    {
      id: "counter",
      title: "Counter",
      preview: "counter/index.html",
      sources: [{ path: "counter/source.php", language: "php" }],
    },
  ],
};
function fixture() {
  mkdirSync(join(root, "site"));
  put("demos/manifest.json", JSON.stringify(manifest));
  put(
    "demos/counter/index.html",
    '<!doctype html><html lang="en"><head><title>Counter</title><link rel="stylesheet" href="counter.css"></head><body><button>Count</button><script src="counter.js"></script></body></html>',
  );
  put("demos/counter/counter.css", "button { color: black; }");
  put("demos/counter/counter.js", "document.querySelector('button').textContent = 'Ready';");
  put("demos/counter/source.php", "<?php echo '<button>Count</button>';\n");
}

describe("published prebuilt demo files", () => {
  it("reads local files and publishes runtime assets while keeping server source display-only", () => {
    fixture();
    const catalog = readDemoCatalog(join(root, "site"), config());
    expect(catalog.assets.map((asset) => asset.path).sort()).toEqual([
      "counter/counter.css",
      "counter/counter.js",
      "counter/index.html",
    ]);
    expect(catalog.sources["counter/source.php"]).toContain("<?php");
    expect(catalog.files.map((file) => file.path)).toContain("demos/counter/source.php");
  });

  it("fails on missing source and preview files rather than publishing broken examples", () => {
    fixture();
    rmSync(join(root, "demos/counter/source.php"));
    expect(() => readDemoCatalog(join(root, "site"), config())).toThrow(
      /Missing demo file: counter\/source.php/,
    );
    put("demos/counter/source.php", "text");
    rmSync(join(root, "demos/counter/index.html"));
    expect(() => readDemoCatalog(join(root, "site"), config())).toThrow(
      /Missing demo file: counter\/index.html/,
    );
  });

  it("rejects a demo directory outside the repository and an escaping symlink", () => {
    fixture();
    expect(() => readDemoCatalog(join(root, "site"), config({ demos: { dir: "../../" } }))).toThrow(
      /stay inside sources.root/,
    );
    put("private.php", "not published");
    rmSync(join(root, "demos/counter/source.php"));
    symlinkSync(join(root, "private.php"), join(root, "demos/counter/source.php"));
    expect(() => readDemoCatalog(join(root, "site"), config())).toThrow(/symlink leaves/);
  });

  it("rejects circular directory symlinks and unsupported unreferenced files", () => {
    fixture();
    symlinkSync(join(root, "demos"), join(root, "demos/loop"));
    expect(() => readDemoCatalog(join(root, "site"), config())).toThrow(/circular symlink/);
    rmSync(join(root, "demos/loop"));
    put("demos/unlisted.php", "not a static asset");
    expect(() => readDemoCatalog(join(root, "site"), config())).toThrow(/Unsupported demo asset/);
  });

  it("honors excluded files and replacements for both fixtures and displayed source", () => {
    fixture();
    expect(() =>
      readDemoCatalog(
        join(root, "site"),
        config({ anonymize: { excludePaths: ["demos/counter/source.php"] } }),
      ),
    ).toThrow(/excluded/);
    const catalog = readDemoCatalog(
      join(root, "site"),
      config({ anonymize: { replace: { Count: "Total" } } }),
    );
    expect(catalog.sources["counter/source.php"]).toContain("Total");
    expect(catalog.assets.find((asset) => asset.path === "counter/index.html")?.text).toContain(
      "Total",
    );
  });

  it("fails on an unknown page reference and on a reference with no demo configuration", () => {
    fixture();
    const page = {
      collection: "docs",
      path: "docs/demo.md",
      slug: "demo",
      route: "/docs/demo/",
      title: "Demo",
      description: "",
      descriptionSource: "none" as const,
      order: null,
      tags: [],
      group: null,
      body: "",
      demo: "missing",
    };
    expect(() => readDemoCatalog(join(root, "site"), config(), [page])).toThrow(
      /unknown demo "missing"/,
    );
    const without = config();
    delete without.demos;
    expect(() => readDemoCatalog(join(root, "site"), without, [page])).toThrow(/no "demos.dir"/);
  });

  it.each(["index.html", "counter.css", "counter.js", "source.php"])(
    "checks %s for credentials before publication",
    (file) => {
      fixture();
      const secret = ["AKIA", "IOSFODNN7EXAMPLE"].join("");
      put(`demos/counter/${file}`, `credential: ${secret}`);
      const configured = config();
      const catalog = readDemoCatalog(join(root, "site"), configured);
      const report = checkSite(
        {
          fs: new MemoryFileSystem(),
          env: fakeEnv(),
          loadContent: () => ({
            config: configured,
            files: [],
            documents: [],
            routes: [],
            existing: new Set(),
            demoFiles: catalog.files,
          }),
        },
        { root, siteDir: "site" },
      );
      expect(isSafeToPublish(report)).toBe(false);
      expect(report.findings.some((finding) => finding.location === `demos/counter/${file}`)).toBe(
        true,
      );
      expect(report.errors.join("\n")).not.toContain(secret);
    },
  );
});
