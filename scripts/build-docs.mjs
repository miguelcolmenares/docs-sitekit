#!/usr/bin/env node
// Generate the configuration reference, docs/configuration.md, from the config schema.
//
//   node scripts/build-docs.mjs            write the page
//   node scripts/build-docs.mjs --check    fail when the page is out of date, and write nothing
//
// Every key of the schema needs a .describe(): a key without one fails the script and is named.
// The schema is TypeScript, so it is bundled to a temporary folder first, the way the CLI is.
// Option, mostly for tests: --out, the file to write or check.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "tsdown";

const ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_OUT = join(ROOT, "docs", "configuration.md");

/** Bundle scripts/configReference.ts and return the page it builds. */
async function buildPage() {
  const dir = mkdtempSync(join(tmpdir(), "sitekit-docs-"));
  try {
    await build({
      cwd: ROOT,
      config: false,
      entry: { configReference: join(ROOT, "scripts", "configReference.ts") },
      outDir: dir,
      format: ["esm"],
      platform: "node",
      dts: false,
      clean: false,
      logLevel: "silent",
      // The bundle is imported from a temporary folder, where `zod` could not be found.
      deps: { alwaysBundle: [/./], onlyBundle: false },
    });
    const file = readdirSync(dir).find((name) => name.startsWith("configReference"));
    const module = await import(join(dir, file));
    return module.buildConfigReference();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function main(argv) {
  const check = argv.includes("--check");
  const at = argv.indexOf("--out");
  const out = at === -1 ? DEFAULT_OUT : resolve(argv[at + 1]);
  return buildPage().then((page) => {
    if (check) {
      const current = existsSync(out) ? readFileSync(out, "utf8") : "";
      if (current !== page) {
        console.error(`${out} is out of date. Run npm run build:docs and commit the result.`);
        process.exitCode = 1;
        return;
      }
      console.log(`${out} is up to date.`);
      return;
    }
    writeFileSync(out, page);
    console.log(`Wrote ${out}`);
  });
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
