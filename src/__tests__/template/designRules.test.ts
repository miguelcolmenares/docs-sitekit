import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(__dirname, "..", "..", "..", "template", "src");

function files(dir: string, extensions: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory()
      ? files(full, extensions)
      : extensions.test(entry.name)
        ? [full]
        : [];
  });
}

const read = (file: string) => readFileSync(file, "utf8");
const name = (file: string) => relative(SRC, file);

const siteFiles = [
  ...files(join(SRC, "presentation", "components", "site"), /\.(tsx|astro)$/),
  ...files(join(SRC, "presentation", "layouts"), /\.astro$/),
  ...files(join(SRC, "pages"), /\.astro$/),
];

describe("design rules, enforced", () => {
  it("site components, layouts and pages use no shadows, only 1px borders", () => {
    const offenders = siteFiles.filter((file) => /\bshadow(-[a-z0-9[]+)?\b/.test(read(file)));
    expect(offenders.map(name)).toEqual([]);
  });

  it("no text uses the decorative fg-faint token", () => {
    const offenders = files(SRC, /\.(tsx|astro|css)$/).filter((file) =>
      /text-fg-faint/.test(read(file)),
    );
    expect(offenders.map(name)).toEqual([]);
  });

  it("accent-strong is never a text color: it fills, rings and borders only (4.41:1 on the page)", () => {
    const strongAsText =
      /\btext-(brand-strong|ring)\b|\btext-\(--sk-accent-strong\)|\btext-\[var\(--sk-accent-strong\)\]|\bcolor\s*:\s*var\(--sk-accent-strong\)/;
    const offenders = files(SRC, /\.(tsx|astro|css)$/).filter((file) =>
      strongAsText.test(read(file)),
    );
    expect(offenders.map(name)).toEqual([]);
  });

  it("status colors are chosen only in ToneBadge and Callout", () => {
    const allowed = new Set(["ToneBadge.tsx", "Callout.tsx"]);
    const offenders = siteFiles.filter(
      (file) =>
        !allowed.has(file.split("/").pop()!) &&
        /\b(text|bg|border)-(success|warn|danger|destructive)\b/.test(read(file)),
    );
    expect(offenders.map(name)).toEqual([]);
  });

  it("components take data through props: none imports the site loader or the content", () => {
    const components = siteFiles.filter((file) => file.includes("/components/"));
    const offenders = components.filter((file) =>
      /loadSite|readSources|@\/infrastructure\/(?!cn\b)|\.\.\/infrastructure/.test(read(file)),
    );
    expect(offenders.map(name)).toEqual([]);
  });

  it("grids have explicit tracks: no auto-fit or auto-fill in site components", () => {
    const offenders = siteFiles.filter((file) =>
      /grid-cols-\[[^\]]*auto-(fit|fill)|repeat\(\s*auto-(fit|fill)/.test(read(file)),
    );
    expect(offenders.map(name)).toEqual([]);
  });

  it("the stat row is a description list, and it chooses no status color", () => {
    const source = read(join(SRC, "presentation", "components", "site", "StatRow.tsx"));
    expect(source).toMatch(/<dl\b/);
    expect(source).not.toMatch(/\b(text|bg|border)-(success|warn|danger|destructive)\b/);
  });

  it("interactive controls are sized for touch: no h-6 or smaller buttons in site components", () => {
    const offenders = siteFiles.filter((file) =>
      /<button[^>]*className="[^"]*\b(size|h)-(4|5|6)\b/.test(read(file)),
    );
    expect(offenders.map(name)).toEqual([]);
  });

  it("every `.astro` or `.tsx` file in components is listed in the registry, so `add` can restore it", () => {
    const registry = JSON.parse(read(join(SRC, "..", "registry.json"))) as {
      components: Record<string, { files: string[] }>;
    };
    const listed = new Set(
      Object.values(registry.components).flatMap((component) => component.files),
    );
    const shipped = files(join(SRC, "presentation", "components"), /\.(tsx|astro)$/).map(
      (file) => `src/${relative(SRC, file)}`,
    );
    expect(shipped.filter((file) => !listed.has(file))).toEqual([]);
    // A component may list the files it needs outside the components folder, such as `cn` or a script.
    // Those are not components, but they must exist, so `add` never copies a file the template lacks.
    expect(
      [...listed].filter(
        (file) =>
          !shipped.includes(file) && !(file.endsWith("cn.ts") || existsSync(join(SRC, "..", file))),
      ),
    ).toEqual([]);
  });

  it("the catalog filter is hidden without JavaScript, announces politely and sizes every control for touch", () => {
    const source = read(join(SRC, "presentation", "components", "site", "CatalogFilter.astro"));
    expect(source).toMatch(/<div data-catalog-filter hidden/);
    expect(source).toMatch(/role="status"/);
    expect(source).toMatch(/aria-live="polite"/);
    expect(source).toMatch(/aria-pressed="false"/);
    expect(source).toMatch(/<label for="catalog-filter-text"/);
    // Every control has a 44px floor: the shared class of the buttons, and the height of the field.
    expect(source).toMatch(/min-h-11 min-w-11/);
    expect(source).toMatch(/<input[^>]*[\s\S]*?class="[^"]*\bh-11\b/);
    expect(source).not.toMatch(/\b(text|bg|border)-(success|warn|danger|destructive)\b/);
  });

  it("the filter script hides cards with the hidden attribute and keeps its state in the address", () => {
    const script = read(join(SRC, "presentation", "filter", "catalogFilter.ts"));
    expect(script).toMatch(/\.hidden = /);
    expect(script).toMatch(/history\.pushState/);
    expect(script).toMatch(/history\.replaceState/);
    expect(script).toMatch(/popstate/);
  });

  it("every npm package a registry file imports is declared in the template package.json", () => {
    const manifest = JSON.parse(read(join(SRC, "..", "package.json"))) as {
      dependencies: Record<string, string>;
    };
    const declared = new Set(Object.keys(manifest.dependencies));
    const registry = JSON.parse(read(join(SRC, "..", "registry.json"))) as {
      components: Record<string, { files: string[] }>;
    };
    const missing: string[] = [];
    for (const file of new Set(
      Object.values(registry.components).flatMap((component) => component.files),
    )) {
      for (const match of read(join(SRC, "..", file)).matchAll(
        /from\s+["']([^"'.@][^"']*|@[^/"']+\/[^"']+)["']/g,
      )) {
        const specifier = match[1]!;
        const pkg = specifier.startsWith("@")
          ? specifier.split("/").slice(0, 2).join("/")
          : specifier.split("/")[0]!;
        if (!declared.has(pkg) && !["react", "astro"].includes(pkg))
          missing.push(`${file}: ${pkg}`);
      }
    }
    expect(missing).toEqual([]);
  });
  it("brand logos come from the module in the repository: no package, no CDN and no host in any source", () => {
    const manifest = read(join(SRC, "..", "package.json"));
    expect(manifest).not.toMatch(/simple-icons|simpleicons|iconify|devicon|svgl/i);
    const sources = files(SRC, /\.(tsx?|astro|css)$/).filter(
      (file) => !file.endsWith("brandData.ts"),
    );
    const offenders = sources.filter((file) =>
      /from\s+["']simple-icons|cdn\.simpleicons|simpleicons\.org\/icons|cdn\.jsdelivr|unpkg\.com|cdnjs|api\.iconify|raw\.githubusercontent/i.test(
        read(file),
      ),
    );
    expect(offenders.map(name)).toEqual([]);
  });

  it("the repository button and the footer link are 44px targets on a phone", () => {
    const header = read(join(SRC, "presentation", "components", "site", "SiteHeader.astro"));
    const menu = read(join(SRC, "presentation", "components", "site", "MobileMenu.tsx"));
    const footer = read(join(SRC, "presentation", "components", "site", "SiteFooter.tsx"));
    for (const [source, anchor] of [
      [header, "data-repository-button"],
      [menu, "data-repository-button"],
    ] as const) {
      const tag = source.slice(source.indexOf(anchor), source.indexOf(anchor) + 400);
      expect(tag).toMatch(/\bmin-h-11\b/);
    }
    expect(footer).toMatch(/min-h-11[^"]*md:min-h-8/);
  });
});
