import {
  inlineLinks,
  maskInlineCode,
  proseLines,
  replaceInlineLinks,
  splitInlineCode,
} from "../../../template/src/domain";

describe("proseLines", () => {
  it("marks the fence lines and everything between them", () => {
    const lines = proseLines("text\n```ts\n[a](b.md)\n```\nafter");
    expect(lines.map((line) => line.fenced)).toEqual([false, true, true, true, false]);
    expect(lines.map((line) => line.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it("closes a fence only with the same character and at least as many of them", () => {
    const lines = proseLines("````\n```\nstill code\n````\nprose\n~~~\n````\n~~~\nprose");
    expect(lines.map((line) => line.fenced)).toEqual([
      true,
      true,
      true,
      true,
      false,
      true,
      true,
      true,
      false,
    ]);
  });

  it("sees a fence inside a blockquote and inside a list item", () => {
    const lines = proseLines("> ```ts\n> [a](b.md)\n> ```\n- item\n  ```\n  code\n  ```\nprose");
    expect(lines.map((line) => line.fenced)).toEqual([
      true,
      true,
      true,
      false,
      true,
      true,
      true,
      false,
    ]);
  });

  it("reads Windows line endings", () => {
    expect(proseLines("a\r\n```\r\nb\r\n```").map((line) => line.fenced)).toEqual([
      false,
      true,
      true,
      true,
    ]);
  });
});

describe("splitInlineCode", () => {
  it("separates prose from code spans, backticks included", () => {
    expect(splitInlineCode("a `b` c")).toEqual([
      { text: "a ", code: false },
      { text: "`b`", code: true },
      { text: " c", code: false },
    ]);
  });

  it("closes a span at a run of the same length", () => {
    expect(splitInlineCode("x ``a ` b`` y")).toEqual([
      { text: "x ", code: false },
      { text: "``a ` b``", code: true },
      { text: " y", code: false },
    ]);
  });

  it("keeps a run of backticks with no partner as text", () => {
    expect(splitInlineCode("a ` b")).toEqual([{ text: "a ` b", code: false }]);
  });
});

describe("maskInlineCode", () => {
  it("keeps every position and hides what is in a code span", () => {
    const line = "[`run`](./cli.md) and `[x](./y.md)`";
    const masked = maskInlineCode(line);
    expect(masked).toHaveLength(line.length);
    expect(inlineLinks(masked).map((link) => link.href)).toEqual(["./cli.md"]);
  });
});

describe("inlineLinks", () => {
  it("reads links and images, with their title", () => {
    expect(inlineLinks('See [guide](./g.md "Title") and ![alt](./a.png).')).toEqual([
      { image: false, label: "guide", href: "./g.md", title: ' "Title"' },
      { image: true, label: "alt", href: "./a.png", title: "" },
    ]);
  });

  it("replaces each link with what the callback returns", () => {
    expect(replaceInlineLinks("a [x](./y.md) b", (link) => `<${link.href}>`)).toBe("a <./y.md> b");
  });
});

describe("inlineLinks with an image in the label", () => {
  it("reads a badge as one link that holds an image", () => {
    expect(inlineLinks("[![build](./b.svg)](./ci.md)")).toEqual([
      { image: false, label: "![build](./b.svg)", href: "./ci.md", title: "" },
    ]);
  });

  it("does not take a long run of unfinished images for a reason to slow down", () => {
    const start = Date.now();
    inlineLinks(`[${"![a](".repeat(5000)}`);
    inlineLinks(`${"![[".repeat(5000)}(x)`);
    expect(Date.now() - start).toBeLessThan(1000);
  });
});
