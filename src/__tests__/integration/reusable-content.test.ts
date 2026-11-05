import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildDocuments,
  buildLlmsText,
  buildSearchIndex,
  publishedRoutes,
  validateContent,
} from "../../../template/src/application";
import { absoluteUrl, matchesAny, renderMarkdownPage } from "../../../template/src/domain";
import type { LinkContext } from "../../../template/src/domain";
import { loadSiteConfig, readSources } from "../../../template/src/infrastructure";

let repo: string;
let site: string;

const write = (path: string, content: string) => {
  const full = join(repo, path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
};

const writeConfig = (extra: Record<string, unknown> = {}) =>
  write(
    "site/sitekit.config.json",
    JSON.stringify({
      site: { name: "Demo", description: "d", url: "https://me.github.io", base: "/demo/" },
      hero: { title: "Demo", lede: "l", primary: { label: "Go", href: "/docs/" } },
      collections: [{ id: "docs", label: "Docs", dir: "../docs" }],
      llms: { enabled: true, markdownPages: true },
      vars: { package: "@demo/widget" },
      ...extra,
    }),
  );

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "sitekit-reusable-"));
  site = join(repo, "site");
  mkdirSync(site);
  write("package.json", JSON.stringify({ name: "@demo/widget", version: "4.5.6" }));
  write("snippets/requirements.md", "Needs Node 22 or newer to run {{ package }} {{ version }}.\n");
  write("snippets/steps.md", "1. Install it.\n\n2. Run it.\n");
  write("CHANGELOG.md", "# Changelog\n\n## 4.5.6\n\nFirst release.\n");
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

/** Each problem found while reading the files, as `file:line kind`, in the order the files are read. */
const issuesOf = (sources: ReturnType<typeof build>["sources"]) =>
  sources.files.flatMap((file) =>
    (file.reusableIssues ?? []).map((issue) => `${issue.file}:${issue.line} ${issue.kind}`),
  );

/** The same steps as `loadSite`, over the real loaders. */
function build() {
  const config = loadSiteConfig(site);
  const sources = readSources(site, config);
  const documents = buildDocuments(sources.files, {
    base: config.site.base,
    collections: config.collections,
  });
  return { config, sources, documents };
}

const START = [
  "---",
  "description: Notes for {{ version }}",
  "---",
  "",
  "# {{ package }} {{ version }}",
  "",
  "<!-- include: requirements.md -->",
  "",
  "Read [the {{ package }} notes](./other.md) and `{{ version }}` as written.",
  "",
  "1. Step one:",
  "   <!-- include: steps.md -->",
  "",
  "```md",
  "{{ version }}",
  "<!-- include: requirements.md -->",
  "```",
  "",
].join("\n");

