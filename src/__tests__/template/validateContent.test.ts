import { buildDocuments, validateContent } from "../../../template/src/application";
import { parseSiteConfig } from "../../../template/src/domain";
import type { SourceFile } from "../../../template/src/domain";

const config = (extra: Record<string, unknown> = {}, excludePaths: string[] = []) =>
  parseSiteConfig({
    site: {
      name: "W",
      description: "d",
      url: "https://me.github.io",
      repository: "https://github.com/me/widget",
    },
    hero: { title: "W", lede: "l", primary: { label: "Go", href: "/" } },
    anonymize: { excludePaths },
    ...extra,
  });

const file = (
  path: string,
  content: string,
  extra: Partial<SourceFile> = {},
  collection = "docs",
): SourceFile => ({
  path,
  collection,
  collectionPath: path.replace(/^docs\//, ""),
  frontmatter: {},
  content,
  ...extra,
});

function run(
  files: SourceFile[],
  options: { config?: Record<string, unknown>; exclude?: string[]; existing?: string[] } = {},
) {
  const documents = buildDocuments(files, { base: "/" });
  return validateContent(files, documents, {
    config: config(options.config, options.exclude),
    existing: new Set([...files.map((f) => f.path), ...(options.existing ?? [])]),
  });
}

const guide = file("docs/guide.md", "# Guide\n\n## Advanced\n\nText.\n");
const summary = (list: ReturnType<typeof run>) =>
  list.map((item) => `${item.file}:${item.line} ${item.severity} ${item.kind}`);

describe("validateContent: links", () => {
  it("reports a relative link to a file that does not exist, at its line, as a warning", () => {
    const page = file("docs/a.md", "# A\n\nText.\n\nSee [the page](./nope.md) here.\n");
    const found = run([page]);
    expect(summary(found)).toEqual(["docs/a.md:5 warning links"]);
    expect(found[0]!.message).toBe('Link "./nope.md" does not match any file');
  });

  it("reports a link that leaves the repository", () => {
    expect(summary(run([file("docs/a.md", "[x](../../outside.md)\n")]))).toEqual([
      "docs/a.md:1 warning links",
    ]);
  });

  it("reports a link to an excluded file, which keeps only its text", () => {
    const found = run([file("docs/a.md", "x\n\n[plan](./internal/plan.md)\n")], {
      exclude: ["docs/internal/**"],
      existing: ["docs/internal/plan.md"],
    });
    expect(summary(found)).toEqual(["docs/a.md:3 warning excludedLinks"]);
    expect(found[0]!.message).toMatch(/excluded file/);
  });

  it("finds every link on a line, and the one that is wrong among good ones", () => {
    const page = file(
      "docs/a.md",
      "[ok](./guide.md) and [bad](./gone.md) and [web](https://example.com)\n",
    );
    expect(summary(run([page, guide]))).toEqual(["docs/a.md:1 warning links"]);
  });

  it("reads a link whose label holds code", () => {
    expect(summary(run([file("docs/a.md", "[`run`](./gone.md)\n")]))).toEqual([
      "docs/a.md:1 warning links",
    ]);
  });

  it("does not report a web address, a mailto, a site path or a link to a repository file", () => {
    const page = file(
      "docs/a.md",
      "[a](https://x.dev) [b](mailto:me@x.dev) [c](/docs/other/) [d](../LICENSE)\n",
    );
    expect(run([page], { existing: ["LICENSE"] })).toEqual([]);
  });

  it("does not report a link that is a typo-free path with a query or encoded characters", () => {
    const page = file("docs/a.md", "[g](./guide.md?x=1) [s](./my%20page.md)\n");
    const spaced = file("docs/my page.md", "# My page\n");
    expect(run([page, guide, spaced])).toEqual([]);
  });
});

describe("validateContent: anchors", () => {
  it("reports a link to a heading that is not in the target page, at the link's line", () => {
    const page = file("docs/a.md", "# A\n\n[x](./guide.md#advanced) [y](./guide.md#nope)\n");
    const found = run([page, guide]);
    expect(summary(found)).toEqual(["docs/a.md:3 warning anchors"]);
    expect(found[0]!.message).toBe(
      'Link "./guide.md#nope" points to a heading that does not exist in docs/guide.md',
    );
  });

  it("reports an anchor in the same page, and accepts one that is there", () => {
    const page = file("docs/a.md", "# A\n\n## Setup\n\n[ok](#setup) [bad](#teardown)\n");
    expect(summary(run([page]))).toEqual(["docs/a.md:5 warning anchors"]);
  });

  it("numbers repeated headings the way the page does, so #setup-1 is the second Setup", () => {
    const target = file("docs/t.md", "# T\n\n## Setup\n\n## Setup\n");
    const page = file("docs/a.md", "[a](./t.md#setup) [b](./t.md#setup-1) [c](./t.md#setup-2)\n");
    expect(summary(run([page, target]))).toEqual([
      "docs/a.md:1 warning anchors",
      "docs/t.md:5 warning duplicateHeadings",
    ]);
  });

  it("does not count the title the page already shows as a heading you can link to", () => {
    const page = file("docs/a.md", "# Guide\n\nText.\n\n[x](./guide.md#guide)\n");
    expect(summary(run([page, guide]))).toEqual(["docs/a.md:5 warning anchors"]);
  });

  it("accepts an anchor made by HTML, the top of the page and an empty fragment", () => {
    const target = file("docs/t.md", '# T\n\n<a id="custom"></a>\n');
    const page = file("docs/a.md", "[a](./t.md#custom) [b](#top) [c](./t.md#)\n");
    expect(run([page, target])).toEqual([]);
  });

  it("does not check an anchor of a page that is not on the site, a draft or an excluded file", () => {
    const page = file("docs/a.md", "[a](./plan.md#whatever) [b](../NOTES.md#whatever)\n");
    expect(run([page], { existing: ["NOTES.md"] }).map((f) => f.kind)).toEqual(["links"]);
    expect(run([page], { existing: ["NOTES.md", "docs/plan.md"] })).toEqual([]);
  });

  it("matches the anchor of a heading with code, emphasis and punctuation in it", () => {
    const target = file("docs/t.md", "# T\n\n## The `check` option: **on**?\n");
    const page = file("docs/a.md", "[a](./t.md#the-check-option-on)\n");
    expect(run([page, target])).toEqual([]);
  });
});

describe("validateContent: images", () => {
  it("reports an image that does not exist as an error", () => {
    const page = file("docs/a.md", "# A\n\ntext\n\n![diagram](./img/flow.png)\n");
    const found = run([page]);
    expect(summary(found)).toEqual(["docs/a.md:5 error images"]);
    expect(found[0]!.message).toBe('Image "./img/flow.png" does not exist');
  });

  it("accepts an image that exists, one outside the folder, and a web or site-path image", () => {
    const page = file(
      "docs/a.md",
      "![a](./img/flow.png) ![b](../logo.svg) ![c](https://x.dev/c.png) ![d](/public/d.png) ![e](data:image/png;base64,AAAA)\n",
    );
    expect(run([page], { existing: ["docs/img/flow.png", "logo.svg"] })).toEqual([]);
  });

  it("reports an image that climbs out of the repository", () => {
    expect(summary(run([file("docs/a.md", "![x](../../../x.png)\n")]))).toEqual([
      "docs/a.md:1 error images",
    ]);
  });
});

describe("validateContent: frontmatter", () => {
  const withMatter = (matter: string, frontmatter: Record<string, unknown>) =>
    file("docs/a.md", "# A\n\ntext\n", { frontmatter, frontmatterText: matter, contentLine: 7 });

  it("reports a key the kit does not read, at its line, and suggests the one it was meant to be", () => {
    const found = run([withMatter("\ntitle: A\ntitel: B\n", { title: "A", titel: "B" })]);
    expect(summary(found)).toEqual(["docs/a.md:3 warning frontmatter"]);
    expect(found[0]!.message).toBe(
      'Frontmatter key "titel" is not one the kit reads (title, description, order, tags, meta, links). Did you mean "title"?',
    );
  });

  it("does not suggest anything for a key that is not close to one", () => {
    const found = run([withMatter("\nlayout: wide\n", { layout: "wide" })]);
    expect(found[0]!.message).not.toMatch(/Did you mean/);
  });

  it("reports an order that is not a number, as an error, at the line of the key", () => {
    const found = run([withMatter('\ntitle: A\norder: "2"\n', { title: "A", order: "2" })]);
    expect(summary(found)).toEqual(["docs/a.md:3 error order"]);
    expect(found[0]!.message).toMatch(/must be a number, and this is "2"/);
  });

  it("reports an empty order too, and accepts a number", () => {
    expect(run([withMatter("\norder:\n", { order: null })]).map((f) => f.kind)).toEqual(["order"]);
    expect(run([withMatter("\norder: 3\n", { order: 3 })])).toEqual([]);
  });

  it("falls back to line 1 when it cannot find the key in the text", () => {
    const found = run([file("docs/a.md", "# A\n", { frontmatter: { oops: 1 } })]);
    expect(found[0]!.line).toBe(1);
  });
});

describe("validateContent: side card", () => {
  const matter = [
    "",
    "meta:",
    "  - label: Version",
    '    value: "1"',
    "  - lable: License",
    "    value: MIT",
    "links:",
    "  - label: Guide",
    "    href: ./guide.md",
    "  - label: Gone",
    "    href: ./nope.md",
    "  - label: Bad",
    "    href: javascript:alert(1)",
    "",
  ].join("\n");
  const frontmatter = {
    meta: [
      { label: "Version", value: "1" },
      { lable: "License", value: "MIT" },
    ],
    links: [
      { label: "Guide", href: "./guide.md" },
      { label: "Gone", href: "./nope.md" },
      { label: "Bad", href: "javascript:alert(1)" },
    ],
  };
  const page = file("docs/a.md", "# A\n\ntext\n", {
    frontmatter,
    frontmatterText: matter,
    contentLine: 15,
  });

  it("reports an unknown key under meta, an unsafe link and a missing target, each at its line in the file", () => {
    const found = run([page, guide]);
    expect(summary(found)).toEqual([
      "docs/a.md:5 error card",
      "docs/a.md:5 error card",
      "docs/a.md:11 warning links",
      "docs/a.md:13 error card",
    ]);
    expect(found[0]!.message).toBe(
      'Item 2 of "meta" has the key "lable", which the card does not read. It takes "label" and "value".',
    );
    expect(found[1]!.message).toContain('needs "label" as text');
    expect(found[2]!.message).toBe('Card link "Gone": Link "./nope.md" does not match any file');
  });

  it("does not report meta and links as frontmatter keys the kit does not read", () => {
    const clean = file("docs/a.md", "# A\n", {
      frontmatter: {
        meta: [{ label: "A", value: "b" }],
        links: [{ label: "G", href: "./guide.md" }],
      },
      frontmatterText:
        "\nmeta:\n  - label: A\n    value: b\nlinks:\n  - label: G\n    href: ./guide.md\n",
    });
    expect(run([clean, guide])).toEqual([]);
  });

  it("reports a link of the card to an excluded file as excludedLinks, like the same link in the text", () => {
    const withLink = file("docs/a.md", "# A\n", {
      frontmatter: { links: [{ label: "Plan", href: "./internal/plan.md" }] },
      frontmatterText: "\nlinks:\n  - label: Plan\n    href: ./internal/plan.md\n",
    });
    const found = run([withLink], {
      exclude: ["docs/internal/**"],
      existing: ["docs/internal/plan.md"],
    });
    expect(summary(found)).toEqual(["docs/a.md:4 warning excludedLinks"]);
  });

  it("reports a meta that is not a list at the line of the key", () => {
    const flat = file("docs/a.md", "# A\n", {
      frontmatter: { title: "A", meta: "Version: 1" },
      frontmatterText: "\ntitle: A\nmeta: Version 1\n",
    });
    expect(summary(run([flat]))).toEqual(["docs/a.md:3 error card"]);
  });

  it("falls back to line 1 when the raw frontmatter is not there", () => {
    const bare = file("docs/a.md", "# A\n", {
      frontmatter: { meta: [{ lable: "A", value: "b" }] },
    });
    expect(run([bare]).map((item) => item.line)).toEqual([1, 1]);
  });

  it("follows check.card in the config: lowered to a warning, or not looked for when off", () => {
    expect(
      run([page, guide], { config: { check: { card: "warning" } } }).map((item) => item.severity),
    ).toEqual(["warning", "warning", "warning", "warning"]);
    expect(summary(run([page, guide], { config: { check: { card: "off" } } }))).toEqual([
      "docs/a.md:11 warning links",
    ]);
  });

  it("reports nothing for a page with a valid card", () => {
    const valid = file("docs/a.md", "# A\n", {
      frontmatter: {
        meta: [{ label: "A", value: "b" }],
        links: [{ label: "W", href: "https://example.com" }],
      },
    });
    expect(run([valid])).toEqual([]);
  });
});

describe("validateContent: headings", () => {
  it("reports a second heading that makes the same anchor, and where the first one is", () => {
    const page = file("docs/a.md", "# A\n\n## Usage\n\ntext\n\n## usage\n");
    const found = run([page]);
    expect(summary(found)).toEqual(["docs/a.md:7 warning duplicateHeadings"]);
    expect(found[0]!.message).toBe(
      'Heading "usage" makes the same anchor as the one on line 3, so its link is #usage-1',
    );
  });

  it("does not report a repeated heading in a changelog, where Added and Fixed come back by design", () => {
    const changelog = file(
      "CHANGELOG.md",
      "# Changelog\n\n## 2\n\n### Added\n\n## 1\n\n### Added\n",
      {},
      "changelog",
    );
    expect(run([changelog])).toEqual([]);
  });

  it("does not report a # comment inside a code block", () => {
    expect(run([file("docs/a.md", "# A\n\n```sh\n# run\n```\n\n```sh\n# run\n```\n")])).toEqual([]);
  });
});

describe("validateContent: callouts", () => {
  it("reports a marker that is not one of the five, at its line, because the quote stays plain", () => {
    const found = run([file("docs/a.md", "# A\n\ntext\n\n> [!NOTES]\n> Not a callout.\n")]);
    expect(summary(found)).toEqual(["docs/a.md:5 warning callouts"]);
    expect(found[0]!.message).toBe(
      '"[!NOTES]" is not a callout marker, so this stays a plain blockquote. The markers are [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]',
    );
  });

  it("accepts the five markers, in any case, and a marker inside a list item", () => {
    const text = [
      "> [!NOTE]",
      "> a",
      "",
      "> [!tip]",
      "> b",
      "",
      "- item",
      "  > [!CAUTION]",
      "  > c",
      "",
    ];
    expect(run([file("docs/a.md", text.join("\n"))])).toEqual([]);
  });

  it("reports only the first line of a quote, not the same text further down", () => {
    expect(run([file("docs/a.md", "> intro\n> [!NOTES]\n> more\n")])).toEqual([]);
  });
});

describe("validateContent: code is never reported", () => {
  const code = [
    "# A",
    "",
    "`[a](./gone.md)` and `![i](./gone.png)` and `[b](./guide.md#nope)`",
    "",
    "```md",
    "[a](./gone.md)",
    "![i](./gone.png)",
    "[b](#nope)",
    "> [!NOTES]",
    "## Heading",
    "## Heading",
    "```",
    "",
    "~~~",
    "[c](./gone.md)",
    "~~~",
    "",
    "> ```md",
    "> [d](./gone.md)",
    "> ```",
    "",
    "A `> [!NOTES]` span.",
    "",
  ].join("\n");

  it("finds nothing in code spans, fenced blocks or fenced blocks inside a quote", () => {
    expect(run([file("docs/a.md", code), guide])).toEqual([]);
  });

  it("reports the same links once they are outside the code, so the silence above is the rule", () => {
    const outside = code.replace(/```md|~~~|> ```md|> ```|```/g, "").replaceAll("`", "");
    expect(run([file("docs/a.md", outside), guide]).length).toBeGreaterThan(5);
  });
});

describe("validateContent: severity from the config", () => {
  const page = file("docs/a.md", "[x](./gone.md)\n\n![i](./gone.png)\n");

  it("uses the default of each kind", () => {
    expect(summary(run([page]))).toEqual(["docs/a.md:1 warning links", "docs/a.md:3 error images"]);
  });

  it("raises a kind to an error and lowers another to a warning", () => {
    expect(
      summary(run([page], { config: { check: { links: "error", images: "warning" } } })),
    ).toEqual(["docs/a.md:1 error links", "docs/a.md:3 warning images"]);
  });

  it("turns a kind off", () => {
    expect(summary(run([page], { config: { check: { images: "off" } } }))).toEqual([
      "docs/a.md:1 warning links",
    ]);
  });
});

describe("validateContent: lines", () => {
  it("counts from the line of the file where the content begins, not from the start of the content", () => {
    const page = file("docs/a.md", "\n# A\n\n[x](./gone.md)\n", { contentLine: 5 });
    expect(run([page])[0]!.line).toBe(8);
  });

  it("lists the findings by file, in the order of the files, and by line", () => {
    const first = file("docs/b.md", "[x](./gone.md)\n\n[y](./gone2.md)\n");
    const second = file("docs/a.md", "![i](./gone.png)\n");
    expect(summary(run([first, second]))).toEqual([
      "docs/b.md:1 warning links",
      "docs/b.md:3 warning links",
      "docs/a.md:1 error images",
    ]);
  });
});

describe("validateContent: a badge", () => {
  it("reads both the image and the link around it", () => {
    const page = file("docs/a.md", "[![build](./b.svg)](./ci.md)\n");
    expect(summary(run([page]))).toEqual(["docs/a.md:1 error images", "docs/a.md:1 warning links"]);
    expect(run([page], { existing: ["docs/b.svg", "docs/ci.md"] })).toEqual([]);
  });
});
