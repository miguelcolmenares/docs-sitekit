import {
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addComponent, initSite, LOCK_FILE, upgradeSite } from "../../application";
import type { SiteLock } from "../../application";
import { nodeFileSystem, packagedTemplate, sha256 } from "../../infrastructure";
import { fakeEnv } from "../support/memory";

const template = packagedTemplate(join(__dirname, "..", "..", "..", "template"));
const HEADER = "src/presentation/components/site/site-header.astro";
const HELPER = "src/presentation/components/site/navigation-fit.ts";
let root: string;
let site: string;
let outside: string;

function snapshot(directory: string): Record<string, string> {
  return Object.fromEntries(
    readdirSync(directory).flatMap((name) => {
      const path = join(directory, name);
      const entry = lstatSync(path);
      if (entry.isSymbolicLink()) return [[name, `link:${readlinkSync(path)}`]];
      if (entry.isDirectory())
        return [
          [name, "directory"],
          ...Object.entries(snapshot(path)).map(([relative, value]) => [
            `${name}/${relative}`,
            value,
          ]),
        ];
      return [[name, `file:${readFileSync(path, "utf8")}`]];
    }),
  );
}

function seedOldHeader() {
  // Synthetic prior managed content exercises hash-authorized replacement, not a historical scaffold.
  const old = `${readFileSync(join(site, HEADER), "utf8")}\n<!-- previous managed fixture -->\n`;
  writeFileSync(join(site, HEADER), old);
  const lockPath = join(site, LOCK_FILE);
  const lock = JSON.parse(readFileSync(lockPath, "utf8")) as SiteLock;
  lock.sitekit = "0.4.0";
  lock.files[HEADER] = sha256(old);
  writeFileSync(lockPath, JSON.stringify(lock));
  return old;
}

function upgrade() {
  return upgradeSite(
    { fs: nodeFileSystem, env: fakeEnv(), template, hash: sha256 },
    { root, siteDir: "site", apply: true },
  );
}

function add(force = false) {
  return addComponent(
    { fs: nodeFileSystem, template, hash: sha256 },
    { siteAbs: site, name: "site-header", force },
  );
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sitekit-managed-paths-"));
  site = join(root, "site");
  outside = join(root, "outside.txt");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "managed-path-fixture" }));
  initSite(
    { fs: nodeFileSystem, env: fakeEnv(), template, hash: sha256 },
    { root, siteDir: "site" },
  );
  writeFileSync(outside, seedOldHeader());
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("managed destinations on the real filesystem", () => {
  it.each(["upgrade", "add", "force"] as const)(
    "%s refuses a stock-hash symlink without changing the outside file or any site file",
    (command) => {
      rmSync(join(site, HEADER));
      symlinkSync(outside, join(site, HEADER));
      const before = snapshot(root);
      expect(() => (command === "upgrade" ? upgrade() : add(command === "force"))).toThrow(
        /Unsafe managed path.*manual migration.*No files were written/,
      );
      expect(snapshot(root)).toEqual(before);
    },
  );

  it.each(["dangling", "parent", "dangling-parent", "hardlink"] as const)(
    "refuses a %s target before replacing the header group or lock",
    (kind) => {
      if (kind === "parent" || kind === "dangling-parent") {
        const parent = join(site, "src/presentation/components/site");
        const relocated = join(root, "outside-components");
        renameSync(parent, relocated);
        symlinkSync(kind === "parent" ? relocated : join(root, "missing-components"), parent);
      } else {
        rmSync(join(site, HEADER));
        if (kind === "hardlink") linkSync(outside, join(site, HEADER));
        else symlinkSync(join(root, "missing-header"), join(site, HEADER));
      }
      const before = snapshot(root);
      expect(upgrade).toThrow(/Unsafe managed path/);
      expect(snapshot(root)).toEqual(before);
    },
  );

  it("retains an ordinary directory placeholder and offers the header group for manual migration", () => {
    const header = readFileSync(join(site, HEADER), "utf8");
    rmSync(join(site, HEADER));
    mkdirSync(join(site, HEADER));
    writeFileSync(join(site, HEADER, "owner.txt"), "owned directory contents\n");
    const external = readFileSync(outside, "utf8");
    const result = upgrade();
    expect(lstatSync(join(site, HEADER)).isDirectory()).toBe(true);
    expect(readFileSync(join(site, HEADER, "owner.txt"), "utf8")).toBe(
      "owned directory contents\n",
    );
    expect(result.deleted).toContain(`site/${HEADER}`);
    expect(result.conflicts).toContain(`site/${HEADER}`);
    expect(readFileSync(outside, "utf8")).toBe(external);
    expect(
      (JSON.parse(readFileSync(join(site, LOCK_FILE), "utf8")) as SiteLock).files[HEADER],
    ).toBe(sha256(header));
  });

  it.each([LOCK_FILE, "sitekit.config.json", "package.json"])(
    "refuses linked metadata %s before any managed write",
    (relative) => {
      const external = join(root, "outside-metadata.json");
      renameSync(join(site, relative), external);
      symlinkSync(external, join(site, relative));
      const before = snapshot(root);
      expect(upgrade).toThrow(/Unsafe managed path/);
      expect(snapshot(root)).toEqual(before);
    },
  );

  it("rejects a linked conflict companion before any group or metadata write", () => {
    writeFileSync(join(site, HELPER), "// owner's customized helper\n");
    symlinkSync(outside, join(site, `${HEADER}.sitekit-new`));
    const before = snapshot(root);
    expect(upgrade).toThrow(/Unsafe managed path/);
    expect(snapshot(root)).toEqual(before);
  });

  it("still upgrades an ordinary managed group", () => {
    upgrade();
    expect(readFileSync(join(site, HEADER), "utf8")).toBe(
      template.files().find((file) => file.path === HEADER)!.content,
    );
    expect(lstatSync(join(site, HELPER)).isFile()).toBe(true);
  });
});
