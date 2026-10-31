import { fencedCode } from "../../../template/src/examples/host/fence";

describe("fencedCode", () => {
  it("wraps the code in a fence with the language and the title, and keeps the code as it is", () => {
    const code = "---\nconst a = 1;\n---\n\n<A />\n";
    expect(fencedCode(code, { lang: "astro", title: "src/examples/a/example.astro" })).toBe(
      '```astro title="src/examples/a/example.astro"\n---\nconst a = 1;\n---\n\n<A />\n```\n',
    );
  });

  it("uses a fence longer than any run of backticks in the code, so the code cannot end the block", () => {
    const code = "```ts\nlet a;\n```\n";
    const fenced = fencedCode(code, { lang: "markdown" });
    expect(fenced.startsWith("````markdown\n")).toBe(true);
    expect(fenced.endsWith("\n````\n")).toBe(true);
  });

  it("leaves a quote of the title out, because the title cannot hold the quote that opens it", () => {
    expect(fencedCode("x", { lang: "ts", title: 'a "b"' })).toContain("title=\"a 'b'\"");
  });

  it("writes no title when there is none", () => {
    expect(fencedCode("x", { lang: "ts" })).toBe("```ts\nx\n```\n");
  });
});
