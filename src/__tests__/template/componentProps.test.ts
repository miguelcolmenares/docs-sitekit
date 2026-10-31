import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { PAGES } from "../../../template/src/examples/catalog";
import { buildComponentProps, readProps } from "../../../scripts/componentProps";

jest.setTimeout(60_000);

const ROOT = join(__dirname, "..", "..", "..");
const TEMPLATE = join(ROOT, "template");
const specs = Object.fromEntries(PAGES.map((page) => [page.name, page.tables]));

describe("the generated tables of props", () => {
  it("are the file on disk: a prop added or changed cannot ship without `npm run build:docs`", () => {
    const fresh = buildComponentProps(TEMPLATE, specs).split("\n");
    const onDisk = readFileSync(join(TEMPLATE, "src", "examples", "props.json"), "utf8").split(
      "\n",
    );
    const line = fresh.findIndex((text, at) => text !== onDisk[at]);
    expect(
      line === -1 && fresh.length === onDisk.length ? "same" : `line ${line + 1} differs`,
    ).toBe("same");
  });

  it("describe every prop of every component of a page", () => {
    expect(readProps(TEMPLATE, specs).missing).toEqual([]);
  });

  it("have a table for every table the catalog asks for, and at least one prop in each", () => {
    const { pages } = readProps(TEMPLATE, specs);
    for (const page of PAGES) {
      expect(pages[page.name]!.map((table) => table.rows.length > 0)).toEqual(
        page.tables.map(() => true),
      );
    }
  });

  it("read a default only where the TSDoc of the prop says it, and the code agrees", () => {
    const { pages } = readProps(TEMPLATE, specs);
    for (const page of PAGES) {
      page.tables.forEach((spec, at) => {
        const source = readFileSync(join(TEMPLATE, spec.file), "utf8");
        for (const row of pages[page.name]![at]!.rows) {
          if (!row.default || row.default === "required") continue;
          // `variant = "default"` in a destructuring, or `tone: value = "neutral"` renamed.
          const pattern = new RegExp(
            `\\b${row.name}(?::\\s*\\w+)?\\s*=\\s*${row.default.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
          );
          expect({ page: page.name, prop: row.name, agrees: pattern.test(source) }).toEqual({
            page: page.name,
            prop: row.name,
            agrees: true,
          });
        }
      });
    }
  });

  it("list the values of a union of strings, with the default first", () => {
    const { pages } = readProps(TEMPLATE, specs);
    const variant = pages["button"]![0]!.rows.find((row) => row.name === "variant")!;
    expect(variant.type).toBe("string");
    expect(variant.allowed).toBe(
      '"default", "destructive", "ghost", "link", "outline", "secondary"',
    );
  });

  it("leave out what a component takes from the DOM or from another package", () => {
    const { pages } = readProps(TEMPLATE, specs);
    expect(pages["icon"]![0]!.rows.map((row) => row.name)).toEqual(["name", "label", "brands"]);
    expect(pages["button"]![0]!.rows.map((row) => row.name)).toEqual([
      "variant",
      "size",
      "asChild",
    ]);
  });

  it("have no em dash and no backtick in a cell", () => {
    const json = readFileSync(join(TEMPLATE, "src", "examples", "props.json"), "utf8");
    expect(json).not.toContain("—");
    expect(json).not.toContain("`");
  });
});

describe("readProps on a small project", () => {
  let dir: string;
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  };
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sitekit-props-"));
    mkdirSync(join(dir, "src"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const write = (file: string, text: string) => writeFileSync(join(dir, "src", file), text);
  const spec = (file: string, symbol: string, kind: "props" | "fields" = "props") => ({
    page: [{ file: `src/${file}`, symbol, kind }],
  });

  it("reads the type, the optional and required state, the default, the allowed values and the text", () => {
    write(
      "box.ts",
      [
        "export function Box(props: {",
        '  /** The size of `Box`. @defaultValue "m" */',
        '  size?: "s" | "m" | "l";',
        "  /** The text. */",
        "  text: string;",
        "  /** Whether it is open. */",
        "  open?: boolean;",
        "}) { return props; }",
      ].join("\n"),
    );
    const { pages, missing } = readProps(dir, spec("box.ts", "Box"), options);
    expect(missing).toEqual([]);
    expect(pages["page"]![0]).toEqual({
      label: "Props of Box",
      rows: [
        {
          name: "size",
          type: "string",
          text: "The size of Box.",
          allowed: '"m", "l", "s"',
          default: '"m"',
        },
        { name: "text", type: "string", text: "The text.", default: "required" },
        { name: "open", type: "boolean", text: "Whether it is open.", allowed: "true, false" },
      ],
    });
  });

  it("names a prop with no description, and the build of the JSON fails with every one", () => {
    write(
      "bare.ts",
      "export function Bare(props: {\n  a: string;\n  /** B. */\n  b: string;\n  c?: number;\n}) { return props; }",
    );
    expect(readProps(dir, spec("bare.ts", "Bare"), options).missing).toEqual([
      "src/bare.ts: Bare.a",
      "src/bare.ts: Bare.c",
    ]);
    expect(() => buildComponentProps(dir, spec("bare.ts", "Bare"), options)).toThrow(
      /no description:\n {2}- src\/bare\.ts: Bare\.a\n {2}- src\/bare\.ts: Bare\.c\nAdd a TSDoc comment/,
    );
  });

  it("reads the Props interface of an .astro file from its frontmatter", () => {
    writeFileSync(
      join(dir, "src", "Card.astro"),
      [
        "---",
        "interface Props {",
        "  /** The title. */",
        "  title: string;",
        "}",
        "const { title } = Astro.props;",
        "---",
        "<h1>{title}</h1>",
      ].join("\n"),
    );
    const { pages } = readProps(dir, spec("Card.astro", "Props"), options);
    expect(pages["page"]![0]).toEqual({
      label: "Props of Card",
      rows: [{ name: "title", type: "string", text: "The title.", default: "required" }],
    });
  });

  it("reads the fields of an exported interface as a table of fields", () => {
    write(
      "item.ts",
      "/** An item. */\nexport interface Item {\n  /** The name. */\n  name: string;\n  /** A note. */\n  note?: string;\n}\n",
    );
    const { pages } = readProps(dir, spec("item.ts", "Item", "fields"), options);
    expect(pages["page"]![0]!.label).toBe("Fields of Item");
    expect(pages["page"]![0]!.rows.map((row) => row.name)).toEqual(["name", "note"]);
  });

  it("says what is wrong when the symbol is not there", () => {
    write("a.ts", "export const a = 1;\n");
    expect(() => readProps(dir, spec("a.ts", "Missing"), options)).toThrow(
      /does not export `Missing`/,
    );
    expect(() => readProps(dir, spec("a.ts", "a"), options)).toThrow(
      /not a component that takes props/,
    );
  });
});
