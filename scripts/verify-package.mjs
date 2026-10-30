#!/usr/bin/env node
// Pack-and-install check. It builds the package, packs the tarball, installs it in a throwaway
// folder, runs `sitekit init` in a throwaway repository, installs and builds the generated site,
// and asserts on the result. A problem only a consumer would see (a file missing from the tarball,
// a wrong path, server code in the browser bundle) fails here, before publish.

import { execFileSync } from "node:child_process";
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

const runLoud = (command, args, options = {}) =>
  execFileSync(command, args, { stdio: "inherit", ...options });

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
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
  "# Guide\n\nThe longer guide.\n\n## Advanced\n\nAdvanced use.\n",
);
write(join(REPO, "docs", "internal", "plan.md"), "# Plan\n\nNot for the site.\n");
write(
  join(REPO, "docs", "README.md"),
  "# Widget documentation\n\nStart with the getting started guide.\n",
);
write(
  join(REPO, "docs", "tutorials", "first-steps.md"),
  "# First steps\n\nA tutorial in its own collection.\n",
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
config.collections[0].groups = [
  { name: "Start", tone: "brand", items: ["overview", "getting-started"] },
  { name: "Use", tone: "success", items: ["guide"] },
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
check("check passes clean content", () => {
  assert(/Safe to publish/.test(sitekit(["check"])), "not safe");
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

console.log("4/6 Install and build the generated site");
runLoud("npm", ["ci", "--no-audit", "--no-fund"], { cwd: SITE });
runLoud("npm", ["run", "build"], {
  cwd: SITE,
  env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
});
const dist = join(SITE, "dist");
const read = (path) => readFileSync(join(dist, path), "utf8");

check("every document, example and the changelog became a page with its own title", () => {
  const expected = {
    "index.html": "widget",
    "docs/getting-started/index.html": "Getting started",
    "docs/guide/index.html": "Guide",
    "docs/overview/index.html": "Widget documentation",
    "tutorials/first-steps/index.html": "First steps",
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

console.log("6/6 Done");
console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length === 0 ? 0 : 1);
