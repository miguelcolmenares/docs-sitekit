import { addComponent } from "../application";
import type { FileSystem } from "../application";
import { assertManagedPaths } from "../application/managed-path";
import { fakeTemplate, MemoryFileSystem, sha } from "./support/memory";

describe("managed path preflight", () => {
  it.each(["../outside", "/outside", "src/../../outside", "src\\outside", "C:/outside"])(
    "rejects a nonlocal managed destination %s",
    (path) => {
      expect(() => assertManagedPaths(new MemoryFileSystem(), "/work/site", [path])).toThrow(
        /relative path inside the site/,
      );
    },
  );

  it("keeps the public legacy filesystem adapter shape assignable and usable", () => {
    const memory = new MemoryFileSystem();
    // Deliberately omit the optional physical-inspection capability from this public port.
    const legacy: FileSystem = {
      exists: (path) => memory.exists(path),
      isDirectory: (path) => memory.isDirectory(path),
      readText: (path) => memory.readText(path),
      writeText: (path, content) => memory.writeText(path, content),
      remove: (path) => memory.remove(path),
      listFiles: (path) => memory.listFiles(path),
    };
    const result = addComponent(
      { fs: legacy, template: fakeTemplate(), hash: sha },
      { siteAbs: "/work/site", name: "button" },
    );
    expect(result.written).toEqual(["src/cn.ts", "src/button.tsx"]);
    expect(memory.readText("/work/site/.sitekit.json")).toContain("src/button.tsx");
  });

  it("uses physical inspection without reading through an unsafe ancestor", () => {
    const memory = new MemoryFileSystem();
    const read = jest.spyOn(memory, "readText");
    memory.pathKind = (path) => (path === "/work/site/src" ? "other" : "missing");
    expect(() =>
      addComponent(
        { fs: memory, template: fakeTemplate(), hash: sha },
        { siteAbs: "/work/site", name: "button", force: true },
      ),
    ).toThrow(/Unsafe managed path/);
    expect(read).not.toHaveBeenCalled();
    expect(memory.files.size).toBe(0);
  });
});
