import {
  dropLeadingTitle,
  extractDescription,
  extractTitle,
  humanize,
  plainText,
} from "../../../template/src/domain";

describe("plainText", () => {
  it("removes code marks, links, emphasis, images and HTML", () => {
    expect(
      plainText("Use `npx foo` and **bold** with [a link](./x.md) <b>now</b> ![img](a.png)"),
    ).toBe("Use npx foo and bold with a link now");
  });

  it("leaves no tag behind when one tag is nested inside another", () => {
    const text = plainText("a <<script>script>alert(1)<</script>/script> b");
    expect(text).not.toContain("<script");
    expect(text).not.toContain("</script");
  });
});

describe("extractTitle", () => {
  it("takes the first level-one heading as plain text", () => {
    expect(extractTitle("# `/convert` command\n\ntext", "fallback")).toBe("/convert command");
  });

  it("ignores a # comment inside a fenced block", () => {
    const md = "```bash\n# install the thing\nnpm i\n```\n\n# Real title\n";
    expect(extractTitle(md, "fallback")).toBe("Real title");
  });

  it("falls back when there is no heading", () => {
    expect(extractTitle("just text", "fallback")).toBe("fallback");
  });
});

describe("extractDescription", () => {
  it("returns the first paragraph of prose", () => {
    expect(extractDescription("# Title\n\nFirst paragraph\nacross two lines.\n\nSecond.")).toBe(
      "First paragraph across two lines.",
    );
  });

  it("tells a long run of badge-like text from a badge row without backtracking", () => {
    const hostile = `![]()${" ![]()".repeat(5000)} x`;
    const started = Date.now();
    expect(extractDescription(`# T\n\n${hostile}`)).toContain("x");
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("skips a row of badges", () => {
    const md = "# T\n\n[![CI](a.svg)](x) [![npm](b.svg)](y)\n\nThe real description.";
    expect(extractDescription(md)).toBe("The real description.");
  });

  it("skips tables, lists, quotes, HTML and code fences", () => {
    const md =
      "# T\n\n| a | b |\n|---|---|\n\n- item\n\n> quote\n\n<div>html</div>\n\n```\ncode line\n```\n\nProse wins.";
    expect(extractDescription(md)).toBe("Prose wins.");
  });

  it("never uses a line of code when the file opens with a fence", () => {
    expect(extractDescription("```\nnpm install\n```\n\nAfter the fence.")).toBe(
      "After the fence.",
    );
  });

  it("returns plain text, not markdown", () => {
    expect(extractDescription("Run `foo` from [docs](./d.md).")).toBe("Run foo from docs.");
  });

  it("cuts a long paragraph at a word boundary with an ellipsis", () => {
    const long = "word ".repeat(80).trim();
    const result = extractDescription(long, 60);
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toMatch(/wor…$/);
  });

  it("returns an empty string when there is no prose", () => {
    expect(extractDescription("# Only a title")).toBe("");
  });
});

describe("dropLeadingTitle", () => {
  it("removes a heading that repeats the title", () => {
    expect(dropLeadingTitle("# My page\n\nBody", "My page")).toBe("Body");
  });

  it("keeps a heading that differs from the title", () => {
    expect(dropLeadingTitle("# Other\n\nBody", "My page")).toBe("# Other\n\nBody");
  });
});

describe("humanize", () => {
  it("turns a slug or file name into a label", () => {
    expect(humanize("getting-started")).toBe("Getting started");
    expect(humanize("design_tokens.md")).toBe("Design tokens");
  });
});
