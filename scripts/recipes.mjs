// The recipes of "Extending your site": fixtures that are applied to a site made by `sitekit init`.
//
// A recipe is a folder, e2e/recipes/<name>/, that has the layout of the repository the site is in:
//
//   e2e/recipes/<name>/site/src/pages/tool.astro   is copied to <repository>/site/src/pages/tool.astro
//   e2e/recipes/<name>/notes/welcome.md            is copied to <repository>/notes/welcome.md
//
// Two kinds of file are not copied as they are:
//
//   site/sitekit.config.json  is merged into the config of the site: objects are merged key by key, and the items of
//                             an array are added after the ones that are there. It holds only the keys the recipe adds.
//   <anything>.diff           is applied with `git apply`, from the root of the repository. A recipe that changes a file
//                             of the kit ships the change, not a copy of the file, so it fails when the file moves on.
//
// verify-package.mjs applies the recipes to a throwaway site and builds it, and the Playwright specs drive the result.
// The pages of docs/ show these same files (scripts/build-recipe-docs.mjs), so a page cannot say what the test did not run.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** The folder that holds the recipes. */
export const RECIPES_DIR = resolve(import.meta.dirname, "..", "e2e", "recipes");

/** The path, from the recipe, of the file that is merged into the config of the site. */
export const CONFIG_PATH = "site/sitekit.config.json";

/** Every file under a folder, as paths relative to it, in a stable order. */
function listFiles(folder, prefix = "") {
  return readdirSync(join(folder, prefix), { withFileTypes: true })
    .flatMap((entry) => {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory() ? listFiles(folder, path) : [path];
    })
    .filter((path) => !path.endsWith(".DS_Store"))
    .sort();
}

/** The names of the recipes, sorted. */
export function recipeNames() {
  return readdirSync(RECIPES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** What kind of file a path of a recipe is: `config` (merged), `diff` (applied) or `file` (copied). */
export function kindOf(path) {
  if (path === CONFIG_PATH) return "config";
  return path.endsWith(".diff") ? "diff" : "file";
}

/** The files of a recipe: the path in the repository, the kind and the absolute path of the fixture. */
export function recipeFiles(name) {
  const folder = join(RECIPES_DIR, name);
  if (!existsSync(folder)) {
    throw new Error(`There is no recipe "${name}". The recipes are: ${recipeNames().join(", ")}.`);
  }
  return listFiles(folder).map((path) => ({
    path,
    kind: kindOf(path),
    source: join(folder, path),
  }));
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Merge `patch` into `base` without changing either: objects key by key, arrays one after the other, anything else replaced. */
export function mergeConfig(base, patch) {
  if (Array.isArray(base) && Array.isArray(patch)) return [...base, ...patch];
  if (isObject(base) && isObject(patch)) {
    const merged = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      merged[key] = key in base ? mergeConfig(base[key], value) : value;
    }
    return merged;
  }
  return patch;
}

/**
 * Apply a recipe to a repository that has a site made by `init`. Returns the paths it wrote, relative to the repository.
 * A diff that does not apply throws with what `git apply` said.
 */
export function applyRecipe(name, repository) {
  const written = [];
  for (const { path, kind, source } of recipeFiles(name)) {
    if (kind === "diff") {
      try {
        execFileSync("git", ["apply", "--whitespace=nowarn", source], {
          cwd: repository,
          stdio: "pipe",
        });
      } catch (error) {
        throw new Error(
          `Recipe "${name}": ${path} does not apply to the site. ${String(error.stderr ?? error.message).trim()}`,
          { cause: error },
        );
      }
      written.push(path.replace(/\.diff$/, ""));
      continue;
    }
    const target = join(repository, path);
    mkdirSync(dirname(target), { recursive: true });
    if (kind === "config") {
      const current = JSON.parse(readFileSync(target, "utf8"));
      const patch = JSON.parse(readFileSync(source, "utf8"));
      writeFileSync(target, `${JSON.stringify(mergeConfig(current, patch), null, 2)}\n`);
    } else {
      writeFileSync(target, readFileSync(source));
    }
    written.push(path);
  }
  return written;
}
