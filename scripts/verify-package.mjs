#!/usr/bin/env node
// Pack-and-install check. It builds the package, packs the tarball, installs it in a throwaway
// folder, runs `sitekit init` in a throwaway repository, installs and builds the generated site,
// and asserts on the result. A problem only a consumer would see (a file missing from the tarball,
// a wrong path, server code in the browser bundle) fails here, before publish.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const WORK = join(ROOT, "e2e", ".build");
const TOOLS = join(WORK, "tools");
const REPO = join(WORK, "repo");
const SITE = join(REPO, "site");

const PACKAGE = "docs-sitekit";
const failures = [];
let passed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok    ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`  FAIL  ${name}\n        ${String(error.message).split("\n").join("\n        ")}`);
  }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: "pipe", ...options });
  } catch (error) {
    const stderr = String(error.stderr ?? "").trim();
    const stdout = String(error.stdout ?? "").trim();
    const wrapped = new Error(
      `${command} ${args.join(" ")} exited with ${error.status}\n${stderr || stdout}`,
    );
    wrapped.status = error.status;
    wrapped.stdout = stdout;
    wrapped.stderr = stderr;
    throw wrapped;
  }
}

/** Run git in a folder with a fixed identity. A date makes the commit as old as that date. */
const gitIn = (cwd, args, date) =>
  run(
    "git",
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    {
      cwd,
      env: { ...process.env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) },
    },
  );

const runLoud = (command, args, options = {}) =>
  execFileSync(command, args, { stdio: "inherit", ...options });

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

// Line of the first line of a file that holds `needle`, starting at 1.
function lineOf(path, needle) {
  const index = readFileSync(path, "utf8")
    .split("\n")
    .findIndex((line) => line.includes(needle));
  assert(index !== -1, `${path} has no line with ${needle}`);
  return index + 1;
}

// Run a command and keep both streams, because the findings go to stderr and a failure must not throw.
function capture(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function write(path, content) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
}

// Credential-shaped text is built at run time, so no literal here looks like a leak.
const FAKE_AWS_KEY = ["AKIA", "IOSFODNN7EXAMPLE"].join("");

console.log("1/6 Build and pack");
rmSync(WORK, { recursive: true, force: true });
mkdirSync(TOOLS, { recursive: true });
runLoud("npm", ["run", "build"], { cwd: ROOT });
const packOutput = JSON.parse(
  run("npm", ["pack", "--json", "--pack-destination", WORK], { cwd: ROOT }),
);
const packed = Array.isArray(packOutput) ? packOutput[0] : Object.values(packOutput)[0];
assert(packed?.filename, "npm pack returned no tarball");
const tarball = join(WORK, packed.filename);
const packedPaths = packed.files.map((file) => file.path);

check("tarball has the CLI, the template, the registry and the workflow", () => {
  for (const required of [
    "dist/cli.js",
    "dist/index.js",
    "template/package.json",
    "template/package-lock.json",
    "template/registry.json",
    "template/design/tokens.json",
    "template/astro.config.ts",
    "template/_github/workflows/docs.yml",
    "template/src/domain/config.ts",
    "template/src/domain/codeBlocks.ts",
    "template/src/infrastructure/codeBlocks.ts",
    "template/src/presentation/code/copyCode.ts",
    "template/src/styles/code.css",
    "template/src/presentation/components/site/Hero.astro",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
  ]) {
    assert(packedPaths.includes(required), `missing ${required}`);
  }
});
check("tarball has no node_modules, build output, dev config or tests", () => {
  const bad = packedPaths.filter((path) =>
    /node_modules|template\/dist\/|template\/\.astro\/|template\/sitekit\.config\.json|__tests__|\.env/.test(
      path,
    ),
  );
  assert(bad.length === 0, `unexpected files: ${bad.slice(0, 5).join(", ")}`);
});
check("every package in both lockfiles comes from the public npm registry", () => {
  for (const lockfile of [
    join(ROOT, "package-lock.json"),
    join(ROOT, "template", "package-lock.json"),
  ]) {
    const { packages } = JSON.parse(readFileSync(lockfile, "utf8"));
    const elsewhere = Object.entries(packages)
      .filter(
        ([name, entry]) =>
          name !== "" &&
          entry.resolved &&
          !entry.resolved.startsWith("https://registry.npmjs.org/"),
      )
      .map(([name, entry]) => `${name} -> ${entry.resolved}`);
    assert(elsewhere.length === 0, `${lockfile}: ${elsewhere.slice(0, 3).join(", ")}`);
  }
});

console.log("2/6 Install the tarball and run the CLI");
write(join(TOOLS, "package.json"), JSON.stringify({ name: "tools", private: true }));
runLoud("npm", ["install", "--no-audit", "--no-fund", tarball], { cwd: TOOLS });
const CLI = join(TOOLS, "node_modules", ...PACKAGE.split("/"), "dist", "cli.js");
const sitekit = (args, options = {}) => run("node", [CLI, ...args], { cwd: REPO, ...options });

check("the installed CLI answers --version and --help", () => {
  assert(/^\d+\.\d+\.\d+/.test(run("node", [CLI, "--version"]).trim()), "no version printed");
  assert(run("node", [CLI, "--help"]).includes("sitekit init"), "help is missing");
});

