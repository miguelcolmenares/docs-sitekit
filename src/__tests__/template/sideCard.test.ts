import { createRequire } from "node:module";
import { join } from "node:path";
import { cardProblemLine, readSideCard, resolveCardLinks } from "../../../template/src/domain";
import type { CardProblem, LinkContext } from "../../../template/src/domain";
import {
  SIDE_CARD_VISIBLE_ROWS,
  SideCard,
  sideCardHasMore,
} from "../../../template/src/presentation/components/site/SideCard";

// react-dom lives in the template, which has its own dependencies. The component is a plain
// function of its props, so it is called directly and its element is rendered to markup.
const requireFromTemplate = createRequire(
  join(__dirname, "..", "..", "..", "template", "package.json"),
);
const { renderToStaticMarkup } = requireFromTemplate("react-dom/server") as {
  renderToStaticMarkup: (element: unknown) => string;
};

describe("readSideCard", () => {
  it("reads meta, links and tags from the frontmatter", () => {
    const { card, problems } = readSideCard({
      meta: [
        { label: "Version", value: "1.2.0" },
        { label: "License", value: "MIT" },
      ],
      links: [{ label: "Repository", href: "https://github.com/me/proj" }],
      tags: ["Plugin", "plugin", "Forms"],
    });
    expect(problems).toEqual([]);
    expect(card).toEqual({
      rows: [
        { label: "Version", value: "1.2.0" },
        { label: "License", value: "MIT" },
      ],
      links: [{ label: "Repository", href: "https://github.com/me/proj", item: 0 }],
      tags: ["Plugin", "Forms"],
    });
  });

  it("has no card without meta or links, so a page with only tags looks as it did", () => {
    expect(readSideCard({}).card).toBeNull();
    expect(readSideCard({ tags: ["UI"] })).toEqual({ card: null, problems: [] });
    expect(readSideCard({ meta: [], links: [] }).card).toBeNull();
  });

  it("has a card with only links, and one with only rows", () => {
    expect(readSideCard({ links: [{ label: "A", href: "./a.md" }] }).card?.rows).toEqual([]);
    expect(readSideCard({ meta: [{ label: "A", value: "b" }] }).card?.links).toEqual([]);
  });

  it("trims the text of a label and a value", () => {
    const { card } = readSideCard({ meta: [{ label: "  License ", value: " MIT\n" }] });
    expect(card?.rows).toEqual([{ label: "License", value: "MIT" }]);
  });

  it("reports a key it does not know, names it and the item, and keeps the item", () => {
    const { card, problems } = readSideCard({
      meta: [
        { label: "Version", value: "1", extra: "x" },
        { lable: "License", value: "MIT" },
      ],
    });
    expect(card?.rows).toEqual([{ label: "Version", value: "1" }]);
    expect(problems).toEqual([
      expect.objectContaining({ field: "meta", index: 0, key: "extra" }),
      expect.objectContaining({ field: "meta", index: 1, key: "lable" }),
      expect.objectContaining({ field: "meta", index: 1, key: null }),
    ]);
    expect(problems[0]!.message).toContain('"extra"');
    expect(problems[2]!.message).toContain('needs "label" as text');
  });

  it("drops an item without a text for one of its keys, and says to quote a number", () => {
    const { card, problems } = readSideCard({
      meta: [{ label: "Version", value: 1.2 }, { label: "", value: "x" }, "plain", null],
    });
    expect(card).toBeNull();
    expect(problems).toHaveLength(4);
    expect(problems[0]!.message).toContain("Write it in quotes");
    expect(problems[1]!.message).not.toContain("quotes");
    expect(problems.map((problem) => problem.index)).toEqual([0, 1, 2, 3]);
  });

  it("reports a key that is not a list", () => {
    const { card, problems } = readSideCard({ meta: "Version: 1", links: { label: "a" } });
    expect(card).toBeNull();
    expect(problems.map((problem) => [problem.field, problem.index])).toEqual([
      ["meta", null],
      ["links", null],
    ]);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,x",
    "vbscript:x",
    "//cdn.test/x",
    "JavaScript:1",
  ])("leaves out a link with %s and reports it", (href) => {
    const { card, problems } = readSideCard({
      meta: [{ label: "A", value: "b" }],
      links: [
        { label: "Bad", href },
        { label: "Good", href: "https://example.com" },
      ],
    });
    expect(card?.links).toEqual([{ label: "Good", href: "https://example.com", item: 1 }]);
    expect(problems).toEqual([
      expect.objectContaining({ kind: "card", field: "links", index: 0, key: "href" }),
    ]);
  });

  it("reports a problem at the place of the item in the list of the frontmatter, not among the valid ones", () => {
    const { card, problems } = readSideCard({
      links: [
        { label: "No address" },
        { label: "Good", href: "./a.md" },
        { label: "Bad", href: "javascript:x" },
      ],
    });
    expect(problems.map((problem) => problem.index)).toEqual([0, 2]);
    expect(card?.links).toEqual([{ label: "Good", href: "./a.md", item: 1 }]);
  });

  it("gives every problem the kind `card`", () => {
    const { problems } = readSideCard({ meta: "x", links: [{ lable: "a", href: "b" }] });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.every((problem) => problem.kind === "card")).toBe(true);
  });

  it.each(["mailto:me@x.dev", "http://a.test", "../LICENSE", "./a.md#top", "#anchor"])(
    "accepts %s as a link",
    (href) => {
      const { card, problems } = readSideCard({ links: [{ label: "L", href }] });
      expect(problems).toEqual([]);
      expect(card?.links).toEqual([{ label: "L", href, item: 0 }]);
    },
  );
});