describe("variables and snippets on real files", () => {
  beforeEach(() => {
    write("docs/start.md", START);
    write("docs/other.md", "# Other\n\nPlain page.\n");
    writeConfig();
  });

  it("read the version from package.json and the other variables from the config", () => {
    const start = build().sources.files.find((file) => file.path === "docs/start.md")!;
    expect(start.content).toContain("# @demo/widget 4.5.6");
    expect(start.content).toContain("Needs Node 22 or newer to run @demo/widget 4.5.6.");
    expect(start.frontmatter.description).toBe("Notes for 4.5.6");
  });

  it("keep the indentation of a snippet in a list item, and leave code as written", () => {
    const { content } = build().sources.files.find((file) => file.path === "docs/start.md")!;
    expect(content).toContain("1. Step one:\n   1. Install it.\n\n   2. Run it.\n");
    expect(content).toContain("`{{ version }}` as written.");
    expect(content).toContain("```md\n{{ version }}\n<!-- include: requirements.md -->\n```");
  });

  it("give the page the replaced title and description", () => {
    const start = build().documents.find((document) => document.path === "docs/start.md")!;
    expect(start.title).toBe("@demo/widget 4.5.6");
    expect(start.description).toBe("Notes for 4.5.6");
    expect(start.body).not.toContain("{{ package }} {{ version }}");
  });

  it("derive the description from a snippet or a variable in the first paragraph", () => {
    write("docs/derived.md", "# Derived\n\n<!-- include: requirements.md -->\n");
    const derived = build().documents.find((document) => document.slug === "derived")!;
    expect(derived.description).toBe("Needs Node 22 or newer to run @demo/widget 4.5.6.");
    expect(derived.descriptionSource).toBe("content");
  });

  it("show the replaced text in the search index", () => {
    const { documents, config } = build();
    const start = buildSearchIndex(documents, { collections: config.collections }).pages.find(
      (page) => page.url === "/demo/docs/start/",
    )!;
    expect(start.title).toBe("@demo/widget 4.5.6");
    expect(start.text).toContain("Needs Node 22 or newer to run @demo/widget 4.5.6.");
    expect(start.text).toContain("Install it.");
    // The code block shows the syntax, so it is in the index as written.
    expect(start.text).toContain("<!-- include: requirements.md -->");
  });

  it("show the replaced text in llms.txt and in the Markdown copy of the page", () => {
    const { documents, config, sources } = build();
    expect(buildLlmsText(config, documents)).toContain(
      "- [@demo/widget 4.5.6](https://me.github.io/demo/docs/start/): Notes for 4.5.6",
    );
    const published = publishedRoutes(documents);
    const document = documents.find((candidate) => candidate.path === "docs/start.md")!;
    const context: LinkContext = {
      file: document.path,
      published,
      existing: sources.existing,
      isExcluded: (path) => matchesAny(path, config.anonymize.excludePaths),
    };
    const copy = renderMarkdownPage(document, {
      context,
      origin: config.site.url,
      pageUrl: absoluteUrl(config.site.url, document.route),
    });
    expect(copy.startsWith("# @demo/widget 4.5.6\n")).toBe(true);
    expect(copy).toContain("Needs Node 22 or newer to run @demo/widget 4.5.6.");
    expect(copy).toContain("[the @demo/widget notes](https://me.github.io/demo/docs/other/)");
  });

  it("do not publish the snippets as pages, even when a collection contains them", () => {
    write("docs/snippets/inside.md", "# Inside\n\nNot a page.\n");
    writeConfig({ collections: [{ id: "docs", label: "Docs", dir: "../docs" }] });
    const slugs = build().documents.map((document) => document.slug);
    expect(slugs).not.toContain("requirements");
    expect(slugs).toContain("inside"); // only the snippets folder of the repository is special
  });

  it("let a vars entry win over the version of package.json, and site.version over the package", () => {
    writeConfig({ vars: { package: "@demo/widget", version: "next" } });
    expect(build().sources.files.find((f) => f.path === "docs/start.md")!.content).toContain(
      "# @demo/widget next",
    );
    writeConfig({
      site: { name: "D", description: "d", url: "https://me.github.io", version: "9.9.9" },
    });
    expect(build().sources.files.find((f) => f.path === "docs/start.md")!.content).toContain(
      "# @demo/widget 9.9.9",
    );
  });

  it("anonymize.replace applies to the expanded text, so a snippet cannot leak a replaced name", () => {
    write("snippets/client.md", "Built for Acme Corp.\n");
    write("docs/client.md", "# Client\n\n<!-- include: client.md -->\n");
    writeConfig({ anonymize: { replace: { "Acme Corp": "<client>" } } });
    const client = build().sources.files.find((file) => file.path === "docs/client.md")!;
    expect(client.content).toContain("Built for <client>.");
    expect(client.content).not.toContain("Acme");
  });
});

