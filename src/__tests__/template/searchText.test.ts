import { createSlugger, extractSearchableText } from "../../../template/src/domain";

describe("createSlugger", () => {
  it("makes the anchor the rendered page gives a heading", () => {
    const slug = createSlugger();
    expect(slug("Getting started")).toBe("getting-started");
    expect(slug("Use `npm ci`, then build!")).toBe("use-npm-ci-then-build");
    expect(slug("Config: the search key")).toBe("config-the-search-key");
  });

  it("numbers a repeated heading the way the slugger does", () => {
    const slug = createSlugger();
    expect([slug("Install"), slug("Install"), slug("Install")]).toEqual([
      "install",
      "install-1",
      "install-2",
    ]);
  });

  it("keeps letters outside ASCII and gives an empty anchor when nothing is left", () => {
    const slug = createSlugger();
    expect(slug("Configuración")).toBe("configuración");
    expect(slug("!!!")).toBe("");
  });
});

describe("extractSearchableText headings", () => {
  it("lists ATX headings in order, with their anchors and the offset of their text", () => {
    const { text, headings } = extractSearchableText(
      "Intro words.\n\n## Install\n\nRun it.\n\n### Options\n",
    );
    expect(headings.map((heading) => [heading.text, heading.id])).toEqual([
      ["Install", "install"],
      ["Options", "options"],
    ]);
    expect(text.slice(headings[0]!.offset).startsWith("Install")).toBe(true);
    expect(text.slice(headings[1]!.offset).startsWith("Options")).toBe(true);
  });

  it("drops a closing run of hashes and the inline markup of a heading", () => {
    const { headings } = extractSearchableText("## The `search` key ##\n\n# [Guide](guide.md)\n");
    expect(headings.map((heading) => heading.text)).toEqual(["The search key", "Guide"]);
    expect(headings.map((heading) => heading.id)).toEqual(["the-search-key", "guide"]);
  });

  it("reads setext headings, which an underline makes", () => {
    const { headings } = extractSearchableText("Title here\n==========\n\nSub\n---\n\nText.");
    expect(headings.map((heading) => [heading.text, heading.id])).toEqual([
      ["Title here", "title-here"],
      ["Sub", "sub"],
    ]);
  });

  it("gives a repeated heading the anchor the page gives it", () => {
    const { headings } = extractSearchableText("## Usage\n\n## Usage\n");
    expect(headings.map((heading) => heading.id)).toEqual(["usage", "usage-1"]);
  });

  it("does not take a hash line inside a fence for a heading", () => {
    const markdown = "## Real\n\n```bash\n# install the tools\nnpm ci\n```\n\n## Next\n";
    const { text, headings } = extractSearchableText(markdown);
    expect(headings.map((heading) => heading.text)).toEqual(["Real", "Next"]);
    expect(text).toContain("# install the tools");
  });

  it("keeps a tilde fence closed only by the same character", () => {
    const markdown = "~~~\n```\n## inside\n~~~\n\n## after\n";
    expect(extractSearchableText(markdown).headings.map((heading) => heading.text)).toEqual([
      "after",
    ]);
  });

  it("gives a heading with no letter an empty anchor, so it is listed but not linked", () => {
    const { headings } = extractSearchableText("## ???\n");
    expect(headings).toEqual([expect.objectContaining({ text: "???", id: "" })]);
  });
});

describe("extractSearchableText body text", () => {
  it("keeps the words of links and drops the URL", () => {
    const { text } = extractSearchableText("See [the guide](guide.md) and ![logo](logo.png).");
    expect(text).toBe("See the guide and logo.");
  });

  it("keeps code, because readers search for commands", () => {
    const { text } = extractSearchableText(
      "Run `npm ci` first.\n\n```bash\nnpm run build:tokens\n```\n",
    );
    expect(text).toContain("Run npm ci first.");
    expect(text).toContain("npm run build:tokens");
    expect(text).not.toContain("```");
  });

  it("removes emphasis and HTML, but keeps underscores inside words", () => {
    const { text } = extractSearchableText(
      "A **bold** and _soft_ word, <kbd>Ctrl</kbd> with `user_name`.",
    );
    expect(text).toBe("A bold and soft word, Ctrl with user_name.");
  });

  it("keeps the words of a list item and of a table row, without the pipes", () => {
    const { text } = extractSearchableText(
      "- first item\n1. second\n\n| Key | Meaning |\n| --- | --- |\n| `enabled` | on |\n",
    );
    expect(text.split("\n")).toEqual(["first item", "second", "Key Meaning", "enabled on"]);
  });

  it("skips reference definitions and HTML comments", () => {
    const { text } = extractSearchableText(
      "[ref]: https://example.com\n\nVisible <!-- hidden --> words.",
    );
    expect(text).toBe("Visible words.");
  });

  it("returns an empty text for an empty body", () => {
    expect(extractSearchableText("")).toEqual({ text: "", headings: [] });
  });
});
