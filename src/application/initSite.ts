import { extractDescription, parseSiteConfig } from "../../template/src/domain";
import type { SiteConfig } from "../../template/src/domain";
import { deriveConfig } from "../domain";
import type { RepositoryFacts } from "../domain";
import { baseName, joinPath } from "./paths";
import { identityFor, renderTemplateFile } from "./templateFile";
import type { Environment, FileSystem, TemplateSource } from "./ports";

/** What `initSite` needs from outside: files, the host, the packaged template and a content hash. */
export interface InitDeps {
  fs: FileSystem;
  env: Environment;
  template: TemplateSource;
  /** Content hash, so later runs can tell whether a file was edited. */
  hash: (content: string) => string;
}

/** What to create and where: the repository, the site folder, optional overrides and the safety switches. */
export interface InitOptions {
  /** Absolute path of the repository to document. */
  root: string;
  /** Folder for the site, relative to the root. */
  siteDir: string;
  overrides?: { name?: string; description?: string };
  force?: boolean;
  dryRun?: boolean;
}

/** The config that was derived and the files written or kept. */
export interface InitResult {
  config: SiteConfig;
  /** Paths relative to the root. In a dry run these are the files that would be written. */
  written: string[];
  skipped: string[];
}

/** The lock a site keeps, so a later command can tell which files you changed. */
export interface SiteLock {
  sitekit: string;
  files: Record<string, string>;
}

/** Name of the file in a site that records the hash of every file the kit wrote. */
export const LOCK_FILE = ".sitekit.json";
const SITE_GITIGNORE = "node_modules/\ndist/\n.astro/\n";
const WORKFLOW_PATH = ".github/workflows/docs.yml";

function readJson(fs: FileSystem, path: string): Record<string, unknown> | undefined {
  if (!fs.exists(path)) return undefined;
  try {
    return JSON.parse(fs.readText(path)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** The sets of pages a repository usually has, with the folders to look in. The first folder that exists wins. */
const COLLECTION_CANDIDATES = [
  { id: "docs", label: "Docs", dirs: ["docs"] },
  { id: "tutorials", label: "Tutorials", dirs: ["docs/tutorials", "tutorials"] },
  { id: "examples", label: "Examples", dirs: ["docs/examples", "examples"] },
];

function findCollections(fs: FileSystem, root: string): RepositoryFacts["collections"] {
  return COLLECTION_CANDIDATES.flatMap((candidate) => {
    const dir = candidate.dirs.find((path) => fs.isDirectory(joinPath(root, path)));
    return dir ? [{ id: candidate.id, label: candidate.label, dir }] : [];
  });
}

function collectFacts(deps: InitDeps, root: string): RepositoryFacts {
  const { fs, env } = deps;
  const readme = fs.exists(joinPath(root, "README.md"))
    ? extractDescription(fs.readText(joinPath(root, "README.md")))
    : "";
  return {
    packageJson: readJson(fs, joinPath(root, "package.json")) as RepositoryFacts["packageJson"],
    remoteUrl: env.remoteUrl(root),
    defaultBranch: env.defaultBranch(root),
    readmeDescription: readme || undefined,
    collections: findCollections(fs, root),
    hasChangelog: fs.exists(joinPath(root, "CHANGELOG.md")),
    folderName: baseName(root),
  };
}

/**
 * Create a documentation site inside a repository. It writes into `siteDir` and never guesses
 * another place, and it refuses a folder that already has files unless `force` is set.
 */
export function initSite(deps: InitDeps, options: InitOptions): InitResult {
  const { fs, template, hash } = deps;
  const siteAbs = joinPath(options.root, options.siteDir);

  if (
    fs.exists(siteAbs) &&
    fs.isDirectory(siteAbs) &&
    fs.listFiles(siteAbs).length > 0 &&
    !options.force
  ) {
    throw new Error(
      `${options.siteDir}/ already has files. Pick another folder with --dir, or pass --force to overwrite.`,
    );
  }

  const derived = deriveConfig(collectFacts(deps, options.root));
  // The command line passes undefined for an option that was not given. It must not erase what was derived.
  const name = options.overrides?.name || undefined;
  const description = options.overrides?.description || undefined;
  const config = parseSiteConfig({
    ...derived,
    site: { ...derived.site, ...(name ? { name } : {}), ...(description ? { description } : {}) },
    hero: {
      ...derived.hero,
      ...(name ? { title: name } : {}),
      ...(description ? { lede: description } : {}),
    },
  });

  const identity = identityFor(config.site.name);
  const written: string[] = [];
  const skipped: string[] = [];
  const lock: SiteLock = { sitekit: template.version(), files: {} };
  const write = (relative: string, content: string, base: string, track: boolean) => {
    const target = joinPath(base, relative);
    const display = target.slice(options.root.length).replace(/^\//, "");
    if (fs.exists(target) && !options.force) {
      skipped.push(display);
      return;
    }
    if (!options.dryRun) fs.writeText(target, content);
    written.push(display);
    if (track) lock.files[relative] = hash(content);
  };

  for (const file of template.files()) {
    const content = renderTemplateFile(file, identity);
    write(file.path, content, siteAbs, true);
  }

  write("sitekit.config.json", `${JSON.stringify(config, null, 2)}\n`, siteAbs, false);
  write(".gitignore", SITE_GITIGNORE, siteAbs, false);
  write(LOCK_FILE, `${JSON.stringify(lock, null, 2)}\n`, siteAbs, false);
  write(
    WORKFLOW_PATH,
    template.workflow().replaceAll("__SITEKIT_VERSION__", template.version()),
    options.root,
    false,
  );

  return { config, written, skipped };
}
