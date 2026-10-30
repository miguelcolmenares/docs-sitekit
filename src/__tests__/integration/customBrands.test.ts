import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseSiteConfig } from "../../../template/src/domain";
import { readCustomBrands } from "../../../template/src/infrastructure/customBrands";

const SVG = '<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>';
const config = (...icons: string[]) =>
  parseSiteConfig({
    site: { name: "Demo", description: "A demo", url: "https://me.github.io" },
    hero: { title: "Demo", lede: "Lede", primary: { label: "Start", href: "/docs/" } },
    features: icons.map((icon) => ({ icon, eyebrow: "E", title: "T", text: "Text" })),
  });

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "custom-brands-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));
const add = (name: string, text: string) => {
  mkdirSync(join(dir, "brands"), { recursive: true });
  writeFileSync(join(dir, "brands", name), text);
};

describe("readCustomBrands", () => {
  it("reads the file of each custom icon the config uses, keyed by the icon value", () => {
    add("acme.svg", SVG);
    add("unused.svg", "this is not even an svg");
    expect(
      readCustomBrands(dir, config("brand:custom/acme", "brand:custom/acme", "layers")),
    ).toEqual({
      "brand:custom/acme": { viewBox: "0 0 10 10", paths: [{ d: "M0 0h10v10H0z" }] },
    });
  });

  it("reads nothing, and needs no folder, when the config has no custom icon", () => {
    expect(readCustomBrands(dir, config("brand:github"))).toEqual({});
  });

  it("fails on a missing file and lists the files that are there", () => {
    add("acme.svg", SVG);
    add("readme.txt", "x");
    expect(() => readCustomBrands(dir, config("brand:custom/acm"))).toThrow(
      /"brand:custom\/acm" has no file: add brands\/acm\.svg.*Files there now: acme\./,
    );
  });

  it("says when the folder does not exist", () => {
    expect(() => readCustomBrands(dir, config("brand:custom/acme"))).toThrow(
      /does not have any \.svg file yet/,
    );
  });

  it("fails on a file that is not a plain logo, naming the file", () => {
    add("acme.svg", '<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>');
    expect(() => readCustomBrands(dir, config("brand:custom/acme"))).toThrow(
      /brands\/acme\.svg: uses <script>/,
    );
  });
});
