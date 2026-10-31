import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import ts from "typescript";
import type { TableSpec } from "../template/src/examples/catalog";

/** What a table of the props of a component says about one prop. The columns are those of `ReferenceTable`. */
export interface PropRow {
  name: string;
  type: string;
  /** `required`, the `@defaultValue` of the TSDoc, or absent when the prop has none. */
  default?: string;
  /** The values of a prop that takes a few strings or a boolean, as `"a", "b"`. */
  allowed?: string;
  text: string;
}

/** One table of a page: its name for assistive technology, and its rows. */
export interface PropTable {
  label: string;
  rows: PropRow[];
}

/** The pages to build tables for: the name of the page and its tables. */
export type PropsSpecs = Record<string, readonly TableSpec[]>;

/** The result: the tables of each page, and the props that have no description. */
export interface PropsReading {
  pages: Record<string, PropTable[]>;
  missing: string[];
}

const ASTRO_SUFFIX = ".astro.ts";

/** The frontmatter of an `.astro` file as TypeScript, or an empty module when it has none. */
function frontmatterOf(source: string): string {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  return `${match?.[1] ?? ""}\nexport {};\n`;
}

/** A compiler host that reads `Hero.astro` as the module `Hero.astro.ts`, made of its frontmatter. */
function createHost(options: ts.CompilerOptions): ts.CompilerHost {
  const host = ts.createCompilerHost(options, true);
  const real = (file: string) => file.slice(0, -".ts".length);
  const isAstro = (file: string) => file.endsWith(ASTRO_SUFFIX) && existsSync(real(file));
  const { fileExists, readFile, getSourceFile } = host;
  host.fileExists = (file) => isAstro(file) || fileExists.call(host, file);
  host.readFile = (file) =>
    isAstro(file) ? frontmatterOf(readFileSync(real(file), "utf8")) : readFile.call(host, file);
  host.getSourceFile = (file, languageVersion, onError, shouldCreate) =>
    isAstro(file)
      ? ts.createSourceFile(file, frontmatterOf(readFileSync(real(file), "utf8")), languageVersion)
      : getSourceFile.call(host, file, languageVersion, onError, shouldCreate);
  return host;
}

/** The compiler options of the template, with its `extends` and its `@/` paths resolved. */
function templateOptions(root: string): ts.CompilerOptions {
  const path = join(root, "tsconfig.json");
  const read = ts.readConfigFile(path, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, root);
  return { ...parsed.options, noEmit: true, skipLibCheck: true, baseUrl: undefined };
}

const isOwn = (declaration: ts.Declaration) =>
  !/[\\/]node_modules[\\/]/.test(declaration.getSourceFile().fileName);

/** The text of a TSDoc comment as one line, without the backticks that mark code, which a table cell does not render. */
const plain = (parts: ts.SymbolDisplayPart[]) =>
  ts.displayPartsToString(parts).replace(/`/g, "").replace(/\s+/g, " ").trim();

/**
 * The values of a union of strings, or of a boolean, as the table lists them. The compiler orders a union by the
 * order in which it met its members, which is not the order of the source, so the values are sorted: the default
 * first, then the rest alphabetically.
 */
function allowedOf(type: ts.Type, fallback: string | undefined): string | undefined {
  if (type.flags & ts.TypeFlags.Boolean) return "true, false";
  if (type.isUnion() && type.types.every((member) => member.isStringLiteral())) {
    const values = type.types.map((member) =>
      JSON.stringify((member as ts.StringLiteralType).value),
    );
    return values
      .sort(
        (a, b) => Number(b === fallback) - Number(a === fallback) || (a < b ? -1 : a > b ? 1 : 0),
      )
      .join(", ");
  }
  return undefined;
}

/** The type as the table writes it: a union of strings is `string`, because its values are in the next column. */
function typeText(type: ts.Type, checker: ts.TypeChecker, location: ts.Node): string {
  const literals = type.isUnion() && type.types.every((member) => member.isStringLiteral());
  if (literals && !type.aliasSymbol) return "string";
  if (type.flags & ts.TypeFlags.Boolean) return "boolean";
  return checker.typeToString(
    type,
    location,
    ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope,
  );
}

/** The type that a table is about: the first parameter of a component, the `Props` of an `.astro` file, or a declared type. */
function subjectOf(
  spec: TableSpec,
  source: ts.SourceFile,
  checker: ts.TypeChecker,
): { type: ts.Type; location: ts.Node } {
  if (spec.file.endsWith(".astro")) {
    for (const statement of source.statements) {
      if (
        (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
        statement.name.text === spec.symbol
      ) {
        return { type: checker.getTypeAtLocation(statement.name), location: statement };
      }
    }
    throw new Error(`${spec.file} has no \`${spec.symbol}\` in its frontmatter.`);
  }
  const moduleSymbol = checker.getSymbolAtLocation(source);
  const exported =
    moduleSymbol &&
    checker.getExportsOfModule(moduleSymbol).find((symbol) => symbol.name === spec.symbol);
  if (!exported) throw new Error(`${spec.file} does not export \`${spec.symbol}\`.`);
  const declaration = exported.declarations?.[0] ?? source;
  if (spec.kind === "fields") {
    const resolved =
      exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    return { type: checker.getDeclaredTypeOfSymbol(resolved), location: declaration };
  }
  const signature = checker.getTypeOfSymbolAtLocation(exported, declaration).getCallSignatures()[0];
  const parameter = signature?.getParameters()[0];
  if (!parameter?.valueDeclaration) {
    throw new Error(`\`${spec.symbol}\` in ${spec.file} is not a component that takes props.`);
  }
  return {
    type: checker.getTypeOfSymbolAtLocation(parameter, parameter.valueDeclaration),
    location: declaration,
  };
}

