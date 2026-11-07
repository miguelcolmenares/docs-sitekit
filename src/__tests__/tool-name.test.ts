import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** The text that names the tool to a reader: documents, the action, the issue forms, the footer credit and the help. */
const FILES = [
  "README.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "THIRD_PARTY_NOTICES.md",
  "AGENTS.md",
  "action.yml",
  "src/presentation/run-cli.ts",
  "template/src/presentation/layouts/base-layout.astro",
  ...readdirSync(join(ROOT, ".github", "ISSUE_TEMPLATE")).map(
    (name) => `.github/ISSUE_TEMPLATE/${name}`,
  ),
  ...readdirSync(join(ROOT, "docs"), { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".md"))
    .map((path) => `docs/${path}`),
];

// The tool is `docs-sitekit`. The command it installs is `sitekit`, so `sitekit check` and its siblings are right,
// and so are the phrase "the `sitekit` command", `sitekit.config.json`, `sitekit-site` and variables such as
// SITEKIT_VERSION, the browser event `sitekit:theme`, the page marker `sitekit:color-palette`, and file names that start with a dot such as `.sitekit.json`. Any other bare "sitekit" is the old name of the tool.
const OLD_NAME =
  /(?<![-.\w])sitekit(?!\.config|-site|\w| (?:check|list|add|init|upgrade)\b|` command|:(?:theme|color-palette)\b)/gi;

describe("the name of the tool", () => {
  it("is docs-sitekit wherever a reader sees it", () => {
    const found = FILES.flatMap((file) =>
      read(file)
        .split("\n")
        .flatMap((line, index) =>
          line.match(OLD_NAME) ? [`${file}:${index + 1}: ${line.trim()}`] : [],
        ),
    );
    expect(found).toEqual([]);
  });

  it("is the name the footer of a generated site credits, linked to the microsite", () => {
    const layout = read("template/src/presentation/layouts/base-layout.astro");
    expect(layout).toContain('label: "docs-sitekit"');
    expect(layout).toContain('href: "https://miguelcolmenares.com/docs-sitekit/"');
    expect(layout).not.toContain('github.com/miguelcolmenares/docs-sitekit" }}');
  });
});
