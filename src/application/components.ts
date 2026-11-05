import { joinPath } from "./paths";
import { LOCK_FILE } from "./init-site";
import type { SiteLock } from "./init-site";
import type { ComponentRegistry, FileSystem, TemplateSource } from "./ports";

/** A component's name and what it is for, as `sitekit list` shows it. */
export interface ComponentSummary {
  name: string;
  description: string;
}

/** List the components of a registry, sorted by name. */
export function listComponents(registry: ComponentRegistry): ComponentSummary[] {
  return Object.entries(registry.components)
    .map(([name, entry]) => ({ name, description: entry.description }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A component and everything it requires, dependencies first. */
export function resolveComponents(registry: ComponentRegistry, name: string): string[] {
  const order: string[] = [];
  const visit = (current: string, trail: string[]) => {
    const entry = registry.components[current];
    if (!entry) {
      throw new Error(
        `Unknown component "${current}"${trail.length ? ` (required by ${trail[trail.length - 1]})` : ""}. Run \`sitekit list\` to see the names.`,
      );
    }
    if (trail.includes(current))
      throw new Error(`Circular requirement: ${[...trail, current].join(" -> ")}`);
    for (const required of entry.requires) visit(required, [...trail, current]);
    if (!order.includes(current)) order.push(current);
  };
  visit(name, []);
  return order;
}

/** Names of the npm packages a source file imports. Relative and `@/` imports are not packages. */
export function npmImports(source: string): string[] {
  const names = new Set<string>();
  for (const match of source.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) {
    const specifier = match[1]!;
    if (specifier.startsWith(".") || specifier.startsWith("@/") || specifier.startsWith("node:"))
      continue;
    const parts = specifier.split("/");
    names.add(specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!);
  }
  return [...names].sort();
}

/** What `addComponent` needs: files, the packaged template and a content hash. */
export interface AddDeps {
  fs: FileSystem;
  template: TemplateSource;
  hash: (content: string) => string;
}

/** What `addComponent` did: files written, files kept because you changed them, and packages still to install. */
export interface AddResult {
  written: string[];
  /** Files left alone because the site has its own version. */
  kept: string[];
  /** Packages the files import that the site does not list. */
  missingPackages: string[];
}

/** Copy a component and its requirements into a site. A file you edited is kept unless `force`. */
export function addComponent(
  deps: AddDeps,
  options: { siteAbs: string; name: string; force?: boolean },
): AddResult {
  const { fs, template, hash } = deps;
  const registry = template.registry();
  const names = resolveComponents(registry, options.name);
  const templateFiles = new Map(template.files().map((file) => [file.path, file.content]));
  const lockPath = joinPath(options.siteAbs, LOCK_FILE);
  const lock: SiteLock = fs.exists(lockPath)
    ? (JSON.parse(fs.readText(lockPath)) as SiteLock)
    : { sitekit: template.version(), files: {} };

  const result: AddResult = { written: [], kept: [], missingPackages: [] };
  const imported = new Set<string>();

  for (const name of names) {
    for (const path of registry.components[name]!.files) {
      const content = templateFiles.get(path);
      if (content === undefined)
        throw new Error(`The component "${name}" lists ${path}, which is not in the template.`);
      npmImports(content).forEach((pkg) => imported.add(pkg));

      const target = joinPath(options.siteAbs, path);
      if (fs.exists(target) && !options.force) {
        const current = fs.readText(target);
        // Identical already, or the same as the version we last wrote: safe to refresh. Otherwise it is yours.
        if (current === content) continue;
        if (lock.files[path] === undefined || hash(current) !== lock.files[path]) {
          result.kept.push(path);
          continue;
        }
      }
      fs.writeText(target, content);
      lock.files[path] = hash(content);
      result.written.push(path);
    }
  }

  fs.writeText(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

  const packagePath = joinPath(options.siteAbs, "package.json");
  if (fs.exists(packagePath)) {
    const pkg = JSON.parse(fs.readText(packagePath)) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const have = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]);
    result.missingPackages = [...imported].filter((name) => !have.has(name)).sort();
  }
  return result;
}
