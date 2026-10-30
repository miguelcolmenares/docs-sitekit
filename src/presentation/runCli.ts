import { parseArgs } from "node:util";
import { resolve } from "node:path";
import {
  addComponent,
  checkSite,
  initSite,
  listComponents,
  NEW_VERSION_SUFFIX,
  upgradeSite,
} from "../application";
import type { UpgradeResult } from "../application";
// Deep imports on purpose: the template infrastructure barrel also exports the markdown renderer,
// which belongs to the generated site and must not end up in this CLI.
import { buildDocuments } from "../../template/src/application/buildDocuments";
import { readSources } from "../../template/src/infrastructure/readSources";
import { loadSiteConfig } from "../../template/src/infrastructure/siteConfig";
import { nodeEnvironment, nodeFileSystem, packagedTemplate, sha256 } from "../infrastructure";

/** Where the CLI reads and writes: output streams, the working folder and the template folder. */
export interface CliIo {
  out: (text: string) => void;
  err: (text: string) => void;
  cwd: string;
  /** Absolute path of the `template/` folder shipped with the package. */
  templateRoot: string;
}

const HELP = `docs-sitekit: documentation sites for GitHub Pages

Usage
  sitekit init    [--dir site] [--name <text>] [--description <text>] [--force] [--dry-run]
  sitekit check   [--dir site] [--dist <folder>]
  sitekit list
  sitekit add <component> [--dir site] [--force]
  sitekit upgrade [--dir site] [--dry-run] [--apply]

Options
  --root <folder>   Repository to work on. Defaults to the current folder.
  --dir <folder>    Site folder inside the repository. Defaults to "site".
  -h, --help        Show this help.
  -v, --version     Show the version.
`;

