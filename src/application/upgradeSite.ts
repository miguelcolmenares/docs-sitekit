import { LOCK_FILE } from "./initSite";
import type { SiteLock } from "./initSite";
import { joinPath } from "./paths";
import type { Environment, FileSystem, TemplateSource } from "./ports";
import { identityFor, renderTemplateFile } from "./templateFile";
import type { SiteIdentity } from "./templateFile";

/** What `upgradeSite` needs from outside: files, the git working tree, the packaged template and a content hash. */
export interface UpgradeDeps {
  fs: FileSystem;
  env: Environment;
  template: TemplateSource;
  /** Content hash. It must be the one `init` used, because the lock holds those hashes. */
  hash: (content: string) => string;
}

/** Which site to upgrade and whether to write. */
export interface UpgradeOptions {
  /** Absolute path of the repository. */
  root: string;
  /** Folder of the site, relative to the root. */
  siteDir: string;
  /** Print the report and write nothing. */
  dryRun?: boolean;
  /** Write even though the working tree has uncommitted changes. */
  apply?: boolean;
}

/** Why an upgrade did not write: it was asked not to, or the working tree has uncommitted changes. */
export type DryRunReason = "requested" | "uncommitted-changes";

/** One option of `sitekit.config.json` that the kit added, with the value that keeps the site as it was. */
export interface AddedOption {
  key: string;
  value: unknown;
}

/** What an upgrade did, or in a dry run what it would do. Paths are relative to the repository root. */
export interface UpgradeResult {
  /** The version in the site's lock, which is the kit that last wrote its files. */
  from: string;
  /** The version of the kit that ran the upgrade. */
  to: string;
  /** True when nothing was written. */
  dryRun: boolean;
  dryRunReason?: DryRunReason;
  /** You did not edit them and the kit changed them: replaced by the new version. */
  replaced: string[];
  /** You edited them and the kit did not change them: left as they are. */
  kept: string[];
  /** You edited them and the kit changed them: left as they are, with the new version in `<file>.sitekit-new`. */
  conflicts: string[];
  /** New in the kit and not in your site: written. */
  added: string[];
  /** Already identical to the new version, or the same in both versions. */
  unchanged: string[];
  /** In the lock and deleted by you: not brought back. */
  deleted: string[];
  /** In the lock and no longer in the kit: left in place, the kit does not manage them any more. */
  retired: string[];
  /** Options added to `sitekit.config.json` with the value that keeps the site as it was. */
  options: AddedOption[];
  /** The deploy workflow, when it still pins the old version. The upgrade never edits it. */
  workflowPinned?: string;
}

/** Suffix of the copy of the kit's version that is written next to a file you and the kit both changed. */
export const NEW_VERSION_SUFFIX = ".sitekit-new";

const WORKFLOW_PATH = ".github/workflows/docs.yml";
const CONFIG_FILE = "sitekit.config.json";

/**
 * An option the kit added after 0.1.0, with the value that leaves a site as it was. `introducedBy`
 * is a file that only exists in a site that already has the feature: when it is in the lock, the
 * site has the feature and the key is not written.
 */
const NEW_OPTIONS: Array<{ key: string; value: unknown; introducedBy?: string }> = [
  { key: "theme", value: { default: "dark" } },
  {
    key: "search",
    value: { enabled: false },
    introducedBy: "src/presentation/search/SearchDialog.astro",
  },
  {
    key: "llms",
    value: { enabled: false, optional: [], markdownPages: false },
    introducedBy: "src/application/buildLlmsText.ts",
  },
];

