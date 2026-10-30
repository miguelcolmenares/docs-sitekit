import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEMPLATE = join(__dirname, "..", "..", "..", "template");

// `renderMarkdown` is TypeScript that loads an ESM-only package, so it is run in its own Node process, through the
// Vite that the template already has. The process renders the page below with the real markdown package and the real
// Shiki themes, and prints the HTML. The tests then read that HTML.
const SCRIPT = `
import { createServer } from ${JSON.stringify(join(TEMPLATE, "node_modules", "vite", "dist", "node", "index.js"))};
import { readFileSync } from "node:fs";
const server = await createServer({ root: ${JSON.stringify(TEMPLATE)}, appType: "custom", server: { middlewareMode: true }, logLevel: "silent", configFile: false });
try {
  const { renderMarkdown } = await server.ssrLoadModule("/src/infrastructure/renderMarkdown.ts");
  const context = { file: "a.md", published: new Map(), existing: new Set(), isExcluded: () => false, repositoryUrl: undefined };
  const { html } = await renderMarkdown(readFileSync(process.argv[2], "utf8"), { context, base: "/" });
  process.stdout.write(html);
} finally {
  await server.close();
}
`;

const PAGE = [
  "```ts",
  "const plain = 1;",
  "```",
  "",
  '```ts title="src/config.ts" {2,4-5}',
  "const one = 1;",
  "const two = 2;",
  "const three = 3;",
  "const four = 4;",
  "const five = 5;",
  "```",
  "",
  "```ts",
  "const old = 1; // [!code --]",
  "const next = 2; // [!code ++]",
  "const same = 3;",
  "```",
  "",
  "```diff",
  "--- a/f",
  "+++ b/f",
  "@@ -1,2 +1,2 @@",
  "-removed",
  "+added",
  " kept",
  "```",
  "",
  "```ts title='single.ts'",
  "const x = 1;",
  "```",
  "",
  "A marker in `code // [!code ++]` is not a block.",
  "",
].join("\n");

let dir: string;
let html: string;
const blocks = () => html.split(/(?=<(?:div|figure) class="code-block")/).filter(Boolean);

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "sitekit-codeblocks-"));
  writeFileSync(join(dir, "render.mjs"), SCRIPT);
  writeFileSync(join(dir, "page.md"), PAGE);
  html = execFileSync("node", [join(dir, "render.mjs"), join(dir, "page.md")], {
    encoding: "utf8",
    cwd: TEMPLATE,
    timeout: 60_000,
  });
}, 90_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("code blocks, rendered by the real markdown package", () => {
  it("wraps every block, and only those", () => {
    expect(blocks()).toHaveLength(5);
    expect(html.match(/class="code-block"/g)).toHaveLength(5);
  });

  it("gives a block with no meta string a div, the pre, a hidden button and a polite status", () => {
    const [plain] = blocks();
    expect(plain).toMatch(/^<div class="code-block"><pre\b/);
    expect(plain).toContain('<button type="button" class="copy-code" aria-label="Copy code"');
    expect(plain).toMatch(/<button[^>]* hidden>Copy<\/button>/);
    expect(plain).toContain('data-copy="Copy" data-copied="Copied"');
    expect(plain).toContain('<span class="code-status" role="status" aria-live="polite"></span>');
    expect(plain).not.toContain("<figcaption");
    expect(plain).not.toMatch(/data-(highlighted|diff|sign)/);
  });

  it("keeps the dual theme variables and the language on the pre", () => {
    const [plain] = blocks();
    expect(plain).toContain("--shiki-light:");
    expect(plain).toContain("--shiki-dark:");
    expect(plain).toContain('data-language="ts"');
    expect(plain).toContain("tabindex");
  });

  it("shows the title in a figcaption of a figure, and the code reads as the text of the block", () => {
    const titled = blocks()[1]!;
    expect(titled).toMatch(
      /^<figure class="code-block" data-titled=""><figcaption class="code-title">src\/config\.ts<\/figcaption><pre\b/,
    );
    expect(titled).toContain("</figure>");
    expect(titled).not.toContain("title=");
  });

  it("marks the highlighted lines 2, 4 and 5 and no others", () => {
    const titled = blocks()[1]!;
    const lines = [...titled.matchAll(/<span class="line"([^>]*)>/g)].map((match) => match[1]);
    expect(lines).toHaveLength(5);
    expect(lines.map((attributes) => attributes!.includes('data-highlighted=""'))).toEqual([
      false,
      true,
      false,
      true,
      true,
    ]);
  });

  it("reads a title in single quotes", () => {
    expect(blocks()[4]).toContain('<figcaption class="code-title">single.ts</figcaption>');
  });

  it("marks added and removed lines from comments, draws their sign, and removes the comments", () => {
    const marked = blocks()[2]!;
    expect(marked).not.toContain("[!code");
    const lines = [...marked.matchAll(/<span class="line"([^>]*)>/g)].map((match) => match[1]);
    expect(lines[0]).toContain('data-diff="remove"');
    expect(lines[0]).toContain("data-sign");
    expect(lines[1]).toContain('data-diff="add"');
    expect(lines[1]).toContain("data-sign");
    expect(lines[2]).not.toMatch(/data-(diff|sign)/);
    // The text the button copies is the text of the code: the comment is gone.
    expect(text(marked)).toBe("const old = 1;\nconst next = 2;\nconst same = 3;");
  });

  it("marks the lines of a diff block by their sign, keeps the sign in the text, and has no drawn sign", () => {
    const diff = blocks()[3]!;
    const lines = [...diff.matchAll(/<span class="line"([^>]*)>/g)].map((match) => match[1]);
    expect(lines.map((attributes) => /data-diff="(\w+)"/.exec(attributes!)?.[1] ?? null)).toEqual([
      null,
      null,
      null,
      "remove",
      "add",
      null,
    ]);
    expect(diff).not.toContain("data-sign");
    expect(text(diff)).toBe("--- a/f\n+++ b/f\n@@ -1,2 +1,2 @@\n-removed\n+added\n kept");
  });

  it("does not wrap inline code", () => {
    expect(html).toContain("<code>code // [!code ++]</code>");
  });
});

/** The text of the `code` element of a block: what the copy button copies. */
function text(block: string): string {
  const code = /<code[^>]*>([\s\S]*?)<\/code>/.exec(block)![1]!;
  return code
    .replace(/<[^>]+>/g, "")
    .replace(/&#x26;/g, "&")
    .replace(/&#x3C;/g, "<");
}