// A repository like a real one: its own package.json, a src/ folder, docs, examples, a changelog.
mkdirSync(join(REPO, ".git"), { recursive: true });
run("git", ["init", "-q", "-b", "main"], { cwd: REPO });
run("git", ["remote", "add", "origin", "https://github.com/demo/widget.git"], { cwd: REPO });
write(
  join(REPO, "package.json"),
  JSON.stringify(
    {
      name: "@demo/widget",
      version: "1.2.3",
      description: "A widget that does widget things.",
      license: "MIT",
    },
    null,
    2,
  ),
);
write(join(REPO, "src", "index.ts"), "export const widget = 1;\n");
write(join(REPO, "README.md"), "# Widget\n\nA widget that does widget things.\n");
write(join(REPO, "LICENSE"), "MIT License\n");
write(
  join(REPO, "docs", "getting-started.md"),
  [
    "---",
    "order: 1",
    "tags: [Setup, Guide]",
    "---",
    "",
    "# Getting started",
    "",
    "Install the widget and use it.",
    "",
    "```bash",
    "# install it",
    "npm install @demo/widget",
    "```",
    "",
    "## Next steps",
    "",
    "Read [the guide](./guide.md#advanced), the [license](../LICENSE) or the [missing page](./nope.md).",
    "",
    "Code stays as written: `[guide](./guide.md)`.",
    "",
    "A long token that has no spaces and must wrap instead of widening the page: `averyveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryverylongidentifier_with_underscores_and_more`.",
    "",
    "```ts",
    "export const configuration = { endpoint: 'https://example.com/a/very/long/path/that/keeps/going/and/going/and/going', retries: 3, timeoutMilliseconds: 15000 };",
    "```",
    "",
    "| Option | Type | Default | Description | Since | Notes |",
    "| --- | --- | --- | --- | --- | --- |",
    "| `timeoutMilliseconds` | number | 15000 | How long to wait before giving up on a request to the server | 1.0.0 | Applies to every request |",
    "| `retries` | number | 3 | How many times to try again when a request fails with a network error | 1.1.0 | Uses exponential backoff |",
    "",
  ].join("\n"),
);
write(
  join(REPO, "docs", "guide.md"),
  '---\ntags: [guide, Reference, "A tag of many words that has to wrap inside its button", Averyveryveryveryveryveryveryveryveryveryverylongtagwithnospaces]\n---\n\n# Guide\n\nThe longer guide.\n\n## Advanced\n\nAdvanced use.\n',
);
write(
  join(REPO, "docs", "callouts.md"),
  [
    "---",
    "tags: [Reference, Markdown]",
    "---",
    "",
    "# Callouts",
    "",
    "Notes written in markdown.",
    "",
    "> [!NOTE]",
    "> A note with a [link to the guide](./guide.md) and `inline code`.",
    "",
    "> [!TIP]",
    "> A tip with a list:",
    ">",
    "> - first item",
    "> - second item",
    "",
    "> [!IMPORTANT]",
    "> Something important.",
    "",
    "> [!WARNING]",
    "> A warning with code:",
    ">",
    "> ```ts",
    "> export const longLine = { endpoint: 'https://example.com/a/very/long/path/that/keeps/going/and/going/and/going/until/it/is/wider/than/a/phone', retries: 3 };",
    "> ```",
    "",
    "> [!CAUTION]",
    "> Something that can cause harm.",
    "",
    "- A list item with a callout:",
    "  > [!NOTE]",
    "  > Inside the list.",
    "",
    "> A plain quote, not a callout.",
    "",
    "> [!NOTES]",
    "> An unknown marker stays a quote.",
    "",
    "A marker in code stays as written:",
    "",
    "```markdown",
    "> [!NOTE]",
    "> In a code block.",
    "```",
    "",
    "And in a code span: `> [!TIP]`.",
    "",
  ].join("\n"),
);
write(
  join(REPO, "docs", "tutorials", "code-blocks.md"),
  [
    "# Code blocks",
    "",
    "A title, highlighted lines, diff lines and a copy button.",
    "",
    "```ts",
    "const plain = 1;",
    "",
    'const text = "<b>&amp;</b>";',
    "```",
    "",
    '```ts title="src/config.ts"',
    "export const config = {",
    "  retries: 3,",
    "};",
    "```",
    "",
    "```ts {2,4-5}",
    "const first = 1;",
    "const second = 2;",
    "const third = 3;",
    "const fourth = 4;",
    "const fifth = 5;",
    "```",
    "",
    "```ts",
    "const kept = 1;",
    "const removed = 2; // [!code --]",
    "const added = 3; // [!code ++]",
    "```",
    "",
    "```diff",
    "--- a/src/config.ts",
    "+++ b/src/config.ts",
    "@@ -1,3 +1,3 @@",
    " export const config = {",
    "-  retries: 3,",
    "+  retries: 5,",
    " };",
    "```",
    "",
    '```ts title="src/endpoints.ts" {2}',
    "export const endpoints = {",
    "  documentation: 'https://example.com/a/very/long/path/to/the/documentation/that/keeps/going/and/going/and/going/until/it/is/wider/than/a/phone',",
    "};",
    "```",
    "",
    '```ts title="src/all.ts" {1,2}',
    "const highlighted = 1;",
    "const both = 2; // [!code ++]",
    "```",
    "",
  ].join("\n"),
);
write(join(REPO, "docs", "internal", "plan.md"), "# Plan\n\nNot for the site.\n");
write(
  join(REPO, "docs", "README.md"),
  "---\ntags: Setup\n---\n\n# Widget documentation\n\nStart with the getting started guide.\n",
);
write(
  join(REPO, "docs", "tutorials", "first-steps.md"),
  "# First steps\n\nA tutorial in its own collection.\n",
);
// Variables and snippets: `{{ version }}` comes from package.json, `{{ package }}` from `vars` in the config.
write(
  join(REPO, "snippets", "requirements.md"),
  "{{ package }} {{ version }} needs Node 22 or newer.\n",
);
write(join(REPO, "snippets", "steps.md"), "1. Install the package.\n2. Run the build.\n");
write(
  join(REPO, "docs", "tutorials", "reusable-content.md"),
  [
    "# Using {{ package }} {{ version }}",
    "",
    "<!-- include: requirements.md -->",
    "",
    "## Install {{ package }}",
    "",
    "- Do these steps:",
    "  <!-- include: steps.md -->",
    "",
    "Read [the {{ package }} guide](../guide.md) next. The source writes the version as `{{ version }}`.",
    "",
    "```md",
    "Version {{ version }}",
    "<!-- include: requirements.md -->",
    "```",
    "",
  ].join("\n"),
);
write(join(REPO, "examples", "basic", "README.md"), "# Basic example\n\nThe smallest example.\n");
write(
  join(REPO, "CHANGELOG.md"),
  "# Changelog\n\n## [1.2.3] - 2026-10-28\n\n### Added\n\n- Everything.\n",
);