function readJson(fs: FileSystem, path: string): Record<string, unknown> | undefined {
  if (!fs.exists(path) || fs.isDirectory(path)) return undefined;
  try {
    const value = JSON.parse(fs.readText(path)) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function readLock(fs: FileSystem, path: string, siteDir: string): SiteLock {
  if (!fs.exists(path)) {
    throw new Error(
      `${siteDir}/${LOCK_FILE} not found. Only a site made by \`sitekit init\` can be upgraded. Pass --dir if the site is in another folder.`,
    );
  }
  const lock = readJson(fs, path);
  const files = lock?.files;
  if (
    typeof lock?.sitekit !== "string" ||
    !files ||
    typeof files !== "object" ||
    Array.isArray(files) ||
    Object.values(files).some((hash) => typeof hash !== "string")
  ) {
    throw new Error(`${siteDir}/${LOCK_FILE} is not a lock file written by sitekit.`);
  }
  return { sitekit: lock.sitekit, files: { ...(files as Record<string, string>) } };
}

/**
 * The name and description of the site's own `package.json`. The new manifests are rendered with
 * them, so a name that was derived when the site was made is not a change made by the kit.
 */
function siteIdentity(fs: FileSystem, siteAbs: string): SiteIdentity {
  const pkg = readJson(fs, joinPath(siteAbs, "package.json"));
  const config = readJson(fs, joinPath(siteAbs, CONFIG_FILE));
  const siteName = (config?.site as { name?: unknown } | undefined)?.name;
  const fallback = identityFor(typeof siteName === "string" ? siteName : "site");
  return {
    name: typeof pkg?.name === "string" ? pkg.name : fallback.name,
    description: typeof pkg?.description === "string" ? pkg.description : fallback.description,
  };
}

/**
 * Bring a generated site up to the installed kit, using the hashes in its lock.
 *
 * For each file the lock lists, the site's file, the version the lock was written from (by hash)
 * and the kit's file give four cases: not edited and changed in the kit is replaced, edited and
 * unchanged in the kit is kept, edited and changed in both is left as it is with the new version
 * next to it as `<file>.sitekit-new`, and a file new in the kit is added. Only files in the lock
 * and files the kit now ships are ever written, so `content` and the rest of the repository are
 * never touched. The one exception is `sitekit.config.json`, which gets the options that did not
 * exist yet, with the value that keeps the site as it was.
 *
 * Nothing is written for a dry run, or while the working tree has uncommitted changes unless
 * `apply` is set: the owner can then see what would happen, and commit first.
 */
export function upgradeSite(deps: UpgradeDeps, options: UpgradeOptions): UpgradeResult {
  const { fs, env, template, hash } = deps;
  const siteAbs = joinPath(options.root, options.siteDir);
  const lockPath = joinPath(siteAbs, LOCK_FILE);
  const lock = readLock(fs, lockPath, options.siteDir);
  const oldLock: Record<string, string> = { ...lock.files };

  let dryRun = options.dryRun === true;
  let dryRunReason: DryRunReason | undefined = dryRun ? "requested" : undefined;
  if (!dryRun && !options.apply && env.hasUncommittedChanges(options.root) === true) {
    dryRun = true;
    dryRunReason = "uncommitted-changes";
  }

  const display = (relative: string) => joinPath(options.siteDir, relative);
  const result: UpgradeResult = {
    from: lock.sitekit,
    to: template.version(),
    dryRun,
    ...(dryRunReason ? { dryRunReason } : {}),
    replaced: [],
    kept: [],
    conflicts: [],
    added: [],
    unchanged: [],
    deleted: [],
    retired: [],
    options: [],
  };

  const identity = siteIdentity(fs, siteAbs);
  const writes: Array<{ path: string; content: string }> = [];
  const shipped = new Set<string>();

  for (const file of [...template.files()].sort((a, b) => a.path.localeCompare(b.path))) {
    shipped.add(file.path);
    const content = renderTemplateFile(file, identity);
    const newHash = hash(content);
    const target = joinPath(siteAbs, file.path);
    const locked = lock.files[file.path];
    const present = fs.exists(target) && !fs.isDirectory(target);
    const shown = display(file.path);

    if (locked === undefined) {
      // The site has no record of this file. It is new in the kit, or the owner already has a file there.
      if (!present) {
        writes.push({ path: target, content });
        lock.files[file.path] = newHash;
        result.added.push(shown);
      } else if (hash(fs.readText(target)) === newHash) {
        lock.files[file.path] = newHash;
        result.unchanged.push(shown);
      } else {
        writes.push({ path: `${target}${NEW_VERSION_SUFFIX}`, content });
        result.conflicts.push(shown);
      }
      continue;
    }
    if (!present) {
      result.deleted.push(shown);
      continue;
    }
    const currentHash = hash(fs.readText(target));
    if (currentHash === newHash) {
      // Already the new version, because the owner copied it by hand. Record it.
      lock.files[file.path] = newHash;
      result.unchanged.push(shown);
    } else if (newHash === locked) {
      (currentHash === locked ? result.unchanged : result.kept).push(shown);
    } else if (currentHash === locked) {
      writes.push({ path: target, content });
      lock.files[file.path] = newHash;
      result.replaced.push(shown);
    } else {
      writes.push({ path: `${target}${NEW_VERSION_SUFFIX}`, content });
      result.conflicts.push(shown);
    }
  }

  for (const path of Object.keys(oldLock).sort()) {
    if (!shipped.has(path)) result.retired.push(display(path));
  }

  const config = readJson(fs, joinPath(siteAbs, CONFIG_FILE));
  if (config) {
    for (const option of NEW_OPTIONS) {
      if (option.key in config) continue;
      if (option.introducedBy && oldLock[option.introducedBy] !== undefined) continue;
      config[option.key] = option.value;
      result.options.push({ key: option.key, value: option.value });
    }
  }

  const workflow = joinPath(options.root, WORKFLOW_PATH);
  if (
    lock.sitekit !== result.to &&
    fs.exists(workflow) &&
    fs.readText(workflow).includes(lock.sitekit)
  ) {
    result.workflowPinned = WORKFLOW_PATH;
  }

  if (!dryRun) {
    for (const write of writes) fs.writeText(write.path, write.content);
    if (config && result.options.length > 0) {
      fs.writeText(joinPath(siteAbs, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`);
    }
    const lockChanged =
      lock.sitekit !== result.to || JSON.stringify(lock.files) !== JSON.stringify(oldLock);
    if (lockChanged) {
      fs.writeText(
        lockPath,
        `${JSON.stringify({ sitekit: result.to, files: lock.files } satisfies SiteLock, null, 2)}\n`,
      );
    }
  }
  return result;
}
