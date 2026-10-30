import { buildDocuments, buildLlmsText } from "../../../template/src/application";
import { parseSiteConfig, llmsUrl, markdownPath, markdownUrl } from "../../../template/src/domain";
import type { SourceFile } from "../../../template/src/domain";

const file = (
  path: string,
  content: string,
  collection = "docs",
  collectionPath = path.replace(/^(docs|examples|tutorials)\//, ""),
): SourceFile => ({ path, collection, collectionPath, frontmatter: {}, content });

const config = (base: string, extra: Record<string, unknown> = {}) =>
  parseSiteConfig({
    site: {
      name: "Widget",
      description: "A widget for the web.",
      url: "https://me.github.io",
      base,
      repository: "https://github.com/me/widget",
      installCommand: "npm install widget",
    },
    hero: { title: "Widget", lede: "l", primary: { label: "Go", href: "/" } },
    collections: [
      { id: "docs", label: "Docs", dir: "../docs" },
      { id: "examples", label: "Examples", dir: "../examples" },
    ],
    llms: { enabled: true, optional: [], markdownPages: false },
    ...extra,
  });

const sources = [
  file("docs/start.md", "# Getting started\n\nInstall it and run it.\n"),
  file("docs/api.md", "# API\n\nEvery function.\n"),
  file("examples/basic/README.md", "# Basic example\n\nThe smallest page.\n", "examples"),
  file("CHANGELOG.md", "# Changelog\n\n## 1.0.0\n", "changelog", "CHANGELOG.md"),
];

const build = (site: ReturnType<typeof config>, files: SourceFile[] = sources) =>
  buildLlmsText(
    site,
    buildDocuments(files, { base: site.site.base, collections: site.collections }),
  );

describe("buildLlmsText structure", () => {
  it("starts with the H1 name, then the blockquote description", () => {
    const lines = build(config("/")).split("\n");
    expect(lines[0]).toBe("# Widget");
    expect(lines[2]).toBe("> A widget for the web.");
  });

  it("writes the install command and the repository in a detail paragraph", () => {
    expect(build(config("/"))).toContain(
      "Install: `npm install widget`. Repository: https://github.com/me/widget.",
    );
  });

  it("leaves the detail paragraph out when neither is set", () => {
    const bare = config("/", {
      site: {
        name: "Widget",
        description: "A widget.",
        url: "https://me.github.io",
      },
    });
    const text = build(bare);
    expect(text).toBe(
      [
        "# Widget",
        "",
        "> A widget.",
        "",
        "## Docs",
        "",
        "- [API](https://me.github.io/docs/api/): Every function.",
        "- [Getting started](https://me.github.io/docs/start/): Install it and run it.",
        "",
        "## Examples",
        "",
        "- [Basic example](https://me.github.io/examples/basic/): The smallest page.",
        "",
        "## Changelog",
        "",
        "- [Changelog](https://me.github.io/changelog/)",
        "",
      ].join("\n"),
    );
  });

  it("writes one H2 per collection, in the site's order, with the changelog last", () => {
    const headings = build(config("/"))
      .split("\n")
      .filter((line) => line.startsWith("## "));
    expect(headings).toEqual(["## Docs", "## Examples", "## Changelog"]);
  });

  it("omits the colon part for a page without a description", () => {
    const text = build(config("/"), [file("docs/bare.md", "# Bare")]);
    expect(text).toContain("- [Bare](https://me.github.io/docs/bare/)\n");
    expect(text).not.toContain("Bare](https://me.github.io/docs/bare/):");
  });

  it("ends with a single newline and has no Optional section when nothing is optional", () => {
    const text = build(config("/"));
    expect(text.endsWith("\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
    expect(text).not.toContain("## Optional");
  });
});

describe("buildLlmsText optional", () => {
  it("moves a collection named in llms.optional under Optional, and nowhere else", () => {
    const text = build(
      config("/", { llms: { enabled: true, optional: ["examples"], markdownPages: false } }),
    );
    expect(text).not.toContain("## Examples");
    const optional = text.slice(text.indexOf("## Optional"));
    expect(optional).toContain("- [Basic example](https://me.github.io/examples/basic/)");
    expect(text.match(/Basic example/g)).toHaveLength(1);
  });

  it("puts Optional last, after the changelog", () => {
    const text = build(
      config("/", { llms: { enabled: true, optional: ["examples"], markdownPages: false } }),
    );
    const headings = text.split("\n").filter((line) => line.startsWith("## "));
    expect(headings).toEqual(["## Docs", "## Changelog", "## Optional"]);
  });
});

describe("buildLlmsText absolute addresses", () => {
  it("builds every address from site.url and the base, for a project site", () => {
    const text = build(config("/widget/"));
    expect(text).toContain("](https://me.github.io/widget/docs/start/)");
    expect(text).toContain("](https://me.github.io/widget/changelog/)");
    expect(text).not.toMatch(/\]\(\//);
  });

  it("builds the same addresses for a site at the root", () => {
    const text = build(config("/"));
    expect(text).toContain("](https://me.github.io/docs/start/)");
    expect(text).not.toContain("/widget/");
  });

  it("does not double the slash when site.url ends with one", () => {
    const text = build(
      config("/", { site: { name: "W", description: "d", url: "https://me.github.io/" } }),
    );
    expect(text).toContain("](https://me.github.io/docs/start/)");
  });
});

describe("buildLlmsText descriptions taken from the pages", () => {
  it("uses the title and description the pages derive, not the raw markdown", () => {
    const text = build(config("/"), [
      file(
        "docs/badges.md",
        "[![ci](https://img.test/ci.svg)](https://ci.test)\n\n# Real title\n\nThe real summary.\n\n```bash\n# not a title\n```\n",
      ),
    ]);
    expect(text).toContain("- [Real title](https://me.github.io/docs/badges/): The real summary.");
  });

  it("keeps a bracket in a title from breaking the link", () => {
    const text = build(config("/"), [file("docs/brackets.md", "# Use [brackets]\n\nText.")]);
    expect(text).toContain("- [Use \\[brackets\\]](https://me.github.io/docs/brackets/): Text.");
  });
});

describe("markdown and llms addresses", () => {
  it("names the Markdown copy of a directory page index.html.md under the base", () => {
    expect(markdownPath("/widget/docs/start/", "/widget/")).toBe("docs/start/index.html.md");
    expect(markdownPath("/docs/start/", "/")).toBe("docs/start/index.html.md");
    expect(markdownUrl("https://me.github.io", "/widget/docs/start/")).toBe(
      "https://me.github.io/widget/docs/start/index.html.md",
    );
  });

  it("gives the llms.txt address at the base", () => {
    expect(llmsUrl("https://me.github.io", "/widget/")).toBe(
      "https://me.github.io/widget/llms.txt",
    );
    expect(llmsUrl("https://me.github.io", "/")).toBe("https://me.github.io/llms.txt");
  });
});
