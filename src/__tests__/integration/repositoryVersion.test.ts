import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readRepositoryVersion } from "../../../template/src/infrastructure";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sitekit-version-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("readRepositoryVersion", () => {
  it("reads the version from package.json, and sees a new one on the next read", () => {
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.2.3" }));
    expect(readRepositoryVersion(root)).toBe("1.2.3");
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.3.0" }));
    expect(readRepositoryVersion(root)).toBe("1.3.0");
  });

  it("returns undefined without a package.json, without a version, or with broken JSON", () => {
    expect(readRepositoryVersion(root)).toBeUndefined();
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x" }));
    expect(readRepositoryVersion(root)).toBeUndefined();
    writeFileSync(join(root, "package.json"), "{ nope");
    expect(readRepositoryVersion(root)).toBeUndefined();
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: 3 }));
    expect(readRepositoryVersion(root)).toBeUndefined();
  });
});