describe("problems", () => {
  beforeEach(() => writeConfig());

  it("a missing snippet is a snippets issue with the file and the line of the include", () => {
    write("docs/broken.md", "# Broken\n\nText.\n\n<!-- include: nope.md -->\n");
    const { sources } = build();
    const broken = sources.files.find((file) => file.path === "docs/broken.md")!;
    expect(broken.reusableIssues).toEqual([
      expect.objectContaining({
        kind: "snippets",
        file: "docs/broken.md",
        line: 5,
        message: expect.stringMatching(/^Snippet "nope\.md" was not found/),
      }),
    ]);
    // The include stays as written, so the page reads the same as the file.
    expect(broken.content).toContain("<!-- include: nope.md -->");
  });

  it("counts the lines of the frontmatter, so the line is the one in the file", () => {
    write(
      "docs/late.md",
      "---\ntitle: Late\norder: 2\n---\n\n# Late\n\n<!-- include: nope.md -->\n",
    );
    expect(issuesOf(build().sources)).toEqual(["docs/late.md:8 snippets"]);
  });

  it("a name that leaves the snippets folder is a missing snippet", () => {
    write("secret.md", "Do not include me.\n");
    write("docs/escape.md", "# Escape\n\n<!-- include: ../secret.md -->\n");
    const { sources } = build();
    const escape = sources.files.find((file) => file.path === "docs/escape.md")!;
    expect(escape.content).not.toContain("Do not include me.");
    expect(issuesOf(sources)).toEqual(["docs/escape.md:3 snippets"]);
  });

  it("an include inside a snippet is an issue in the snippet, at its line", () => {
    write("snippets/outer.md", "Outer.\n<!-- include: steps.md -->\n");
    write("docs/nested.md", "# Nested\n\n<!-- include: outer.md -->\n");
    expect(issuesOf(build().sources)).toEqual(["snippets/outer.md:2 snippets"]);
  });

  it("an unknown variable is an issue with the file and line, in a page, a snippet and the frontmatter", () => {
    write("snippets/ghost.md", "First.\nSecond {{ ghost }}.\n");
    write(
      "docs/warn.md",
      "---\ntitle: Warn {{ phantom }}\n---\n\n# Warn\n\nA {{ unknown }} here.\n\n<!-- include: ghost.md -->\n",
    );
    const { sources } = build();
    expect(issuesOf(sources)).toEqual([
      "docs/warn.md:2 variables",
      "docs/warn.md:7 variables",
      "snippets/ghost.md:2 variables",
    ]);
    // The text stays as written, so the page still builds.
    expect(sources.files.find((f) => f.path === "docs/warn.md")!.content).toContain(
      "{{ unknown }}",
    );
  });

  it("gives a finding after a snippet the line of the file, not the line of the expanded text", () => {
    write("docs/lines.md", "# Lines\n\n<!-- include: steps.md -->\n\n[gone](./missing.md)\n");
    const { config, sources, documents } = build();
    const findings = validateContent(sources.files, documents, {
      config,
      existing: sources.existing,
    });
    expect(findings).toContainEqual(
      expect.objectContaining({ kind: "links", file: "docs/lines.md", line: 5 }),
    );
  });

  it("is reported by validateContent with the severity of its kind, and off turns it off", () => {
    write("docs/broken.md", "# Broken\n\n<!-- include: nope.md -->\n<!-- include: nope.md -->\n");
    write("docs/ghost.md", "# Ghost\n\nA {{ ghost }}.\n");
    const kinds = (check: Record<string, string>) => {
      writeConfig({ check });
      const { config, sources, documents } = build();
      return validateContent(sources.files, documents, {
        config,
        existing: sources.existing,
      })
        .filter((finding) => finding.kind === "snippets" || finding.kind === "variables")
        .map((finding) => `${finding.file}:${finding.line} ${finding.kind} ${finding.severity}`);
    };
    expect(kinds({})).toEqual([
      "docs/broken.md:3 snippets error",
      "docs/broken.md:4 snippets error",
      "docs/ghost.md:3 variables warning",
    ]);
    expect(kinds({ snippets: "warning", variables: "off" })).toEqual([
      "docs/broken.md:3 snippets warning",
      "docs/broken.md:4 snippets warning",
    ]);
  });
});

describe("a site that does not use the features", () => {
  it("reads exactly the same content, with no warnings and no snippets folder needed", () => {
    rmSync(join(repo, "snippets"), { recursive: true });
    const plain =
      "---\ntitle: Plain\n---\n\n# Plain\r\n\r\nSome text with { braces } and `code`.\r\n";
    write("docs/plain.md", plain);
    writeConfig({ vars: undefined });
    const { sources } = build();
    const file = sources.files.find((candidate) => candidate.path === "docs/plain.md")!;
    expect(file.content).toBe("\n# Plain\r\n\r\nSome text with { braces } and `code`.\r\n");
    expect(file.frontmatter).toEqual({ title: "Plain" });
    expect(issuesOf(sources)).toEqual([]);
  });
});