/** Run one CLI command and return its exit code: 0 on success, 1 on a failed command, 2 on a usage error. */
export function runCli(argv: string[], io: CliIo): number {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${HELP}`);
    return 2;
  }
  const { values, positionals } = parsed;
  const [command, ...rest] = positionals;
  const template = packagedTemplate(io.templateRoot);

  if (values.version) {
    io.out(`${template.version()}\n`);
    return 0;
  }
  if (values.help || command === undefined) {
    io.out(HELP);
    return command === undefined && !values.help ? 2 : 0;
  }

  const root = resolve(io.cwd, values.root ?? ".");
  const siteDir = values.dir ?? "site";

  try {
    switch (command) {
      case "init": {
        const result = initSite(
          { fs: nodeFileSystem, env: nodeEnvironment, template, hash: sha256 },
          {
            root,
            siteDir,
            force: values.force,
            dryRun: values["dry-run"],
            overrides: { name: values.name, description: values.description },
          },
        );
        io.out(
          `${values["dry-run"] ? "Would write" : "Wrote"} ${result.written.length} files${result.skipped.length ? `, kept ${result.skipped.length} that already existed` : ""}.\n`,
        );
        for (const file of result.written) io.out(`  ${values["dry-run"] ? "+" : "✓"} ${file}\n`);
        for (const file of result.skipped) io.out(`  = ${file} (kept)\n`);
        if (!values["dry-run"]) io.out(`\nNext:\n  cd ${siteDir} && npm install && npm run dev\n`);
        return 0;
      }
      case "check": {
        const report = checkSite(
          {
            fs: nodeFileSystem,
            env: nodeEnvironment,
            loadContent: (siteAbs) => {
              const config = loadSiteConfig(siteAbs);
              const { files } = readSources(siteAbs, config);
              // Builds the pages only to validate them: two files on one route, or a page in no group, throw here.
              const documents = buildDocuments(files, {
                base: config.site.base,
                collections: config.collections,
              });
              return {
                config,
                files,
                documents,
                routes: documents.map((document) => document.route),
              };
            },
          },
          { root, siteDir, dist: values.dist ? resolve(io.cwd, values.dist) : undefined },
        );
        for (const warning of report.warnings) io.out(`warning: ${warning}\n`);
        for (const error of report.errors) io.err(`error: ${error}\n`);
        io.out(
          report.errors.length === 0
            ? "Safe to publish.\n"
            : `\n${report.errors.length} problem(s). Not safe to publish.\n`,
        );
        return report.errors.length === 0 ? 0 : 1;
      }
      case "list": {
        for (const component of listComponents(template.registry()))
          io.out(`${component.name.padEnd(16)} ${component.description}\n`);
        return 0;
      }
      case "add": {
        const name = rest[0];
        if (!name) {
          io.err("Name a component. Run `sitekit list` to see them.\n");
          return 2;
        }
        const result = addComponent(
          { fs: nodeFileSystem, template, hash: sha256 },
          { siteAbs: resolve(root, siteDir), name, force: values.force },
        );
        for (const file of result.written) io.out(`  ✓ ${file}\n`);
        for (const file of result.kept)
          io.out(`  = ${file} (you changed it, kept; use --force to replace)\n`);
        if (result.missingPackages.length > 0)
          io.out(`\nInstall in ${siteDir}/: npm install ${result.missingPackages.join(" ")}\n`);
        return 0;
      }
      case "upgrade": {
        const result = upgradeSite(
          { fs: nodeFileSystem, env: nodeEnvironment, template, hash: sha256 },
          { root, siteDir, dryRun: values["dry-run"], apply: values.apply },
        );
        io.out(describeUpgrade(result, siteDir));
        return 0;
      }
      default:
        io.err(`Unknown command "${command}".\n\n${HELP}`);
        return 2;
    }
  } catch (error) {
    io.err(`error: ${(error as Error).message}\n`);
    return 1;
  }
}

/** The report `sitekit upgrade` prints: what happened to each file, and what to do next. */
function describeUpgrade(result: UpgradeResult, siteDir: string): string {
  const lines: string[] = [];
  const versions =
    result.from === result.to ? `at ${result.to}` : `from ${result.from} to ${result.to}`;
  lines.push(`Upgrading ${siteDir}/ ${versions}.`);
  if (result.dryRunReason === "uncommitted-changes") {
    lines.push(
      "The working tree has uncommitted changes, so this is a dry run and nothing was written.",
      "Commit or stash them and run `sitekit upgrade` again, or pass --apply to write anyway.",
    );
  } else if (result.dryRun) {
    lines.push("Dry run: nothing was written.");
  }
  lines.push("");
  const now = result.dryRun;
  for (const file of result.replaced) lines.push(`  ✓ ${file} (${now ? "would be " : ""}replaced)`);
  for (const file of result.added) lines.push(`  + ${file} (${now ? "would be " : ""}added)`);
  for (const file of result.kept) lines.push(`  = ${file} (you changed it, the kit did not, kept)`);
  for (const file of result.conflicts)
    lines.push(
      `  ! ${file} (you and the kit both changed it, left as it is; the new version ${now ? "would be" : "is"} in ${file}${NEW_VERSION_SUFFIX})`,
    );
  for (const file of result.deleted) lines.push(`  - ${file} (you deleted it, not brought back)`);
  for (const file of result.retired)
    lines.push(`  ~ ${file} (no longer in the kit, left as it is)`);
  for (const option of result.options)
    lines.push(
      `  + ${siteDir}/sitekit.config.json: "${option.key}": ${JSON.stringify(option.value)} (${now ? "would keep" : "keeps"} the site as it was)`,
    );
  lines.push(
    "",
    `${result.replaced.length} replaced, ${result.added.length} added, ${result.kept.length} kept, ${result.conflicts.length} to merge, ${result.unchanged.length} already current.`,
  );

  const next: string[] = [];
  if (result.dryRun) next.push("Run `sitekit upgrade` to apply these changes.");
  else {
    if (result.replaced.length + result.added.length > 0)
      next.push(
        `Run \`npm install\` in ${siteDir}/, then \`npm run build\` and \`sitekit check\`.`,
      );
    if (result.conflicts.length > 0)
      next.push(
        `Merge each ${NEW_VERSION_SUFFIX} file into your own (diff the two), then delete the ${NEW_VERSION_SUFFIX} file.`,
      );
  }
  if (result.options.length > 0 && !result.dryRun)
    next.push(
      `Review the options added to ${siteDir}/sitekit.config.json, and turn on the features you want.`,
    );
  if (result.workflowPinned)
    next.push(
      `${result.workflowPinned} still pins ${result.from}. Change it to ${result.to} yourself, the upgrade does not edit it.`,
    );
  if (next.length > 0) lines.push("", "Next:", ...next.map((step) => `  ${step}`));
  return `${lines.join("\n")}\n`;
}

function parse(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      root: { type: "string" },
      dir: { type: "string" },
      name: { type: "string" },
      description: { type: "string" },
      dist: { type: "string" },
      force: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      apply: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  });
}
