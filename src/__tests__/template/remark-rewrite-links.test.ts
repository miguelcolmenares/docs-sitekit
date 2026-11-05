import { remarkRewriteLinks } from "../../../template/src/infrastructure";
import type { LinkContext } from "../../../template/src/domain";

const context: LinkContext = {
  file: "docs/a.md",
  published: new Map([["docs/b.md", "/docs/b/"]]),
  existing: new Set(["docs/b.md", "docs/secret.md"]),
  isExcluded: (path) => path === "docs/secret.md",
};

const link = (url: string, text = "label") => ({
  type: "link",
  url,
  children: [{ type: "text", value: text }],
});
const tree = (...children: unknown[]) => ({ type: "root", children }) as never;

function run(root: ReturnType<typeof tree>, warnings: string[] = []) {
  remarkRewriteLinks({ context, base: "/", onWarning: (m) => warnings.push(m) })(root);
  return root as { children: Array<Record<string, unknown>> };
}

describe("remarkRewriteLinks", () => {
  it("rewrites a link to a published document", () => {
    const result = run(tree({ type: "paragraph", children: [link("./b.md#x")] }));
    const paragraph = result.children[0] as { children: Array<{ url: string }> };
    expect(paragraph.children[0]!.url).toBe("/docs/b/#x");
  });

  it("replaces a link to an excluded file with its text and warns", () => {
    const warnings: string[] = [];
    const result = run(
      tree({ type: "paragraph", children: [link("./secret.md", "hidden")] }),
      warnings,
    );
    const paragraph = result.children[0] as { children: Array<{ type: string; value?: string }> };
    expect(paragraph.children).toEqual([{ type: "text", value: "hidden" }]);
    expect(warnings[0]).toMatch(/excluded/);
  });

  it("warns about a missing target and keeps the link", () => {
    const warnings: string[] = [];
    const result = run(tree({ type: "paragraph", children: [link("./nope.md")] }), warnings);
    const paragraph = result.children[0] as { children: Array<{ url: string }> };
    expect(paragraph.children[0]!.url).toBe("./nope.md");
    expect(warnings).toHaveLength(1);
  });

  it("never touches code nodes, which are not links", () => {
    const code = { type: "inlineCode", value: "[x](./b.md)" };
    const result = run(tree({ type: "paragraph", children: [code] }));
    const paragraph = result.children[0] as { children: unknown[] };
    expect(paragraph.children).toEqual([code]);
  });
});
