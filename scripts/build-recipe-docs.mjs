#!/usr/bin/env node
// Write the files of the recipes into the pages of "Extending your site", so a page shows the same files the tests ran.
//
// A page marks the place of a file with two comments:
//
//   <!-- recipe-file: tool-page site/src/pages/configurator.astro -->
//   <!-- /recipe-file -->
//
// This script fills what is between them with a code block that has the file as its title and the text of the fixture
// in e2e/recipes/<recipe>/<file>. A file that ends in `.diff` is shown as a diff, titled with the file it changes.
//
//   node scripts/build-recipe-docs.mjs            write the pages
//   node scripts/build-recipe-docs.mjs --check    fail when a page is out of date, and write nothing
//
// Option, mostly for tests: --docs, the folder of the pages.
//
// A marker that names a recipe or a file that does not exist fails the script and says which.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { recipeFiles } from "./recipes.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const DOCS = join(ROOT, "docs");

/** The language of the code block for a file, by its extension. */
const LANGUAGES = {
  astro: "astro",
  ts: "ts",
  json: "json",
  css: "css",
  md: "md",
  svg: "xml",
  mjs: "js",
  diff: "diff",
};

// Prettier would format the code inside the fence and the page would no longer equal the file, so the block is wrapped in
// the comments that make it skip the block. They are written here and may be left out of what an author writes.
const IGNORE = ["<!-- prettier-ignore-start -->", "<!-- prettier-ignore-end -->"];
const MARKER =
  /(?:<!-- prettier-ignore-start -->\n)?<!-- recipe-file: (\S+) (\S+) -->\n[\s\S]*?<!-- \/recipe-file -->(?:\n<!-- prettier-ignore-end -->)?/g;

/** The block that goes between the two comments: a fence longer than any run of backticks in the text. */
export function renderFile(recipe, path) {
  const file = recipeFiles(recipe).find((candidate) => candidate.path === path);
  if (!file) {
    throw new Error(
      `Recipe "${recipe}" has no file ${path}. It has: ${recipeFiles(recipe)
        .map((f) => f.path)
        .join(", ")}.`,
    );
  }
  const text = readFileSync(file.source, "utf8").replace(/\n$/, "");
  const extension = path.split(".").pop();
  const language = LANGUAGES[extension];
  if (!language) throw new Error(`No code language for the extension of ${path}.`);
  const fence = "`".repeat(
    Math.max(3, ...[...text.matchAll(/`+/g)].map((run) => run[0].length + 1)),
  );
  const title = file.kind === "diff" ? path.replace(/\.diff$/, "") : path;
  return [
    IGNORE[0],
    `<!-- recipe-file: ${recipe} ${path} -->`,
    `${fence}${language} title="${title}"`,
    text,
    fence,
    "<!-- /recipe-file -->",
    IGNORE[1],
  ].join("\n");
}

/** A page with every marker filled. */
export function fillPage(markdown) {
  return markdown.replace(MARKER, (_, recipe, path) => renderFile(recipe, path));
}

/** The markers of a page: which recipe and which file. */
export function markersOf(markdown) {
  return [...markdown.matchAll(MARKER)].map((match) => ({ recipe: match[1], path: match[2] }));
}

/** The pages of docs/ that have a marker. */
export function pagesWithMarkers(docs = DOCS) {
  return readdirSync(docs)
    .filter((name) => name.endsWith(".md"))
    .filter((name) => markersOf(readFileSync(join(docs, name), "utf8")).length > 0);
}

function main(argv) {
  const check = argv.includes("--check");
  const at = argv.indexOf("--docs");
  const docs = at === -1 ? DOCS : resolve(argv[at + 1]);
  let stale = 0;
  for (const name of pagesWithMarkers(docs)) {
    const path = join(docs, name);
    const current = readFileSync(path, "utf8");
    const filled = fillPage(current);
    if (filled === current) continue;
    if (check) {
      console.error(`docs/${name} is out of date. Run npm run build:docs and commit the result.`);
      stale += 1;
    } else {
      writeFileSync(path, filled);
      console.log(`Wrote docs/${name}`);
    }
  }
  if (check && stale > 0) process.exitCode = 1;
  else if (check) console.log("The pages of the recipes are up to date.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