/**
 * Read the tables of the props of the components of a template, from their TypeScript types and TSDoc. Only a prop
 * that the template declares is listed: what a component takes from the DOM or from another package (`className`,
 * `aria-*`, `LucideProps`) is not, and the page says so in words. A prop with no description is not hidden: it is
 * returned in `missing`, so a script can fail and name it.
 *
 * @param root - The template folder, with its `tsconfig.json`.
 * @param specs - The tables to read, by page.
 * @param options - Compiler options for a folder that has no `tsconfig.json`, such as a test fixture.
 */
export function readProps(
  root: string,
  specs: PropsSpecs,
  options?: ts.CompilerOptions,
): PropsReading {
  const compilerOptions = options ?? templateOptions(root);
  const files = [
    ...new Set(Object.values(specs).flatMap((tables) => tables.map((table) => table.file))),
  ];
  const virtual = (file: string) => resolve(root, file.endsWith(".astro") ? `${file}.ts` : file);
  const host = createHost(compilerOptions);
  const program = ts.createProgram(files.map(virtual), compilerOptions, host);
  const checker = program.getTypeChecker();

  const pages: Record<string, PropTable[]> = {};
  const missing: string[] = [];
  for (const [page, tables] of Object.entries(specs)) {
    pages[page] = tables.map((spec) => {
      const source = program.getSourceFile(virtual(spec.file));
      if (!source) throw new Error(`${spec.file} could not be read.`);
      const { type, location } = subjectOf(spec, source, checker);
      const rows: PropRow[] = [];
      for (const symbol of checker.getPropertiesOfType(type)) {
        if (!symbol.declarations?.some(isOwn)) continue;
        const declaration = symbol.valueDeclaration ?? symbol.declarations[0]!;
        const optional = (symbol.flags & ts.SymbolFlags.Optional) !== 0;
        const propType = checker.getNonNullableType(
          checker.getTypeOfSymbolAtLocation(symbol, declaration),
        );
        const text = plain(symbol.getDocumentationComment(checker));
        const tag = symbol
          .getJsDocTags(checker)
          .find((candidate) => candidate.name === "defaultValue");
        const fallback = tag ? plain(tag.text ?? []) : undefined;
        if (!text) missing.push(`${spec.file}: ${spec.symbol}.${symbol.name}`);
        const row: PropRow = {
          name: symbol.name,
          type: typeText(propType, checker, location),
          text,
        };
        const allowed = allowedOf(propType, fallback);
        if (allowed) row.allowed = allowed;
        if (!optional) row.default = "required";
        else if (fallback) row.default = fallback;
        rows.push(row);
      }
      return { label: labelOf(spec), rows };
    });
  }
  return { pages, missing };
}

/** The name of a table: `Props of StatRow`, `Props of Hero` for the `Props` of `Hero.astro`, `Fields of StatItem`. */
function labelOf(spec: TableSpec): string {
  if (spec.kind === "fields") return `Fields of ${spec.symbol}`;
  const name = spec.symbol === "Props" ? basename(spec.file).replace(/\.[a-z]+$/, "") : spec.symbol;
  return `Props of ${name}`;
}

/**
 * The JSON that the pages read, or an error that names every prop with no description. The file is generated:
 * a test compares it with this text, so a prop added or changed cannot ship with a stale table.
 */
export function buildComponentProps(
  root: string,
  specs: PropsSpecs,
  options?: ts.CompilerOptions,
): string {
  const { pages, missing } = readProps(root, specs, options);
  if (missing.length > 0) {
    throw new Error(
      `These props have no description:\n${missing.map((name) => `  - ${name}`).join("\n")}\nAdd a TSDoc comment above each one, then run \`npm run build:docs\` again.`,
    );
  }
  return `${JSON.stringify(pages, null, 2)}\n`;
}
