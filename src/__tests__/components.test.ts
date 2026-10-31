import { addComponent, listComponents, npmImports, resolveComponents } from "../application";
import { fakeTemplate, MemoryFileSystem, registry, sha } from "./support/memory";

const SITE = "/work/site";

describe("resolveComponents", () => {
  it("lists a component after what it requires, once each", () => {
    expect(resolveComponents(registry, "hero")).toEqual(["cn", "button", "hero"]);
  });

  it("fails on an unknown name and says how to find the valid ones", () => {
    expect(() => resolveComponents(registry, "nope")).toThrow(
      /Unknown component "nope".*sitekit list/,
    );
  });

  it("names the component that requires something missing", () => {
    const broken = { components: { a: { description: "", files: [], requires: ["ghost"] } } };
    expect(() => resolveComponents(broken, "a")).toThrow(/ghost.*required by a/);
  });

  it("detects a circular requirement", () => {
    const loop = {
      components: {
        a: { description: "", files: [], requires: ["b"] },
        b: { description: "", files: [], requires: ["a"] },
      },
    };
    expect(() => resolveComponents(loop, "a")).toThrow(/Circular/);
  });
});

describe("listComponents", () => {
  it("returns names and descriptions sorted by name", () => {
    expect(listComponents(registry).map((c) => c.name)).toEqual(["button", "cn", "hero"]);
  });
});

describe("npmImports", () => {
  it("returns package names and ignores relative, alias and node imports", () => {
    const source = `import { a } from "clsx";\nimport b from "@radix-ui/react-slot/deep";\nimport c from "./x";\nimport d from "@/infrastructure/cn";\nimport e from "node:fs";\nexport * from "lucide-react";`;
    expect(npmImports(source)).toEqual(["@radix-ui/react-slot", "clsx", "lucide-react"]);
  });
});

describe("addComponent", () => {
  const deps = (fs: MemoryFileSystem) => ({ fs, template: fakeTemplate(), hash: sha });

  it("writes the component and its requirements, and records their hashes", () => {
    const fs = new MemoryFileSystem({
      [`${SITE}/package.json`]: JSON.stringify({
        dependencies: { clsx: "1", "tailwind-merge": "3", "radix-ui": "1" },
      }),
    });
    const result = addComponent(deps(fs), { siteAbs: SITE, name: "hero" });
    expect(result.written).toEqual(["src/cn.ts", "src/button.tsx", "src/Hero.astro"]);
    const lock = JSON.parse(fs.readText(`${SITE}/.sitekit.json`));
    expect(lock.files["src/cn.ts"]).toBe(sha(fs.readText(`${SITE}/src/cn.ts`)));
    expect(result.missingPackages).toEqual([]);
  });

  it("ignores the `example` pointer of an entry: only its files are written", () => {
    const fs = new MemoryFileSystem();
    const template = fakeTemplate();
    const withExample = {
      ...template,
      registry: () => ({
        components: {
          cn: {
            description: "helper",
            files: ["src/cn.ts"],
            requires: [],
            example: "src/examples/cn",
          },
        },
      }),
    };
    const result = addComponent(
      { fs, template: withExample, hash: sha },
      { siteAbs: SITE, name: "cn" },
    );
    expect(result.written).toEqual(["src/cn.ts"]);
    expect([...fs.files.keys()].some((path) => path.includes("examples"))).toBe(false);
  });

  it("keeps a file you edited", () => {
    const fs = new MemoryFileSystem({ [`${SITE}/src/cn.ts`]: "// my version" });
    const result = addComponent(deps(fs), { siteAbs: SITE, name: "cn" });
    expect(result.kept).toEqual(["src/cn.ts"]);
    expect(fs.readText(`${SITE}/src/cn.ts`)).toBe("// my version");
  });

  it("refreshes a file that is still the version it last wrote", () => {
    const fs = new MemoryFileSystem({ [`${SITE}/src/cn.ts`]: "old template text" });
    fs.writeText(
      `${SITE}/.sitekit.json`,
      JSON.stringify({ sitekit: "0.0.1", files: { "src/cn.ts": sha("old template text") } }),
    );
    const result = addComponent(deps(fs), { siteAbs: SITE, name: "cn" });
    expect(result.written).toEqual(["src/cn.ts"]);
    expect(fs.readText(`${SITE}/src/cn.ts`)).toContain("twMerge");
  });

  it("overwrites an edited file with force", () => {
    const fs = new MemoryFileSystem({ [`${SITE}/src/cn.ts`]: "// my version" });
    addComponent(deps(fs), { siteAbs: SITE, name: "cn", force: true });
    expect(fs.readText(`${SITE}/src/cn.ts`)).toContain("twMerge");
  });

  it("reports packages the files import that the site does not list", () => {
    const fs = new MemoryFileSystem({
      [`${SITE}/package.json`]: JSON.stringify({ dependencies: { clsx: "1" } }),
    });
    const result = addComponent(deps(fs), { siteAbs: SITE, name: "button" });
    expect(result.missingPackages).toEqual(["radix-ui", "tailwind-merge"]);
  });
});