describe("resolveCardLinks", () => {
  const context: LinkContext = {
    file: "docs/widget.md",
    published: new Map([["docs/guide.md", "/proj/docs/guide/"]]),
    existing: new Set(["docs/guide.md", "LICENSE", "docs/secret.md"]),
    isExcluded: (path) => path === "docs/secret.md",
    repositoryUrl: "https://github.com/me/proj",
  };
  const card = (...hrefs: string[]) => ({
    rows: [],
    links: hrefs.map((href, index) => ({ label: `L${index}`, href, item: index })),
    tags: ["T"],
  });

  it("turns a page into its route, a file into its repository address, and leaves an address", () => {
    const result = resolveCardLinks(
      card("./guide.md", "../LICENSE", "https://example.com"),
      context,
    );
    expect(result.problems).toEqual([]);
    expect(result.card?.links.map((link) => link.href)).toEqual([
      "/proj/docs/guide/",
      "https://github.com/me/proj/blob/HEAD/LICENSE",
      "https://example.com",
    ]);
    expect(result.card?.tags).toEqual(["T"]);
  });

  it("drops a link to a missing file and one to an excluded file, and reports each as the kind the same link in the text has", () => {
    const result = resolveCardLinks(card("./nope.md", "./secret.md", "./guide.md"), context);
    expect(result.card?.links.map((link) => link.href)).toEqual(["/proj/docs/guide/"]);
    expect(result.problems).toEqual([
      expect.objectContaining({ kind: "links", field: "links", index: 0, key: "href" }),
      expect.objectContaining({ kind: "excludedLinks", field: "links", index: 1, key: "href" }),
    ]);
    expect(result.problems[0]!.message).toBe(
      'Card link "L0": Link "./nope.md" does not match any file',
    );
  });

  it("drops the whole card when no row and no link is left", () => {
    expect(resolveCardLinks(card("./nope.md"), context).card).toBeNull();
  });

  it("keeps a card whose links are gone but whose rows are not", () => {
    const withRow = { ...card("./nope.md"), rows: [{ label: "A", value: "b" }] };
    expect(resolveCardLinks(withRow, context).card?.links).toEqual([]);
  });
});

describe("cardProblemLine", () => {
  const matter = [
    "",
    "title: Widget",
    "meta:",
    "  - label: Version",
    '    value: "1"',
    "  - lable: License",
    "    value: MIT",
    "links:",
    "- label: Guide",
    "  href: ./guide.md",
    "-   label: Other",
    "    href: javascript:x",
    "tags: [A]",
    "",
  ].join("\n");
  const problem = (over: Partial<CardProblem>): CardProblem => ({
    kind: "card",
    field: "meta",
    index: null,
    key: null,
    message: "m",
    ...over,
  });

  it("points at the line of the key, counting the opening `---` as line 1", () => {
    expect(cardProblemLine(matter, problem({ index: 1, key: "lable" }))).toBe(6);
    expect(cardProblemLine(matter, problem({ field: "links", index: 1, key: "href" }))).toBe(12);
  });

  it("points at the item when the key is not found, and at the field when there is no item", () => {
    expect(cardProblemLine(matter, problem({ index: 1, key: "missing" }))).toBe(6);
    expect(cardProblemLine(matter, problem({ index: 1 }))).toBe(6);
    expect(cardProblemLine(matter, problem({ field: "links" }))).toBe(8);
    expect(cardProblemLine(matter, problem({}))).toBe(3);
  });

  it("reads a list whose dashes are not indented, and does not run into the next key", () => {
    expect(cardProblemLine(matter, problem({ field: "links", index: 0, key: "href" }))).toBe(10);
    expect(cardProblemLine(matter, problem({ field: "links", index: 5, key: "href" }))).toBe(8);
  });

  it("falls back to line 1 when the text has no such key, such as a list written in flow style", () => {
    expect(cardProblemLine("\ntitle: A\n", problem({ index: 0, key: "label" }))).toBe(1);
    expect(cardProblemLine("", problem({}))).toBe(1);
    expect(cardProblemLine("\nmeta: [{ lable: a }]\n", problem({ index: 0, key: "lable" }))).toBe(
      2,
    );
  });

  it("matches a quoted key, and a key with characters a pattern would read", () => {
    const quoted = '\nmeta:\n  - "label": a\n    "va.ue": b\n';
    expect(cardProblemLine(quoted, problem({ index: 0, key: "va.ue" }))).toBe(4);
    expect(cardProblemLine(quoted, problem({ index: 0, key: "vaXue" }))).toBe(3);
  });
});

