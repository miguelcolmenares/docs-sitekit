import {
  anchorHeadings,
  explicitAnchors,
  extractHeadings,
  slugify,
} from "../../../template/src/domain";

// Expected values come from github-slugger, the library the site's renderer gives its heading ids with.
describe("slugify", () => {
  it.each([
    ["Hello World", "hello-world"],
    ["the foo option", "the-foo-option"],
    ["A & B", "a--b"],
    ["API: v2.0", "api-v20"],
    ["Ünïcode ñ", "ünïcode-ñ"],
    ["日本語 text", "日本語-text"],
    ["snake_case_name", "snake_case_name"],
    ["What? Yes!", "what-yes"],
    ["1. Intro", "1-intro"],
    ["Café — au lait", "café--au-lait"],
    ["it's here", "its-here"],
    ["C++ and C#", "c-and-c"],
    ["Trailing-", "trailing-"],
  ])("%s becomes %s", (text, anchor) => {
    expect(slugify(text)).toBe(anchor);
  });
});

describe("extractHeadings", () => {
  it("reads # headings with their depth, line and plain text", () => {
    expect(extractHeadings("# One\n\ntext\n\n## The `two` **option** ##\n")).toEqual([
      { depth: 1, text: "One", index: 0 },
      { depth: 2, text: "The two option", index: 4 },
    ]);
  });

  it("reads underlined headings", () => {
    expect(extractHeadings("Title\n=====\n\ntext\n\nSub title\n---\n")).toEqual([
      { depth: 1, text: "Title", index: 0 },
      { depth: 2, text: "Sub title", index: 5 },
    ]);
  });

  it("never reads a heading in a fenced block, so a # comment in code is not one", () => {
    expect(extractHeadings("```bash\n# install it\n```\n\n## Real\n")).toEqual([
      { depth: 2, text: "Real", index: 4 },
    ]);
  });

  it("does not take a list, a quote, a table or a rule for an underlined heading", () => {
    expect(extractHeadings("- item\n---\n\n> quote\n---\n\n| a | b |\n---\n")).toEqual([]);
  });

  it("needs a space after the hashes", () => {
    expect(extractHeadings("#hashtag\n")).toEqual([]);
  });
});

describe("anchorHeadings", () => {
  it("numbers a repeated anchor the way the renderer does", () => {
    const anchors = anchorHeadings(extractHeadings("## Foo\n\n## Foo\n\n## Foo\n\n## foo-1\n")).map(
      (heading) => heading.anchor,
    );
    expect(anchors).toEqual(["foo", "foo-1", "foo-2", "foo-1-1"]);
  });

  it("says where the first heading with the same base is", () => {
    const [first, second] = anchorHeadings(extractHeadings("## Foo\n\ntext\n\n## Foo\n"));
    expect(first).toMatchObject({ base: "foo", firstIndex: null });
    expect(second).toMatchObject({ base: "foo", anchor: "foo-1", firstIndex: 0 });
  });
});

describe("explicitAnchors", () => {
  it("reads id and name attributes of HTML outside code", () => {
    expect(
      explicitAnchors(
        '<a id="setup"></a>\n<h2 id=\'usage\'>Use</h2>\n```html\n<a id="no"></a>\n```\n',
      ),
    ).toEqual(["setup", "usage"]);
  });
});
