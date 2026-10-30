import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addComponent, listComponents } from "../../application";
import { nodeFileSystem, packagedTemplate, sha256 } from "../../infrastructure";
import { loadSiteConfig } from "../../../template/src/infrastructure";

const TEMPLATE = join(__dirname, "..", "..", "..", "template");

let site: string;

beforeEach(() => {
  site = mkdtempSync(join(tmpdir(), "sitekit-statrow-"));
  writeFileSync(join(site, "package.json"), JSON.stringify({ dependencies: {} }));
});

afterEach(() => rmSync(site, { recursive: true, force: true }));

describe("the stat row, with the real template and real files", () => {
  it("is in the registry that `list` prints", () => {
    const registry = packagedTemplate(TEMPLATE).registry();
    expect(listComponents(registry).map((component) => component.name)).toContain("stat-row");
  });

  it("is restored by `add` as the file the template ships, with nothing else to install", () => {
    const deps = { fs: nodeFileSystem, template: packagedTemplate(TEMPLATE), hash: sha256 };
    const result = addComponent(deps, { siteAbs: site, name: "stat-row" });
    const path = "src/presentation/components/site/StatRow.tsx";
    expect(result.written).toEqual([path]);
    expect(result.missingPackages).toEqual([]);
    expect(readFileSync(join(site, path), "utf8")).toBe(readFileSync(join(TEMPLATE, path), "utf8"));
  });

  it("is fed by the stats of a config file, and a count outside two to five fails the load", () => {
    const write = (stats: unknown) =>
      writeFileSync(
        join(site, "sitekit.config.json"),
        JSON.stringify({
          site: { name: "Demo", description: "d", url: "https://me.github.io" },
          hero: { title: "Demo", lede: "l", primary: { label: "Go", href: "/docs/" } },
          stats,
        }),
      );
    write([
      { value: "12k", label: "Downloads", note: "last month" },
      { value: "3", label: "Releases" },
    ]);
    expect(loadSiteConfig(site).stats.map((stat) => stat.label)).toEqual(["Downloads", "Releases"]);
    write([{ value: "1", label: "Alone" }]);
    expect(() => loadSiteConfig(site)).toThrow(/stats takes two to five items/);
  });

  it("is on the home page of this project, from its own config", () => {
    const config = loadSiteConfig(TEMPLATE);
    expect(config.stats.length).toBeGreaterThanOrEqual(2);
    expect(config.stats.length).toBeLessThanOrEqual(5);
  });
});
