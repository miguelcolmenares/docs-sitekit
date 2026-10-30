/**
 * The kinds of problem `check` finds in the markdown, and the key each one has under `check` in
 * `sitekit.config.json`. A new kind is added here, in `DEFAULT_SEVERITY` and in the documentation.
 */
export const FINDING_KINDS = [
  "links",
  "excludedLinks",
  "anchors",
  "images",
  "frontmatter",
  "order",
  "duplicateHeadings",
  "callouts",
  "variables",
  "snippets",
] as const;

/** One of the kinds of problem found in the content. */
export type FindingKind = (typeof FINDING_KINDS)[number];

/** How serious a finding is. An `error` makes `check` fail. */
export type Severity = "error" | "warning";

/** The value of a `check.<kind>` key: a severity, or `off` to stop looking for that kind. */
export type SeverityLevel = Severity | "off";

/** What each kind is until the config says otherwise. A missing image breaks a page, the rest only misleads. */
export const DEFAULT_SEVERITY: Readonly<Record<FindingKind, Severity>> = {
  links: "warning",
  excludedLinks: "warning",
  anchors: "warning",
  images: "error",
  frontmatter: "warning",
  order: "error",
  duplicateHeadings: "warning",
  callouts: "warning",
  variables: "warning",
  snippets: "error",
};

/** A problem in a markdown file, with where it is and how serious it is. */
export interface ContentFinding {
  kind: FindingKind;
  severity: Severity;
  /** Repository-relative path of the file, with forward slashes. */
  file: string;
  /** Line in the file, starting at 1. It points at the link, the image, the heading or the key. */
  line: number;
  message: string;
}

/** True for a name that is a kind of finding. */
export function isFindingKind(name: string): name is FindingKind {
  return (FINDING_KINDS as readonly string[]).includes(name);
}

/** The severity of every kind: the default, changed by what the config sets. */
export function resolveSeverities(
  overrides: Readonly<Record<string, SeverityLevel>> = {},
): Record<FindingKind, SeverityLevel> {
  const resolved: Record<FindingKind, SeverityLevel> = { ...DEFAULT_SEVERITY };
  for (const [name, level] of Object.entries(overrides)) {
    if (isFindingKind(name)) resolved[name] = level;
  }
  return resolved;
}

/** `docs/guide.md:42: warning: Link "./nope.md" does not match any file`. */
export function formatFinding(finding: ContentFinding): string {
  return `${finding.file}:${finding.line}: ${finding.severity}: ${finding.message}`;
}

/** How many errors and how many warnings a list of findings holds. */
export function countFindings(findings: readonly ContentFinding[]): {
  errors: number;
  warnings: number;
} {
  const errors = findings.filter((finding) => finding.severity === "error").length;
  return { errors, warnings: findings.length - errors };
}

/** A short line for the end of a run: `2 errors, 1 warning`. */
export function summarizeFindings(findings: readonly ContentFinding[]): string {
  const { errors, warnings } = countFindings(findings);
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
  return `${plural(errors, "error")}, ${plural(warnings, "warning")}`;
}