check("init writes the site, the config, the lock and the workflow", () => {
  sitekit(["init"]);
  for (const path of [
    "site/sitekit.config.json",
    "site/.sitekit.json",
    "site/package.json",
    "site/package-lock.json",
    "site/astro.config.ts",
    ".github/workflows/docs.yml",
  ]) {
    assert(existsSync(join(REPO, path)), `missing ${path}`);
  }
});
check(
  "init wrote nothing outside site/ and .github/, and left the repository's own src/ alone",
  () => {
    assert(
      readFileSync(join(REPO, "src", "index.ts"), "utf8") === "export const widget = 1;\n",
      "src/index.ts changed",
    );
    assert(!existsSync(join(REPO, "src", "domain")), "wrote into the repository's src/");
  },
);
check("the config comes from the repository", () => {
  const { site } = JSON.parse(readFileSync(join(SITE, "sitekit.config.json"), "utf8"));
  assert(
    site.name === "widget" && site.base === "/widget/" && site.url === "https://demo.github.io",
    `got ${JSON.stringify(site)}`,
  );
  assert(
    site.installCommand === "npm install @demo/widget",
    `install command: ${site.installCommand}`,
  );
});
check("a new site has the edit link on the branch of the repository, and the dates on", () => {
  const { editLink, lastUpdated } = JSON.parse(
    readFileSync(join(SITE, "sitekit.config.json"), "utf8"),
  );
  assert(
    editLink?.enabled === true && editLink.branch === "main",
    `editLink: ${JSON.stringify(editLink)}`,
  );
  assert(lastUpdated?.enabled === true, `lastUpdated: ${JSON.stringify(lastUpdated)}`);
});
check("init found docs, tutorials (inside docs/) and examples, each as its own collection", () => {
  const { collections } = JSON.parse(readFileSync(join(SITE, "sitekit.config.json"), "utf8"));
  assert(
    JSON.stringify(collections.map((c) => [c.id, c.dir])) ===
      JSON.stringify([
        ["docs", "../docs"],
        ["tutorials", "../docs/tutorials"],
        ["examples", "../examples"],
      ]),
    `got ${JSON.stringify(collections)}`,
  );
});
check(
  "the generated workflow calls the docs-sitekit action at the version that wrote it, and rebuilds on a release",
  () => {
    const { version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const workflow = readFileSync(join(REPO, ".github", "workflows", "docs.yml"), "utf8");
    assert(
      workflow.includes(`miguelcolmenares/docs-sitekit@v${version}`),
      "the action is not pinned to this version",
    );
    assert(
      new RegExp(`version: ${version.replaceAll(".", "\\.")}`).test(workflow),
      "the CLI version is not pinned",
    );
    assert(
      /release:\s*\n\s*types: \[published\]/.test(workflow),
      "a release does not trigger a rebuild",
    );
    assert(!workflow.includes("__SITEKIT_VERSION__"), "the version placeholder was left in");
    assert(/fetch-depth: 0/.test(workflow), "the checkout is shallow, so no page has its own date");
    assert(!workflow.includes("configure-pages"), "it uses configure-pages");
  },
);
check("the generated site depends on no sitekit package and on no private registry", () => {
  const manifest =
    readFileSync(join(SITE, "package.json"), "utf8") +
    readFileSync(join(SITE, "package-lock.json"), "utf8");
  assert(!manifest.includes("docs-sitekit"), "the site depends on the CLI");
  assert(!existsSync(join(SITE, ".npmrc")), "the site has an .npmrc");
  assert(!/npm\.pkg\.github\.com/.test(manifest), "the lockfile points at a private registry");
});
check("init refuses a folder that already has files", () => {
  let message = "";
  try {
    sitekit(["init"]);
  } catch (error) {
    message = error.stderr;
  }
  assert(/already has files/.test(message), `got: ${message}`);
});

console.log("3/6 Check before the site is built");
check("check fails while the repository visibility is unknown, instead of guessing", () => {
  let message = "";
  try {
    sitekit(["check"]);
  } catch (error) {
    message = error.stderr;
  }
  assert(/Cannot tell whether the repository is private/.test(message), `got: ${message}`);
});
const configPath = join(SITE, "sitekit.config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
config.deploy.repositoryVisibility = "public";
config.anonymize.excludePaths = ["docs/internal/**"];
// The generated site writes llms.txt and a Markdown copy of each page, so the check and the e2e spec cover them.
config.llms = { enabled: true, optional: ["examples"], markdownPages: true };
// The home page shows a stat row, so the e2e measures it. One value is long on purpose: it must wrap.
config.stats = [
  { value: "1.2k", label: "Downloads", note: "Last 30 days" },
  { value: "v1.2.3", label: "Version" },
  { value: "22.23.4+", label: "Node", note: "To build the site" },
  { value: "9".repeat(48), label: "A very long value", note: "It wraps inside its card" },
];
// Two brand logos on the home page: one that ships with the kit and one from the site's own brands folder.
config.features = [
  ...(config.features ?? []),
  { icon: "brand:github", eyebrow: "Source", title: "On GitHub", text: "The code is public." },
  { icon: "brand:custom/mark", eyebrow: "Mark", title: "Our own mark", text: "From brands/." },
];
write(
  join(SITE, "brands", "mark.svg"),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/></svg>\n',
);
// The reusable content page uses this variable. `version` is not set: it is read from package.json.
config.vars = { package: "@demo/widget" };
config.collections[0].groups = [
  { name: "Start", tone: "brand", items: ["overview", "getting-started"] },
  { name: "Use", tone: "success", items: ["guide", "callouts"] },
];
writeFileSync(configPath, JSON.stringify(config, null, 2));
check("check fails on a page that no group lists, and says how to fix it", () => {
  const extra = join(REPO, "docs", "extra.md");
  writeFileSync(extra, "# Extra\n\nA page nobody classified.\n");
  let message = "";
  try {
    sitekit(["check"]);
  } catch (error) {
    message = error.stderr;
  }
  rmSync(extra);
  assert(/extra is in no group of "Docs".*Add it to a group/.test(message), `got: ${message}`);
});
check("check fails on a group that names a page that does not exist", () => {
  const original = readFileSync(configPath, "utf8");
  const broken = JSON.parse(original);
  broken.collections[0].groups[1].items.push("tpyo");
  writeFileSync(configPath, JSON.stringify(broken, null, 2));
  let message = "";
  try {
    sitekit(["check"]);
  } catch (error) {
    message = error.stderr;
  }
  writeFileSync(configPath, original);
  assert(/lists "tpyo", which is not a page/.test(message), `got: ${message}`);
});
check("check fails on a missing snippet and names the file and line", () => {
  const broken = join(REPO, "docs", "tutorials", "broken.md");
  writeFileSync(broken, "# Broken\n\nText.\n\n<!-- include: nope.md -->\n");
  let message = "";
  try {
    sitekit(["check"]);
  } catch (error) {
    message = error.stderr;
  }
  rmSync(broken);
  assert(
    /docs\/tutorials\/broken\.md:5: error: Snippet "nope\.md" was not found/.test(message),
    `got: ${message}`,
  );
});
check("check warns about an unknown variable with the file and line, and still passes", () => {
  const warned = join(REPO, "docs", "tutorials", "warned.md");
  writeFileSync(warned, "# Warned\n\nText.\n\nA {{ ghost }} here.\n");
  let output;
  try {
    output = sitekit(["check"]);
  } finally {
    rmSync(warned);
  }
  assert(
    /docs\/tutorials\/warned\.md:5: warning: Unknown variable "ghost"/.test(output),
    `got: ${output}`,
  );
  assert(/Safe to publish/.test(output), "an unknown variable should be a warning");
});
check("check passes clean content", () => {
  assert(/Safe to publish/.test(sitekit(["check"])), "not safe");
});
check("check prints the warnings of the content with file and line, and still passes", () => {
  const output = sitekit(["check"]);
  const missing = lineOf(join(REPO, "docs", "getting-started.md"), "[missing page](./nope.md)");
  const marker = lineOf(join(REPO, "docs", "callouts.md"), "> [!NOTES]");
  assert(
    output.includes(
      `docs/getting-started.md:${missing}: warning: Link "./nope.md" does not match any file`,
    ),
    `no warning for the missing page:\n${output}`,
  );
  assert(
    output.includes(`docs/callouts.md:${marker}: warning: "[!NOTES]" is not a callout marker`),
    `no warning for the unknown marker:\n${output}`,
  );
  assert(/Content: 0 errors, 2 warnings\./.test(output), `no count:\n${output}`);
});
check("check finds a credential in the docs, masked, and passes again once it is removed", () => {
  const file = join(REPO, "docs", "guide.md");
  const original = readFileSync(file, "utf8");
  writeFileSync(file, `${original}\nkey ${FAKE_AWS_KEY}\n`);
  let message = "";
  try {
    sitekit(["check"]);
  } catch (error) {
    message = error.stderr;
  }
  writeFileSync(file, original);
  assert(/docs\/guide\.md: aws-access-key/.test(message), `got: ${message}`);
  assert(!message.includes(FAKE_AWS_KEY), "the secret was printed");
  assert(/Safe to publish/.test(sitekit(["check"])), "still failing after removal");
});

// A git history for the dates: every file was added on 2026-01-10, and only the guide changed after that.
gitIn(REPO, ["add", "-A"]);
gitIn(REPO, ["commit", "-q", "-m", "Add the widget and its docs"], "2026-01-10T12:00:00Z");
writeFileSync(
  join(REPO, "docs", "guide.md"),
  `${readFileSync(join(REPO, "docs", "guide.md"), "utf8")}\n## Later\n\nAdded after the first commit.\n`,
);
gitIn(REPO, ["add", "docs/guide.md"]);
gitIn(REPO, ["commit", "-q", "-m", "Extend the guide"], "2026-03-15T12:00:00Z");
check("check warns about a shallow clone when lastUpdated is on, and still passes", () => {
  const shallow = join(WORK, "repo-shallow");
  gitIn(WORK, ["clone", "-q", "--depth", "1", `file://${REPO}`, shallow]);
  const output = run("node", [CLI, "check", "--root", shallow]);
  assert(/warning: lastUpdated is on, but this is a shallow clone/.test(output), `got: ${output}`);
  assert(/fetch-depth: 0/.test(output), "the warning does not say how to fix it");
  assert(/Safe to publish/.test(output), "a shallow clone must warn, not fail");
});
check("check does not warn about a full clone", () => {
  assert(!/shallow/.test(sitekit(["check"])), "a full clone was called shallow");
});

console.log("4/6 Install and build the generated site");
runLoud("npm", ["ci", "--no-audit", "--no-fund"], { cwd: SITE });
const firstBuild = capture("npm", ["run", "build"], {
  cwd: SITE,
  env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
});
process.stdout.write(firstBuild.stdout);
process.stderr.write(firstBuild.stderr);
assert(firstBuild.status === 0, "the build of the generated site failed");
const dist = join(SITE, "dist");
const read = (path) => readFileSync(join(dist, path), "utf8");

check(
  "the build prints the findings of the markdown with file and line, and does not fail on them",
  () => {
    const missing = lineOf(join(REPO, "docs", "getting-started.md"), "[missing page](./nope.md)");
    assert(
      firstBuild.stderr.includes(
        `docs/getting-started.md:${missing}: warning: Link "./nope.md" does not match any file`,
      ),
      `the build did not print the missing link:\n${firstBuild.stderr}`,
    );
    assert(
      /Content: 0 errors, 2 warnings\./.test(firstBuild.stderr),
      "the build did not count them",
    );
  },
);
check("every document, example and the changelog became a page with its own title", () => {
  const expected = {
    "index.html": "widget",
    "docs/getting-started/index.html": "Getting started",
    "docs/guide/index.html": "Guide",
    "docs/callouts/index.html": "Callouts",
    "docs/overview/index.html": "Widget documentation",
    "tutorials/first-steps/index.html": "First steps",
    "tutorials/code-blocks/index.html": "Code blocks",
    "tutorials/index.html": "Tutorials",
    "examples/basic/index.html": "Basic example",
    "changelog/index.html": "Changelog",
  };
  for (const [path, title] of Object.entries(expected)) {
    assert(existsSync(join(dist, path)), `missing ${path}`);
    assert(
      new RegExp(`<title>[^<]*${title}[^<]*</title>`).test(read(path)),
      `${path} has the wrong title`,
    );
  }
});
check(
  "variables and snippets are replaced in the page, its title, the search index, llms.txt and the Markdown copy",
  () => {
    const page = read("tutorials/reusable-content/index.html");
    assert(/<title>[^<]*Using @demo\/widget 1\.2\.3[^<]*<\/title>/.test(page), "wrong title");
    assert(page.includes("@demo/widget 1.2.3 needs Node 22 or newer."), "the snippet is missing");
    assert(
      /<li>Do these steps:\s*<ol>[\s\S]*Install the package\.[\s\S]*<\/ol>\s*<\/li>/.test(page),
      "the snippet did not stay in its list item",
    );
    assert(page.includes("<code>{{ version }}</code>"), "a code span was replaced");
    assert(!/<h[12][^>]*>[^<]*\{\{/.test(page), "a heading kept its variable");
    assert(!page.includes("<!-- include"), "an include comment is in the HTML of the page");
    const index = JSON.parse(read("search-index.json"));
    const entry = index.pages.find(
      (candidate) => candidate.url === "/widget/tutorials/reusable-content/",
    );
    assert(entry, "the page is not in the search index");
    assert(entry.title === "Using @demo/widget 1.2.3", `index title: ${entry.title}`);
    assert(entry.text.includes("needs Node 22 or newer"), "the index does not have the snippet");
    assert(
      read("llms.txt").includes(
        "[Using @demo/widget 1.2.3](https://demo.github.io/widget/tutorials/reusable-content/): @demo/widget 1.2.3 needs Node 22 or newer.",
      ),
      "llms.txt does not have the replaced title and description",
    );
    assert(
      read("tutorials/reusable-content/index.html.md").startsWith("# Using @demo/widget 1.2.3\n"),
      "the Markdown copy has the old title",
    );
  },
);
check(
  "pages are grouped on the index and in the sidebar, and a nested collection is not repeated in its parent",
  () => {
    const index = read("docs/index.html");
    assert(
      />Start</.test(index) && />Use</.test(index),
      "group names are missing from the docs index",
    );
    assert(index.indexOf(">Start<") < index.indexOf(">Use<"), "groups are out of order");
    assert(!index.includes("First steps"), "a tutorial leaked into the docs index");
    assert(!existsSync(join(dist, "docs", "first-steps")), "a tutorial was also built under docs/");
    assert(/>Start</.test(read("docs/guide/index.html")), "the sidebar has no group names");
  },
);
check("the docs index has a filter bar built from the tags, hidden until a script shows it", () => {
  const index = read("docs/index.html");
  const bar = /<div[^>]*\bdata-catalog-filter\b[^>]*\bhidden\b/.test(index);
  assert(bar, "the docs index has no hidden filter bar");
  for (const tag of ["Setup", "Guide", "Reference", "Markdown"]) {
    assert(index.includes(`>${tag}</button>`), `no tag button for ${tag}`);
  }
  assert(
    (index.match(/<a [^>]*data-filter-item/g) ?? []).length === 4,
    "the docs index does not have four filterable cards",
  );
  assert(
    !/<div[^>]*\bdata-catalog-filter\b/.test(read("tutorials/index.html")),
    "a catalog without tags got a filter bar",
  );
});
check("a page has the edit link to its file and the date of the file's own last commit", () => {
  const guide = read("docs/guide/index.html");
  const started = read("docs/getting-started/index.html");
  assert(
    guide.includes('href="https://github.com/demo/widget/edit/main/docs/guide.md"'),
    "the guide has no edit link",
  );
  assert(
    /<time datetime="2026-03-15">15 March 2026<\/time>/i.test(guide),
    "the guide date is wrong",
  );
  assert(
    /<time datetime="2026-01-10">10 January 2026<\/time>/i.test(started),
    "the date is the last commit of the repository",
  );
  assert(
    !/edit\//.test(read("index.html")) && !/<time/i.test(read("404.html")),
    "the home page or 404 has the footer",
  );
});
check("an excluded file is not on the site", () => {
  assert(!existsSync(join(dist, "docs", "plan")), "docs/internal/plan.md was published");
  assert(
    !listFiles(dist).some((file) => readFileSync(file, "utf8").includes("Not for the site")),
    "its text is in the build",
  );
});
check("relative links were rewritten, and code was left alone", () => {
  const html = read("docs/getting-started/index.html");
  assert(
    html.includes('href="/widget/docs/guide/#advanced"'),
    "link to a published page was not rewritten",
  );
  assert(
    html.includes('href="https://github.com/demo/widget/blob/HEAD/LICENSE"'),
    "link to a repository file was not rewritten",
  );
  assert(html.includes("./nope.md"), "a missing target should stay as written");
  assert(html.includes("[guide](./guide.md)"), "link text inside code was changed");
});
check("the stat row is a description list on the home page, one term per stat", () => {
  const home = read("index.html");
  const list = /<dl\b[^>]*>([\s\S]*?)<\/dl>/.exec(home);
  assert(list, "the home page has no <dl>");
  assert((list[1].match(/<dt\b/g) ?? []).length === 4, "the <dl> does not have four terms");
  assert(list[1].includes("Downloads") && list[1].includes("Last 30 days"), "a stat is missing");
});
check("404.html is the not-found page, not a copy of index.html", () => {
  assert(read("404.html") !== read("index.html"), "404.html equals index.html");
  assert(/Page not found/.test(read("404.html")), "404.html is not the not-found page");
});
check("a code block that opens with a # comment did not become a title", () => {
  assert(/<title>Getting started/.test(read("docs/getting-started/index.html")), "wrong title");
});
check("fonts are served from the site, with no request to a font host", () => {
  const css = listFiles(join(dist, "_astro"))
    .filter((file) => file.endsWith(".css"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  assert(
    !/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(css + read("index.html")),
    "a font host is referenced",
  );
});
check(
  "the footer shows the version from package.json, and a rebuild after a release shows the new one",
  () => {
    assert(/>v1\.2\.3</.test(read("index.html")), "the footer does not show v1.2.3");
    const manifest = join(REPO, "package.json");
    const original = readFileSync(manifest, "utf8");
    writeFileSync(manifest, original.replace('"version": "1.2.3"', '"version": "1.3.0"'));
    try {
      run("npm", ["run", "build"], {
        cwd: SITE,
        env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
      });
    } finally {
      // The config never held the version, so only the repository's package.json changed.
      assert(
        !/"version"/.test(readFileSync(join(SITE, "sitekit.config.json"), "utf8")),
        "the config holds a version",
      );
    }
    assert(/>v1\.3\.0</.test(read("index.html")), "the rebuilt footer does not show v1.3.0");
    assert(
      /href="\/widget\/changelog\/"[^>]*>v1\.3\.0</.test(read("docs/guide/index.html")),
      "the version does not link to the changelog",
    );
  },
);
check("the built site has no credentials and passes check --dist", () => {
  assert(/Safe to publish/.test(sitekit(["check", "--dist", "site/dist"])), "check --dist failed");
});

// The Action builds, then runs exactly this: `check --dir <site> --dist <site>/dist`.
check(
  "a broken image fails the Action's check, at its line, and passes again once it is fixed",
  () => {
    const file = join(REPO, "docs", "guide.md");
    const original = readFileSync(file, "utf8");
    writeFileSync(file, `${original}\n![diagram](./img/missing.png)\n`);
    const line = lineOf(file, "![diagram]");
    const failed = capture("node", [CLI, "check", "--dir", "site", "--dist", "site/dist"], {
      cwd: REPO,
    });
    writeFileSync(file, original);
    assert(failed.status === 1, `check exited with ${failed.status}, not 1`);
    assert(
      failed.stderr.includes(
        `docs/guide.md:${line}: error: Image "./img/missing.png" does not exist`,
      ),
      `the image was not reported:\n${failed.stderr}`,
    );
    assert(/1 problem\(s\)\. Not safe to publish/.test(failed.stdout), "no verdict");
    assert(
      /Safe to publish/.test(sitekit(["check", "--dir", "site", "--dist", "site/dist"])),
      "still failing after the fix",
    );
  },
);
check(
  "check.images in the config lowers the broken image to a warning, and an unknown kind is refused",
  () => {
    const file = join(REPO, "docs", "guide.md");
    const original = readFileSync(file, "utf8");
    const saved = readFileSync(configPath, "utf8");
    writeFileSync(file, `${original}\n![diagram](./img/missing.png)\n`);
    try {
      writeFileSync(
        configPath,
        JSON.stringify({ ...JSON.parse(saved), check: { images: "warning" } }),
      );
      const lowered = capture("node", [CLI, "check"], { cwd: REPO });
      assert(lowered.status === 0, `check exited with ${lowered.status}:\n${lowered.stderr}`);
      assert(
        /docs\/guide\.md:\d+: warning: Image "\.\/img\/missing\.png"/.test(lowered.stdout),
        "not a warning",
      );

      writeFileSync(
        configPath,
        JSON.stringify({ ...JSON.parse(saved), check: { imagez: "error" } }),
      );
      const unknown = capture("node", [CLI, "check"], { cwd: REPO });
      assert(unknown.status === 1, "an unknown kind did not fail");
      assert(/"imagez" is not a kind of finding/.test(unknown.stderr), `got: ${unknown.stderr}`);
    } finally {
      writeFileSync(configPath, saved);
      writeFileSync(file, original);
    }
  },
);

console.log("5/6 Components");
check("list shows the registry", () => {
  assert(sitekit(["list"]).includes("command-box"), "command-box is not listed");
});
check("add keeps a component you edited, and add --force restores it", () => {
  const file = join(SITE, "src", "presentation", "components", "site", "Callout.tsx");
  writeFileSync(file, "// edited by the user\n");
  const kept = sitekit(["add", "callout"]);
  assert(
    readFileSync(file, "utf8") === "// edited by the user\n" && /kept/.test(kept),
    "the edited file was overwritten",
  );
  sitekit(["add", "callout", "--force"]);
  assert(
    readFileSync(file, "utf8").includes("export function Callout"),
    "force did not restore it",
  );
});
check("add rejects an unknown component with a way forward", () => {
  let message = "";
  try {
    sitekit(["add", "nope"]);
  } catch (error) {
    message = error.stderr;
  }
  assert(/Unknown component "nope".*sitekit list/.test(message), `got: ${message}`);
});

console.log("5b/6 Upgrade a site made by the published 0.1.0");
// The real 0.1.0 from the registry makes a site, and this build upgrades it. Nothing here is a copy:
// a site made by an older release has to come out building and passing `check`.
const OLD_TOOLS = join(WORK, "tools-0.1.0");
const OLD_REPO = join(WORK, "repo-0.1.0");
const OLD_SITE = join(OLD_REPO, "site");
mkdirSync(OLD_TOOLS, { recursive: true });
write(join(OLD_TOOLS, "package.json"), JSON.stringify({ name: "tools-old", private: true }));
runLoud("npm", ["install", "--no-audit", "--no-fund", `${PACKAGE}@0.1.0`], { cwd: OLD_TOOLS });
const OLD_CLI = join(OLD_TOOLS, "node_modules", PACKAGE, "dist", "cli.js");
const oldKit = (args) => run("node", [OLD_CLI, ...args], { cwd: OLD_REPO });
const upgrade = (args = []) => run("node", [CLI, "upgrade", ...args], { cwd: OLD_REPO });
const gitOld = (...args) =>
  run(
    "git",
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd: OLD_REPO },
  );
/** Every file of the old repository with its text, outside .git and node_modules. */
const snapshotOld = () =>
  Object.fromEntries(
    listFiles(OLD_REPO)
      .filter((file) => !/[\\/](\.git|node_modules|dist|\.astro)[\\/]/.test(file))
      .map((file) => [file.slice(OLD_REPO.length + 1), readFileSync(file, "utf8")]),
  );
const siteFile = (path) => join(OLD_SITE, path);

mkdirSync(OLD_REPO, { recursive: true });
run("git", ["init", "-q", "-b", "main"], { cwd: OLD_REPO });
run("git", ["remote", "add", "origin", "https://github.com/demo/widget.git"], { cwd: OLD_REPO });
write(
  join(OLD_REPO, "package.json"),
  JSON.stringify({
    name: "@demo/widget",
    version: "1.2.3",
    description: "A widget.",
    license: "MIT",
  }),
);
write(join(OLD_REPO, "README.md"), "# Widget\n\nA widget that does widget things.\n");
write(join(OLD_REPO, "LICENSE"), "MIT License\n");
write(join(OLD_REPO, "docs", "getting-started.md"), "# Getting started\n\nInstall the widget.\n");
write(join(OLD_REPO, "CHANGELOG.md"), "# Changelog\n\n## [1.2.3] - 2026-10-28\n\n- Everything.\n");
oldKit(["init"]);

// The owner's edits: one file the kit has not changed since 0.1.0, and one it has.
const KEPT = "src/domain/glob.ts";
const CONFLICT = "src/styles/prose.css";
const REPLACED = "src/domain/describe.ts";
const CURRENT_TEMPLATE = join(ROOT, "template");
const templateText = (path) => readFileSync(join(CURRENT_TEMPLATE, path), "utf8");
const oldConfig = JSON.parse(readFileSync(siteFile("sitekit.config.json"), "utf8"));
oldConfig.deploy.repositoryVisibility = "public";
writeFileSync(siteFile("sitekit.config.json"), JSON.stringify(oldConfig, null, 2));
const keptText = `${readFileSync(siteFile(KEPT), "utf8")}// my own change\n`;
const conflictText = `${readFileSync(siteFile(CONFLICT), "utf8")}\n/* my own styles */\n`;
writeFileSync(siteFile(KEPT), keptText);
writeFileSync(siteFile(CONFLICT), conflictText);

check("the site made by 0.1.0 has a lock at 0.1.0 and none of the newer options", () => {
  const lock = JSON.parse(readFileSync(siteFile(".sitekit.json"), "utf8"));
  assert(lock.sitekit === "0.1.0", `the lock says ${lock.sitekit}`);
  assert(!("search" in oldConfig) && !("theme" in oldConfig), "the old config has the new keys");
});
check("with uncommitted changes the upgrade is a dry run by default, and writes nothing", () => {
  const before = snapshotOld();
  const output = upgrade();
  assert(/uncommitted changes/.test(output) && /dry run/i.test(output), `got: ${output}`);
  assert(
    JSON.stringify(snapshotOld()) === JSON.stringify(before),
    "the dry run by default changed files",
  );
});
gitOld("add", "-A");
gitOld("commit", "-q", "-m", "A site made by 0.1.0");
check("--dry-run reports the four cases and writes nothing", () => {
  const before = snapshotOld();
  const output = upgrade(["--dry-run"]);
  assert(JSON.stringify(snapshotOld()) === JSON.stringify(before), "--dry-run changed files");
  assert(output.includes(`site/${REPLACED} (would be replaced)`), `got: ${output}`);
  assert(output.includes(`site/${KEPT} (you changed it, the kit did not, kept)`), `got: ${output}`);
  assert(output.includes(`! site/${CONFLICT}`), `got: ${output}`);
  assert(/\+ site\/src\/domain\/llms\.ts \(would be added\)/.test(output), `got: ${output}`);
});
check("the upgrade replaces, keeps, adds and leaves the conflict for the owner to merge", () => {
  const before = snapshotOld();
  const output = upgrade();
  assert(/Upgrading site\/ from 0\.1\.0 to /.test(output), `got: ${output}`);
  assert(readFileSync(siteFile(REPLACED), "utf8") === templateText(REPLACED), "not replaced");
  assert(readFileSync(siteFile(KEPT), "utf8") === keptText, "the owner's file was changed");
  assert(readFileSync(siteFile(CONFLICT), "utf8") === conflictText, "the owner's file was lost");
  assert(
    readFileSync(siteFile(`${CONFLICT}.sitekit-new`), "utf8") === templateText(CONFLICT),
    "the new version is not next to the owner's file",
  );
  assert(existsSync(siteFile("src/domain/llms.ts")), "a new file was not added");
  const after = snapshotOld();
  const touched = Object.keys({ ...before, ...after }).filter(
    (path) => before[path] !== after[path],
  );
  const outside = touched.filter((path) => !path.startsWith("site/"));
  assert(outside.length === 0, `changed outside the site: ${outside.join(", ")}`);
  assert(
    before["docs/getting-started.md"] === after["docs/getting-started.md"] &&
      before["CHANGELOG.md"] === after["CHANGELOG.md"],
    "content changed",
  );
});
check("the lock moved to this version, and the options keep the site as it was", () => {
  const { version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(siteFile(".sitekit.json"), "utf8"));
  assert(lock.sitekit === version, `the lock says ${lock.sitekit}`);
  const config = JSON.parse(readFileSync(siteFile("sitekit.config.json"), "utf8"));
  assert(config.search?.enabled === false && config.llms?.enabled === false, "options not set off");
  assert(
    config.editLink?.enabled === false && config.lastUpdated?.enabled === false,
    "the edit link or the dates were turned on for a site that did not have them",
  );
  assert(config.theme?.default === "dark", "the theme is not dark");
});
check("a second upgrade has nothing left to replace or add", () => {
  const output = upgrade(["--apply"]);
  assert(/0 replaced, 0 added/.test(output), `got: ${output}`);
  assert(output.includes(`! site/${CONFLICT}`), "the conflict is gone before it was merged");
});
runLoud("npm", ["ci", "--no-audit", "--no-fund"], { cwd: OLD_SITE });
runLoud("npm", ["run", "build"], {
  cwd: OLD_SITE,
  env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
});
check("the upgraded site builds, is still without search and llms.txt, and passes check", () => {
  assert(existsSync(join(OLD_SITE, "dist", "index.html")), "no index.html");
  assert(
    !existsSync(join(OLD_SITE, "dist", "search-index.json")),
    "the site gained a search index",
  );
  assert(!existsSync(join(OLD_SITE, "dist", "llms.txt")), "the site gained llms.txt");
  const oldPage = readFileSync(
    join(OLD_SITE, "dist", "docs", "getting-started", "index.html"),
    "utf8",
  );
  assert(!/<time|Edit this page/.test(oldPage), "the site gained the edit link or the dates");
  assert(
    /Safe to publish/.test(run("node", [CLI, "check", "--dist", "site/dist"], { cwd: OLD_REPO })),
    "check --dist failed",
  );
  assert(/Safe to publish/.test(run("node", [CLI, "check"], { cwd: OLD_REPO })), "check failed");
});

console.log("6/6 Done");
console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length === 0 ? 0 : 1);
