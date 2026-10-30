import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { siteConfigSchema } from "../../../template/src/domain/config";
import {
  DEFAULT_SEVERITY,
  FINDING_DESCRIPTIONS,
  FINDING_KINDS,
} from "../../../template/src/domain/findings";
import {
  buildConfigReference,
  buildReference,
  readReference,
} from "../../../scripts/configReference";

const ROOT = join(__dirname, "..", "..", "..");

interface JsonSchema {
  type?: string;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
}

/** Every path of the keys a JSON Schema describes, found without the code under test. */
function keyPaths(node: JsonSchema, prefix = ""): string[] {
  const inner = node.type === "array" ? node.items : node;
  const base = node.type === "array" ? `${prefix}[]` : prefix;
  return Object.entries(inner?.properties ?? {}).flatMap(([key, child]) => {
    const path = prefix === "" ? key : `${base}.${key}`;
    return [path, ...keyPaths(child, path)];
  });
}

describe("the generated configuration reference", () => {
  it("is the page on disk: a new or changed key cannot ship without running `npm run build:docs`", () => {
    const written = readFileSync(join(ROOT, "docs", "configuration.md"), "utf8");
    // Not an equality of two long strings first: name the first line that differs.
    const fresh = buildConfigReference().split("\n");
    const onDisk = written.split("\n");
    const line = fresh.findIndex((text, index) => text !== onDisk[index]);
    expect(
      line === -1 && fresh.length === onDisk.length ? "same" : `line ${line + 1} differs`,
    ).toBe("same");
  });

  it("lists every key of the real schema, in the table of its group", () => {
    const page = buildConfigReference();
    const json = z.toJSONSchema(siteConfigSchema, { io: "input" }) as JsonSchema;
    const paths = keyPaths(json);
    expect(paths.length).toBeGreaterThan(40);
    // A key that only holds other keys is the heading of its table, the others are rows.
    const missing = paths.filter(
      (path) => !page.includes(`| \`${path}\` |`) && !page.includes(`\n## ${path}\n`),
    );
    expect(missing).toEqual([]);
  });

  it("lists every kind of finding under `check`, with its default severity", () => {
    const { groups } = readReference(siteConfigSchema);
    const rows = groups.find((group) => group.key === "check")!.rows;
    expect(rows.map((row) => row.path)).toEqual([
      "check",
      ...FINDING_KINDS.map((k) => `check.${k}`),
    ]);
    for (const kind of FINDING_KINDS) {
      const row = rows.find((candidate) => candidate.path === `check.${kind}`)!;
      expect(row.default).toBe(`\`"${DEFAULT_SEVERITY[kind]}"\``);
      expect(row.allowed).toBe('`"error"`, `"warning"`, `"off"`');
      expect(row.description).toBe(FINDING_DESCRIPTIONS[kind]);
    }
  });

  it("has a description for every key of the real schema", () => {
    expect(readReference(siteConfigSchema).missing).toEqual([]);
  });

  it("opens each table with its group, in the order of the schema", () => {
    const headings = [...buildConfigReference().matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    expect(headings).toEqual(Object.keys(siteConfigSchema.shape));
  });

  it("uses commas, not em dashes, and leaves no empty cell", () => {
    const page = buildConfigReference();
    expect(page).not.toContain("—");
    expect(page).not.toMatch(/\| +\|/);
  });
});

describe("readReference and buildReference", () => {
  const schema = z.strictObject({
    name: z.string().describe("The name."),
    mode: z.enum(["fast", "slow"]).default("fast").describe("How it runs."),
    url: z.url().optional().describe("Where it is."),
    flags: z.record(z.string(), z.string()).default({}).describe("Flags | with a pipe."),
    tags: z.array(z.string()).min(1).describe("At least one tag."),
    box: z
      .strictObject({
        size: z.number().default(3).describe("The size."),
        points: z
          .array(
            z.strictObject({ x: z.number().describe("The x."), y: z.number().describe("The y.") }),
          )
          .default([])
          .describe("The points."),
      })
      .default({ size: 3, points: [] })
      .describe("A box of points."),
  });

  it("reads type, default, allowed values and description of each key", () => {
    const { groups, missing } = readReference(schema);
    expect(missing).toEqual([]);
    const rows = Object.fromEntries(
      groups.flatMap((group) => group.rows).map((row) => [row.path, row]),
    );
    expect(rows["name"]).toMatchObject({ type: "string", default: "required", allowed: "any" });
    expect(rows["mode"]).toMatchObject({
      default: '`"fast"`',
      allowed: '`"fast"`, `"slow"`',
    });
    expect(rows["url"]).toMatchObject({ type: "string (URL)", default: "none" });
    expect(rows["flags"]).toMatchObject({ type: "map of string", default: "`{}`" });
    expect(rows["tags"]).toMatchObject({ type: "array of string", allowed: "at least 1 item" });
    expect(rows["box.size"]).toMatchObject({ type: "number", default: "`3`" });
    expect(rows["box.points[].x"]).toMatchObject({ type: "number", default: "required" });
  });

  it("gives an object only an opening paragraph, and a list keeps its own row", () => {
    const { groups } = readReference(schema);
    const box = groups.find((group) => group.key === "box")!;
    expect(box.description).toBe("A box of points.");
    expect(box.rows.map((row) => row.path)).toEqual([
      "box.size",
      "box.points",
      "box.points[].x",
      "box.points[].y",
    ]);
    const name = groups.find((group) => group.key === "name")!;
    expect(name.description).toBe("");
    expect(name.rows.map((row) => row.path)).toEqual(["name"]);
  });

  it("gives a map with known keys a row for each of them, and fails on one without a description", () => {
    const kinds = z
      .record(z.string(), z.enum(["error", "off"]))
      .default({})
      .describe("Severities.");
    const known = z.strictObject({
      kinds: kinds.meta({ keys: { a: { default: "error", description: "The a kind." } } }),
    });
    const { groups } = readReference(known);
    expect(groups[0]!.rows.map((row) => [row.path, row.default, row.allowed])).toEqual([
      ["kinds", "`{}`", "-"],
      ["kinds.a", '`"error"`', '`"error"`, `"off"`'],
    ]);
    const bare = z.strictObject({
      kinds: kinds.meta({ keys: { a: { default: "error", description: " " } } }),
    });
    expect(() => buildReference(bare)).toThrow(/- kinds\.a/);
  });

  it("escapes a pipe, so a description cannot break its table", () => {
    const page = buildReference(schema);
    expect(page).toContain("Flags \\| with a pipe.");
  });

  it("fails and names every key that has no description, at any depth", () => {
    const bare = z.strictObject({
      described: z.string().describe("Yes."),
      plain: z.string(),
      group: z
        .strictObject({
          inner: z.boolean().default(false),
          list: z.array(z.strictObject({ id: z.string() })),
        })
        .describe("A group."),
    });
    expect(() => buildReference(bare)).toThrow(
      /no description:\n {2}- plain\n {2}- group\.inner\n {2}- group\.list\n {2}- group\.list\[\]\.id\nAdd \.describe/,
    );
  });

  it("does not take a description from a default or an optional wrapper that has none", () => {
    const wrapped = z.strictObject({ a: z.string().describe("A.").optional() });
    expect(() => buildReference(wrapped)).not.toThrow();
    expect(() => buildReference(z.strictObject({ a: z.string().optional() }))).toThrow(/- a/);
  });
});
