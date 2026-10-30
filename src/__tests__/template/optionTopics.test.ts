import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  applyGroups,
  iconProblem,
  parseCodeMeta,
  parseSiteConfig,
  resolveEditHost,
  slugify,
} from "../../../template/src/domain";
import { siteConfigSchema } from "../../../template/src/domain/config";
import { buildConfigReference, readReference } from "../../../scripts/configReference";

const ROOT = join(__dirname, "..", "..", "..");
const DOCS = join(ROOT, "docs");

/** The pages of the topics, and the page that lists them. */
const TOPICS = readdirSync(DOCS)
  .filter((file) => /^options-.+\.md$/.test(file))
  .sort();
const INDEX = "options.md";
const read = (file: string) => readFileSync(join(DOCS, file), "utf8");

/** The fenced blocks of a page: the language, the meta string and the code. */
function fences(markdown: string) {
  return [...markdown.matchAll(/^(`{3,})(\w*)[ \t]*([^\n]*)\n([\s\S]*?)^\1[ \t]*$/gm)].map(
    (match) => ({ lang: match[2]!, meta: match[3]!, code: match[4]! }),
  );
}

/** The blocks that claim to be a `sitekit.config.json`. */
const configBlocks = (markdown: string) =>
  fences(markdown).filter(
    (block) => block.lang === "json" && parseCodeMeta(block.meta).title === "sitekit.config.json",
  );

/** Every path of the keys an example writes: `site.url`, `features[].icon`, `check.links`. */
function pathsOf(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => pathsOf(item, `${prefix}[]`));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    return [path, ...pathsOf(child, path)];
  });
}

/** What an example may leave out because it is about another group of keys: the two keys that are required. */
const BASE = {
  site: { name: "Acme", description: "Acme docs.", url: "https://acme.example" },
  hero: { title: "Acme", lede: "Acme docs.", primary: { label: "Go", href: "/docs/" } },
};

const examples = TOPICS.flatMap((file) =>
  configBlocks(read(file)).map((block, index) => ({ file, index, code: block.code })),
);
const reference = readReference(siteConfigSchema);
const rows = reference.groups.flatMap((group) => group.rows);

describe("the topic pages of the options", () => {
  it("are the seven topics, and each is a page of the Docs collection in the group Options by topic", () => {
    expect(TOPICS).toEqual([
      "options-brand-logos.md",
      "options-checks.md",
      "options-edit-link.md",
      "options-identity.md",
      "options-navigation.md",
      "options-search-llms.md",
      "options-theme.md",
    ]);
    const config = JSON.parse(readFileSync(join(ROOT, "template", "sitekit.config.json"), "utf8"));
    const docs = config.collections.find((collection: { id: string }) => collection.id === "docs");
    const group = docs.groups.find((entry: { name: string }) => entry.name === "Options by topic");
    expect(group.items).toEqual([
      "options",
      ...TOPICS.map((file) => file.replace(/\.md$/, "")).sort(
        (a, b) => group.items.indexOf(a) - group.items.indexOf(b),
      ),
    ]);
  });

  it("show a JSON block for the config on every page, and every JSON block is named", () => {
    for (const file of TOPICS) {
      expect(configBlocks(read(file)).length).toBeGreaterThan(0);
      for (const block of fences(read(file)).filter((entry) => entry.lang === "json")) {
        // A JSON block without a title would not be validated, so it is not allowed.
        expect(parseCodeMeta(block.meta).title).toBe("sitekit.config.json");
      }
    }
  });

  it("have examples that parse as JSON and pass the real schema, with the keys they leave out filled in", () => {
    expect(examples.length).toBeGreaterThan(15);
    for (const example of examples) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(example.code);
      } catch (error) {
        throw new Error(
          `${example.file}, example ${example.index + 1}: ${(error as Error).message}`,
          { cause: error },
        );
      }
      expect(() => parseSiteConfig({ ...BASE, ...parsed })).not.toThrow();
    }
  });

  it("show every key of the schema in at least one example, and list the keys that no page shows", () => {
    const shown = new Set(examples.flatMap((example) => pathsOf(JSON.parse(example.code))));
    const missing = rows.map((row) => row.path).filter((path) => !shown.has(path));
    expect(rows.length).toBeGreaterThan(50);
    expect(missing).toEqual([]);
  });

  it("highlight lines that exist: no range goes past the end of its block", () => {
    for (const file of [...TOPICS, INDEX]) {
      for (const block of fences(read(file))) {
        const lineCount = block.code.replace(/\n$/, "").split("\n").length;
        for (const [first, last] of parseCodeMeta(block.meta).highlighted) {
          expect({ file, first, within: first <= lineCount }).toEqual({
            file,
            first,
            within: true,
          });
          expect({ file, last, within: last <= lineCount }).toEqual({ file, last, within: true });
        }
      }
    }
  });

  it("do not repeat the generated reference: no row, no header and no description of it", () => {
    const generated = buildConfigReference().split("\n");
    const tableLines = new Set(generated.filter((line) => line.startsWith("| ")));
    for (const file of [...TOPICS, INDEX]) {
      const page = read(file);
      for (const line of page.split("\n")) {
        expect({ file, line, repeated: tableLines.has(line.trim()) }).toEqual({
          file,
          line,
          repeated: false,
        });
      }
      for (const row of rows) {
        expect({ file, key: row.path, repeated: page.includes(row.description) }).toEqual({
          file,
          key: row.path,
          repeated: false,
        });
      }
    }
  });

  it("list every top-level key of the schema in the index, with the page that shows it", () => {
    const index = read(INDEX);
    for (const key of Object.keys(siteConfigSchema.shape)) {
      expect(index).toContain(`\`${key}\``);
    }
    for (const file of TOPICS) expect(index).toContain(`(./${file})`);
  });

  it("link to the reference by the heading of a group, and to pages and headings that exist", () => {
    const headings = (file: string) =>
      new Set(
        [...read(file).matchAll(/^#{1,6} (.+)$/gm)].map((match) =>
          slugify(match[1]!.replace(/`/g, "")),
        ),
      );
    for (const file of [...TOPICS, INDEX]) {
      const links = [...read(file).matchAll(/\]\((\.\/[\w-]+\.md)(?:#([\w-]+))?\)/g)];
      expect(links.length).toBeGreaterThan(0);
      for (const [, target, anchor] of links) {
        const path = resolve(dirname(join(DOCS, file)), target!);
        expect({ file, target, exists: existsSync(path) }).toEqual({ file, target, exists: true });
        if (anchor) {
          expect({ file, target, anchor, found: headings(target!.slice(2)).has(anchor) }).toEqual({
            file,
            target,
            anchor,
            found: true,
          });
        }
      }
    }
  });

  it("use commas, not em dashes", () => {
    for (const file of [...TOPICS, INDEX]) expect(read(file)).not.toContain("—");
  });
});

describe("what the topic pages quote from the code", () => {
  const page = (file: string) => read(file).replace(/\s+/g, " ");

  it("states the limit of stats with the message of the schema", () => {
    expect(() => parseSiteConfig({ ...BASE, stats: [{ value: "1", label: "One" }] })).toThrow(
      "stats takes two to five items, or none",
    );
    expect(page("options-identity.md")).toContain("stats: stats takes two to five items, or none");
  });

  it("quotes the message for a page that is in no group", () => {
    expect(() =>
      applyGroups(
        [{ slug: "faq" }, { slug: "first-steps" }, { slug: "guide" }],
        [{ name: "Start", tone: "brand", items: ["guide"] }],
        '"Docs"',
      ),
    ).toThrow(
      /faq, first-steps are in no group of "Docs"\. Add them to a group, or remove the groups to sort by name\./,
    );
    expect(page("options-navigation.md")).toContain(
      'faq, first-steps are in no group of "Docs". Add them to a group, or remove the groups to sort by name.',
    );
  });

  it("quotes the message of an optional collection that does not exist", () => {
    expect(() => parseSiteConfig({ ...BASE, llms: { enabled: true, optional: ["nope"] } })).toThrow(
      'llms.optional names "nope", which is not a collection of this site.',
    );
    expect(page("options-search-llms.md")).toContain(
      'llms.optional names "nope", which is not a collection of this site.',
    );
  });

  it("quotes the message of an unknown brand", () => {
    const problem = iconProblem("brand:nextjs")!;
    expect(problem).toContain('Unknown brand "nextjs"');
    expect(page("options-brand-logos.md")).toContain(`features.0.icon: ${problem}`);
  });

  it("quotes the message of an edit link that cannot be built", () => {
    const unknown = resolveEditHost("https://git.acme.example/docs/acme", undefined);
    const missing = resolveEditHost(undefined, undefined);
    expect(unknown.ok || missing.ok).toBe(false);
    if (!unknown.ok && !missing.ok) {
      expect(page("options-edit-link.md")).toContain(unknown.reason);
      expect(page("options-edit-link.md")).toContain(missing.reason);
    }
  });

  it("gives the first colors of dark and light as the bg token of each set", () => {
    const tokens = JSON.parse(
      readFileSync(join(ROOT, "template", "design", "tokens.json"), "utf8"),
    );
    const theme = page("options-theme.md");
    expect(theme).toContain(`\`${tokens.color.bg}\``);
    expect(theme).toContain(`\`${tokens.themes.light.color.bg}\``);
  });
});
