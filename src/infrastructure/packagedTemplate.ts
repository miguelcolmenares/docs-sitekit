import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ComponentRegistry, TemplateFile, TemplateSource } from "../application";

/** Folders and files of the template that are never copied into a site. */
const NEVER_COPIED = new Set([
  "node_modules",
  "dist",
  ".astro",
  "_github",
  "sitekit.config.json",
  ".sitekit.json",
  "registry.json",
]);

/**
 * Paths of the template, from its root, that belong to the documentation of this project and not to a site:
 * the examples of each component and the layout that shows them. `package.json` leaves them out of the package too.
 */
export const KIT_ONLY_PATHS = ["src/examples", "src/presentation/layouts/collections"] as const;

function collect(directory: string, prefix = ""): TemplateFile[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (NEVER_COPIED.has(entry.name) && prefix === "") return [];
    if (entry.name === ".DS_Store") return [];
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if ((KIT_ONLY_PATHS as readonly string[]).includes(relative)) return [];
    return entry.isDirectory()
      ? collect(join(directory, entry.name), relative)
      : [{ path: relative, content: readFileSync(join(directory, entry.name), "utf8") }];
  });
}

/** The template shipped inside this package. `templateRoot` is the `template/` folder. */
export function packagedTemplate(templateRoot: string): TemplateSource {
  return {
    files: () => collect(templateRoot),
    workflow: () => readFileSync(join(templateRoot, "_github", "workflows", "docs.yml"), "utf8"),
    registry: () =>
      JSON.parse(readFileSync(join(templateRoot, "registry.json"), "utf8")) as ComponentRegistry,
    version: () =>
      (
        JSON.parse(readFileSync(join(templateRoot, "..", "package.json"), "utf8")) as {
          version: string;
        }
      ).version,
  };
}

/** Hex SHA-256 of a text. */
export const sha256 = (content: string) => createHash("sha256").update(content).digest("hex");