describe("SideCard", () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({
    label: `Label ${index + 1}`,
    value: `Value ${index + 1}`,
  }));
  const render = (props: Partial<Parameters<typeof SideCard>[0]> = {}) =>
    renderToStaticMarkup(SideCard({ rows, ...props }));

  it("is a named complementary region with a description list, a term and a description per row", () => {
    const html = render();
    expect(html).toMatch(/^<aside aria-label="Details"/);
    expect(html.match(/<dl\b/g)).toHaveLength(1);
    expect(html.match(/<dt\b/g)).toHaveLength(5);
    expect(html.match(/<dd\b/g)).toHaveLength(5);
    expect(html).toMatch(/<dt[^>]*>Label 1<\/dt><dd[^>]*>Value 1<\/dd>/);
  });

  it("marks the rows after the first three as extra, and only them", () => {
    const html = render();
    expect(SIDE_CARD_VISIBLE_ROWS).toBe(3);
    expect(html.match(/ data-extra=/g)).toHaveLength(2);
    expect(html).toMatch(/data-extra=""[^>]*><dt[^>]*>Label 4/);
    expect(html).not.toMatch(/data-extra=""[^>]*><dt[^>]*>Label 3/);
  });

  it("renders real links and tags in named lists, both extra on a phone", () => {
    const html = render({
      links: [{ label: "Repository", href: "https://github.com/me/proj" }],
      tags: ["Plugin", "Forms"],
    });
    expect(html).toMatch(/<a href="https:\/\/github.com\/me\/proj"[^>]*>Repository<\/a>/);
    expect(html).toMatch(/<ul data-extra="[^"]*" aria-label="Links"/);
    expect(html).toMatch(/<ul data-extra="[^"]*" aria-label="Tags"/);
    expect(html.match(/<li\b/g)).toHaveLength(3);
  });

  it("has a collapsed, hidden toggle button of at least 44 px when there is more to show", () => {
    const html = render();
    const button = /<button\b[^>]*>/.exec(html)?.[0] ?? "";
    expect(button).toContain('aria-expanded="false"');
    expect(button).toContain("hidden");
    expect(button).toContain("min-h-11");
    expect(button).toContain("lg:hidden");
    expect(button).toContain('type="button"');
  });

  it("has no button when everything already fits", () => {
    expect(render({ rows: rows.slice(0, 3) })).not.toContain("<button");
    expect(sideCardHasMore({ rows: rows.slice(0, 3), links: [], tags: [] })).toBe(false);
    expect(sideCardHasMore({ rows: rows.slice(0, 3), links: [], tags: ["a"] })).toBe(true);
    expect(sideCardHasMore({ rows, links: [], tags: [] })).toBe(true);
  });

  it("lets a long value wrap, makes links 44 px, and sticks on a desktop", () => {
    const html = render({ links: [{ label: "L", href: "/x/" }] });
    expect(html).toContain("wrap-anywhere");
    expect(html).toContain("min-h-11");
    expect(html).toContain("lg:sticky");
    expect(html).toContain("min-w-0");
  });

  it("escapes text instead of injecting it", () => {
    const html = render({ rows: [{ label: "<i>x</i>", value: "a & b" }] });
    expect(html).toContain("&lt;i&gt;x&lt;/i&gt;");
    expect(html).toContain("a &amp; b");
  });

  it("uses the tokens only: no raw colors and no shadows", () => {
    const html = render({ links: [{ label: "L", href: "/x/" }], tags: ["T"] });
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|shadow/i);
    expect(html).not.toMatch(/\b(text|bg|border)-(success|warn|danger|destructive)\b/);
  });

  it("takes a custom label for its region", () => {
    expect(render({ label: "About the package" })).toContain('aria-label="About the package"');
  });
});
