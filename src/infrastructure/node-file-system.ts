import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { FileSystem } from "../application";

function walk(directory: string, prefix = ""): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? walk(join(directory, entry.name), relative) : [relative];
  });
}

/** The `FileSystem` backed by `node:fs`. Writing creates any folder that is missing. */
export const nodeFileSystem: FileSystem = {
  exists: (path) => existsSync(path),
  isDirectory: (path) => existsSync(path) && statSync(path).isDirectory(),
  pathKind(path) {
    try {
      const entry = lstatSync(path);
      if (entry.isDirectory()) return "directory";
      // A shared inode must not be overwritten through a managed destination either.
      if (entry.isFile() && entry.nlink === 1) return "file";
      return "other";
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
      throw error;
    }
  },
  readText: (path) => readFileSync(path, "utf8"),
  writeText(path, content) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  },
  remove: (path) => rmSync(path, { force: true }),
  listFiles: (directory) => (existsSync(directory) ? walk(directory) : []),
};
