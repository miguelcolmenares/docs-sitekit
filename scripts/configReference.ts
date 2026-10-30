import { z } from "zod";
import { siteConfigSchema } from "../template/src/domain/config";

/** The part of a JSON Schema node that the reference reads. */
interface Node {
  type?: string | string[];
  description?: string;
  default?: unknown;
  enum?: unknown[];
  const?: unknown;
  format?: string;
  pattern?: string;
  minItems?: number;
  minimum?: number;
  maximum?: number;
  properties?: Record<string, Node>;
  required?: string[];
  items?: Node;
  additionalProperties?: boolean | Node;
  anyOf?: Node[];
  /** Schema metadata: the known keys of a map, each with a default and a description. */
  keys?: Record<string, { default: string; description: string }>;
}

/** One key of the config, as a row of a table. */
export interface ReferenceRow {
  /** The path of the key: `site.url`, or `collections[].groups[].name` for a key inside a list. */
  path: string;
  type: string;
  /** The default as JSON, `required` when the key must be written, `none` when it is optional without a default. */
  default: string;
  /** The values the key accepts, `any` for a free value, and `-` for a key that only holds other keys. */
  allowed: string;
  description: string;
}

/** A top-level key of the config with its own table. */
export interface ReferenceGroup {
  key: string;
  description: string;
  rows: ReferenceRow[];
}

/** The reference read from a schema: the groups, and the keys that have no description yet. */
export interface Reference {
  groups: ReferenceGroup[];
  missing: string[];
}

const isObject = (node: Node) => node.type === "object" && node.properties !== undefined;

/** The type of a node in words: `string`, `array of object`, `map of string`. */
function typeOf(node: Node): string {
  if (node.anyOf) return node.anyOf.map(typeOf).join(" or ");
  if (node.type === "array") return `array of ${node.items ? typeOf(node.items) : "any"}`;
  if (node.type === "object" && !node.properties && typeof node.additionalProperties === "object") {
    return `map of ${typeOf(node.additionalProperties)}`;
  }
  const type = Array.isArray(node.type) ? node.type.join(" or ") : (node.type ?? "any");
  return node.format === "uri" ? `${type} (URL)` : type;
}

const code = (text: string) => `\`${text}\``;

/** What a key accepts beyond its type: the listed values, a pattern, a smallest list. */
function allowedOf(node: Node): string {
  if (node.enum) return node.enum.map((value) => code(JSON.stringify(value))).join(", ");
  if (node.const !== undefined) return code(JSON.stringify(node.const));
  if (node.keys) return "-";
  if (node.type === "boolean") return `${code("true")}, ${code("false")}`;
  const parts: string[] = [];
  if (node.pattern) parts.push(`matches ${code(node.pattern)}`);
  if (node.minItems)
    parts.push(`at least ${node.minItems} ${node.minItems === 1 ? "item" : "items"}`);
  if (node.minimum !== undefined) parts.push(`at least ${node.minimum}`);
  if (node.maximum !== undefined) parts.push(`at most ${node.maximum}`);
  if (parts.length > 0) return parts.join(", ");
  // An object or a list of objects takes its values from the rows below it.
  const holder = isObject(node) || (node.type === "array" && node.items && isObject(node.items));
  return holder ? "-" : "any";
}

/** Read the rows of one key and, below it, the rows of every key it holds. */
function walk(
  node: Node,
  path: string,
  required: boolean,
  out: { rows: ReferenceRow[]; missing: string[] },
): void {
  const description = node.description?.trim();
  if (!description) out.missing.push(path);
  out.rows.push({
    path,
    type: typeOf(node),
    default:
      node.default !== undefined
        ? code(JSON.stringify(node.default))
        : required
          ? "required"
          : "none",
    allowed: allowedOf(node),
    description: description ?? "",
  });
  // A map with known keys, such as `check`, has a row for each of them below its own.
  if (node.keys && typeof node.additionalProperties === "object") {
    const value = node.additionalProperties;
    for (const [name, key] of Object.entries(node.keys)) {
      if (!key.description.trim()) out.missing.push(`${path}.${name}`);
      out.rows.push({
        path: `${path}.${name}`,
        type: typeOf(value),
        default: code(JSON.stringify(key.default)),
        allowed: allowedOf(value),
        description: key.description.trim(),
      });
    }
  }
  const inner = node.type === "array" && node.items && isObject(node.items) ? node.items : node;
  if (!isObject(inner)) return;
  const prefix = inner === node ? path : `${path}[]`;
  for (const [key, child] of Object.entries(inner.properties ?? {})) {
    walk(child, `${prefix}.${key}`, inner.required?.includes(key) ?? false, out);
  }
}

/**
 * Read a schema into groups of rows, one group per top-level key. The schema is converted to JSON
 * Schema for what a writer of the file may type (`io: "input"`), so a key with a default is optional.
 * A top-level key that only holds other keys has no row of its own: its description opens its table.
 * Any other top-level key, such as a list, keeps its row and has no opening paragraph. A map with known keys
 * (`.meta({ keys })`) gets a row for each of them.
 */
export function readReference(schema: z.ZodType): Reference {
  const root = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Node;
  const out = { rows: [] as ReferenceRow[], missing: [] as string[] };
  const groups: ReferenceGroup[] = [];
  for (const [key, node] of Object.entries(root.properties ?? {})) {
    const before = out.rows.length;
    walk(node, key, root.required?.includes(key) ?? false, out);
    const rows = out.rows.splice(before);
    // An object only holds other keys, so its description opens the table. Any other key keeps its own row.
    const holder = isObject(node);
    groups.push({
      key,
      description: holder ? (node.description?.trim() ?? "") : "",
      rows: holder ? rows.slice(1) : rows,
    });
  }
  return { groups, missing: out.missing };
}

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

/** Write the reference page. The text has no padding, so it reads the same however a formatter aligns tables. */
export function renderReference(groups: readonly ReferenceGroup[]): string {
  const lines = [
    "---",
    "order: 2",
    "---",
    "",
    "# Configuration reference",
    "",
    "Every key of `sitekit.config.json`, with its type, its default, the values it accepts and what it does.",
    "",
    "This page is generated from the schema in `template/src/domain/config.ts`, so it cannot drift from it. Run `npm run build:docs` after changing a key, and a test fails while the page is out of date. An unknown key is an error: the file is a closed contract.",
    "",
    "In the Default column, `required` is a key you must write, and `none` is an optional key that has no default. A key inside a list is written `list[].key`.",
  ];
  for (const group of groups) {
    lines.push("", `## ${group.key}`, "");
    if (group.description) lines.push(group.description, "");
    lines.push(
      "| Key | Type | Default | Allowed values | Description |",
      "| --- | --- | --- | --- | --- |",
    );
    for (const row of group.rows) {
      lines.push(
        `| ${code(row.path)} | ${cell(row.type)} | ${cell(row.default)} | ${cell(row.allowed)} | ${cell(row.description)} |`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

/**
 * The reference page for a schema. Throws one error that lists every key without a description,
 * so a key cannot be added without saying what it does.
 */
export function buildReference(schema: z.ZodType): string {
  const { groups, missing } = readReference(schema);
  if (missing.length > 0) {
    throw new Error(
      `These keys have no description:\n${missing.map((path) => `  - ${path}`).join("\n")}\nAdd .describe("...") to each one in template/src/domain/config.ts.`,
    );
  }
  return renderReference(groups);
}

/** The reference page for `sitekit.config.json`. */
export function buildConfigReference(): string {
  return buildReference(siteConfigSchema);
}
