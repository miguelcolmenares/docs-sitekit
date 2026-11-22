import { joinPath } from "./paths";
import type { FileSystem } from "./ports";

/**
 * Check managed destinations before a command writes. Physical adapters can provide non-following
 * entry inspection; legacy abstract adapters retain their existing file/directory semantics.
 * Planning may inspect directory placeholders; the final write preflight never permits them.
 */
export function assertManagedPaths(
  fs: FileSystem,
  siteAbs: string,
  paths: readonly string[],
  options: { allowDirectoryLeaves?: boolean } = {},
): void {
  const kind = (path: string) =>
    fs.pathKind?.(path) ??
    (!fs.exists(path) ? "missing" : fs.isDirectory(path) ? "directory" : "file");
  const unsafe = (relative: string, entry: string, expected: string): never => {
    throw new Error(
      `Unsafe managed path "${relative}": "${entry}" must be ${expected}. Symlinks and other nonordinary entries require manual migration. No files were written.`,
    );
  };
  for (const relative of new Set(paths)) {
    if (
      !relative ||
      relative.startsWith("/") ||
      relative.includes("\\") ||
      /^[a-z]:/i.test(relative) ||
      relative.split("/").some((part) => part === "" || part === "." || part === "..")
    ) {
      unsafe(relative, relative, "a relative path inside the site");
    }
    const rootKind = kind(siteAbs);
    if (rootKind !== "missing" && rootKind !== "directory")
      unsafe(relative, ".", "an ordinary directory");
    const parts = relative.split("/");
    for (let index = 0; index < parts.length; index += 1) {
      const entry = parts.slice(0, index + 1).join("/");
      const entryKind = kind(joinPath(siteAbs, entry));
      const expected = index === parts.length - 1 ? "file" : "directory";
      if (options.allowDirectoryLeaves && index === parts.length - 1 && entryKind === "directory")
        continue;
      if (entryKind !== "missing" && entryKind !== expected)
        unsafe(relative, entry, `an ordinary ${expected}`);
    }
  }
}
