import {
  existsSync,
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
  readText: (path) => readFileSync(path, "utf8"),
  writeText(path, content) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  },
  remove: (path) => rmSync(path, { force: true }),
  listFiles: (directory) => (existsSync(directory) ? walk(directory) : []),
};
