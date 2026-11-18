import { joinPath } from "./paths";
import type { FileSystem } from "./ports";

const HEADER_FILES = [
  "src/presentation/components/site/site-header.astro",
  "src/presentation/components/site/mobile-menu.astro",
  "src/presentation/components/site/navigation-fit.ts",
];

/** Whether adopting this kit would change the managed current-generation navigation group. */
export function headerFilesNeedRefresh(
  files: ReadonlyMap<string, string>,
  locked: Readonly<Record<string, string>>,
  hash: (content: string) => string,
): boolean {
  return (
    HEADER_FILES.every((path) => files.has(path)) &&
    HEADER_FILES.some((path) => locked[path] !== hash(files.get(path)!))
  );
}

/** Reject customized legacy navigation before mixing its React menu and older props with the native-dialog template. */
export function assertLegacyHeaderCompatible(
  fs: FileSystem,
  siteAbs: string,
  files: ReadonlyMap<string, string>,
  locked: Readonly<Record<string, string>>,
  hash: (content: string) => string,
): void {
  if (!HEADER_FILES.every((path) => files.has(path))) return;
  if (HEADER_FILES.slice(0, 2).every((path) => locked[path] !== undefined)) return;
  const legacy = ["SiteHeader.astro", "MobileMenu.astro", "MobileMenu.tsx", "mobile-menu.tsx"]
    .map((name) => `src/presentation/components/site/${name}`)
    .filter((path) => locked[path] !== undefined || fs.exists(joinPath(siteAbs, path)));
  const unsafe = legacy.filter((path) => {
    const target = joinPath(siteAbs, path);
    return (
      !fs.exists(target) || fs.isDirectory(target) || hash(fs.readText(target)) !== locked[path]
    );
  });
  if (unsafe.length) {
    throw new Error(
      `Customized or deleted legacy navigation requires manual migration before upgrading or restoring the header: ${unsafe.join(", ")}. The legacy component names, props and React menu differ from the native-dialog template. No files were written.`,
    );
  }
}

/** Header files to preserve together when a customized or deleted prerequisite prevents a compatible refresh. */
export function blockedHeaderFiles(
  fs: FileSystem,
  siteAbs: string,
  files: ReadonlyMap<string, string>,
  locked: Readonly<Record<string, string>>,
  hash: (content: string) => string,
): ReadonlySet<string> {
  if (!headerFilesNeedRefresh(files, locked, hash)) return new Set();
  const blocked = HEADER_FILES.some((path) => {
    const target = joinPath(siteAbs, path);
    if (!fs.exists(target)) return locked[path] !== undefined;
    if (fs.isDirectory(target)) return true;
    const current = hash(fs.readText(target));
    return current !== hash(files.get(path)!) && current !== locked[path];
  });
  return new Set(blocked ? HEADER_FILES : []);
}
