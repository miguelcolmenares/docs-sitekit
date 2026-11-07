import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEMPLATE = join(__dirname, "..", "..", "..", "template");

// The samples of the home page are rendered by the real pipeline, which is ESM only, so the render runs in its own
// Node process through the Vite of the template, as the code block tests do. The process renders the samples of the
// config with `renderDemoSamples`, the function `loadSite` uses, and renders each source file with `renderMarkdown`
// on its own, so the test can compare the two.
const SCRIPT = `
import { createServer } from ${JSON.stringify(join(TEMPLATE, "node_modules", "vite", "dist", "node", "index.js"))};
import { readFileSync } from "node:fs";
import { join } from "node:path";
const TEMPLATE = ${JSON.stringify(TEMPLATE)};
const BASE = "/docs-sitekit/";
const published = new Map([
  ["docs/configuration.md", "/docs-sitekit/docs/configuration/"],
  ["docs/options.md", "/docs-sitekit/docs/options/"],
]);
const contextFor = (file) => ({ file, published, existing: new Set(), isExcluded: () => false, repositoryUrl: undefined });
const server = await createServer({ root: TEMPLATE, appType: "custom", server: { middlewareMode: true }, logLevel: "silent", configFile: false, resolve: { alias: { "@": join(TEMPLATE, "src") } } });
try {
  const { renderDemoSamples } = await server.ssrLoadModule("/src/infrastructure/demo-samples.ts");
  const { renderMarkdown } = await server.ssrLoadModule("/src/infrastructure/render-markdown.ts");
  const config = JSON.parse(readFileSync(join(TEMPLATE, "sitekit.config.json"), "utf8"));
  const samples = await renderDemoSamples(TEMPLATE, config.demo, { base: BASE, context: contextFor });
  const rendered = [];
  const markdown = [];
  for (const sample of config.demo.samples) {
    const text = readFileSync(join(TEMPLATE, sample.file), "utf8");
    markdown.push(text);
    rendered.push((await renderMarkdown(text, { context: contextFor(sample.title), base: BASE })).html);
  }
  process.stdout.write(JSON.stringify({ samples, rendered, markdown, labels: config.demo.samples.map((s) => s.label) }));
} finally {
  await server.close();
}
`;

interface Output {
  /** The Markdown file of each sample, as it is on disk. */
  markdown: string[];
  samples: {
    label: string;
    title: string;
    source: string;
    preview: string;
    html: string;
    generated: string;
  }[];
  rendered: string[];
  labels: string[];
}

let dir: string;
let output: Output;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "sitekit-source-to-html-"));
  writeFileSync(join(dir, "render.mjs"), SCRIPT);
  output = JSON.parse(
    execFileSync("node", [join(dir, "render.mjs")], {
      encoding: "utf8",
      cwd: TEMPLATE,
      timeout: 90_000,
      maxBuffer: 16 * 1024 * 1024,
    }),
  ) as Output;
}, 120_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const NAMED_ENTITIES: Record<string, string> = { lt: "<", gt: ">", quot: '"', amp: "&" };

/**
 * Read the entities of a text in one pass, so a result such as `&amp;lt;` stays `&lt;` and is not read twice.
 * Only the entities the pipeline writes are read: the four named ones and the numeric ones.
 */
function decodeEntities(text: string): string {
  return text.replace(
    /&(?:#x([0-9a-f]+)|#(\d+)|(lt|gt|quot|amp));/gi,
    (_match, hex: string | undefined, dec: string | undefined, name: string | undefined) =>
      hex !== undefined
        ? String.fromCodePoint(parseInt(hex, 16))
        : dec !== undefined
          ? String.fromCodePoint(Number(dec))
          : NAMED_ENTITIES[name!.toLowerCase()]!,
  );
}

/**
 * The text of some HTML: every tag is dropped by reading the characters, not by a pattern, and `glue` takes the
 * place of each tag. The HTML here is written by the pipeline, so a `>` inside an attribute is always an entity.
 */
function textOf(html: string, glue = ""): string {
  let text = "";
  let inTag = false;
  for (const char of html) {
    if (char === "<") {
      inTag = true;
    } else if (char === ">" && inTag) {
      inTag = false;
      text += glue;
    } else if (!inTag) {
      text += char;
    }
  }
  return text;
}

/** The text of the code element of a highlighted block, with its tags gone and its entities read. */
function codeText(block: string): string {
  const code = /<code[^>]*>([\s\S]*?)<\/code>/.exec(block);
  if (!code) throw new Error("no code element in the block");
  return decodeEntities(textOf(code[1]!));
}

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

describe("the samples of the home page, rendered by the real pipeline", () => {
  it("has one sample for each entry of the config, in the same order, with three or four of them", () => {
    expect(output.samples.map((sample) => sample.label)).toEqual(output.labels);
    expect(output.samples.length).toBeGreaterThanOrEqual(3);
    expect(output.samples.length).toBeLessThanOrEqual(4);
  });

  it("shows, in the HTML tab, exactly the HTML that the pipeline writes for the same file", () => {
    output.samples.forEach((sample, index) => {
      // The generated HTML is the same as a page would write for the file, and the HTML tab shows it.
      expect(collapse(sample.generated)).toBe(collapse(output.rendered[index]!));
      expect(collapse(codeText(sample.html))).toBe(collapse(output.rendered[index]!));
    });
  });

  it("shows the source of the file, under its title, and the text of the code is the file itself", () => {
    output.samples.forEach((sample, index) => {
      expect(sample.source).toContain(
        `<figcaption class="code-title">${sample.title}</figcaption>`,
      );
      // A `[!code ++]` comment is not printed: the block draws its sign at the line, as every block of the kit does.
      const printed = output.markdown[index]!.replace(/ \/\/ \[!code \+\+\]/g, "");
      expect(collapse(codeText(sample.source))).toBe(collapse(printed));
    });
  });

  it("rewrites the relative links of a sample the way the page of the file would", () => {
    const [first, second] = output.samples;
    expect(first!.generated).toContain('href="/docs-sitekit/docs/configuration/"');
    expect(second!.generated).toContain('href="/docs-sitekit/docs/options/"');
    expect(first!.generated).not.toContain("./configuration.md");
  });

  it("keeps the preview free of ids that repeat, links and heading roles, and prefixes every id", () => {
    output.samples.forEach((sample, index) => {
      const ids = [...sample.preview.matchAll(/ id="([^"]*)"/g)].map((match) => match[1]!);
      expect(new Set(ids).size).toBe(ids.length);
      ids.forEach((id) => expect(id.startsWith(`sample${index}-`)).toBe(true));
      expect(sample.preview).not.toMatch(/<a[\s>]/);
      expect(sample.preview).not.toMatch(/href="#/);
      expect(sample.preview).toMatch(/<h[1-6] role="presentation"/);
    });
  });

  it("uses the same text in the preview as the page: no word of the sample is lost", () => {
    const withoutButtons = (html: string) => html.replace(/<button[^>]*>[\s\S]*?<\/button>/g, "");
    output.samples.forEach((sample, index) => {
      const text = collapse(decodeEntities(textOf(withoutButtons(sample.preview), " ")));
      const expected = collapse(
        decodeEntities(textOf(withoutButtons(output.rendered[index]!), " ")),
      );
      expect(text).toBe(expected);
    });
  });
});
