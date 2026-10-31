#!/usr/bin/env node
// Generate the tables of props of the component pages, template/src/examples/props.json, from the TypeScript types
// and the TSDoc of the components.
//
//   node scripts/build-component-docs.mjs            write the file
//   node scripts/build-component-docs.mjs --check    fail when the file is out of date, and write nothing
//
// A prop with no description fails the script and is named. The script is TypeScript, so it is bundled first, the way
// build-docs.mjs does it, but into a folder of the repository: `typescript` is not bundled, and it must be found.
// Option, mostly for tests: --out, the file to write or check.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { build } from "tsdown";

const ROOT = resolve(import.meta.dirname, "..");
const TEMPLATE = join(ROOT, "template");
const DEFAULT_OUT = join(TEMPLATE, "src", "examples", "props.json");

/** Bundle scripts/componentProps.ts and the catalog, and return the JSON they build. */
async function buildJson() {
  const dir = mkdtempSync(join(ROOT, ".sitekit-docs-"));
  try {
    await build({
      cwd: ROOT,
      config: false,
      entry: { componentProps: join(ROOT, "scripts", "componentProps.ts") },
      outDir: dir,
      format: ["esm"],
      platform: "node",
      dts: false,
      clean: false,
      logLevel: "silent",
      deps: {
        neverBundle: ["typescript"],
        alwaysBundle: [/^(?!typescript$).*/],
        onlyBundle: false,
      },
    });
    const file = readdirSync(dir).find((name) => name.startsWith("componentProps"));
    const reader = await import(join(dir, file));
    const catalog = await bundleCatalog(dir);
    const specs = Object.fromEntries(catalog.PAGES.map((page) => [page.name, page.tables]));
    return reader.buildComponentProps(TEMPLATE, specs);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The catalog of the pages is TypeScript too. */
async function bundleCatalog(dir) {
  await build({
    cwd: ROOT,
    config: false,
    entry: { catalog: join(TEMPLATE, "src", "examples", "catalog.ts") },
    outDir: dir,
    format: ["esm"],
    platform: "node",
    dts: false,
    clean: false,
    logLevel: "silent",
  });
  return import(
    join(
      dir,
      readdirSync(dir).find((name) => name.startsWith("catalog")),
    )
  );
}

function main(argv) {
  const check = argv.includes("--check");
  const at = argv.indexOf("--out");
  const out = at === -1 ? DEFAULT_OUT : resolve(argv[at + 1]);
  return buildJson().then((json) => {
    if (check) {
      const current = existsSync(out) ? readFileSync(out, "utf8") : "";
      if (current !== json) {
        console.error(`${out} is out of date. Run npm run build:docs and commit the result.`);
        process.exitCode = 1;
        return;
      }
      console.log(`${out} is up to date.`);
      return;
    }
    writeFileSync(out, json);
    console.log(`Wrote ${out}`);
  });
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
