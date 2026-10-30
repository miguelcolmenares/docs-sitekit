import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "..");
const tokens = JSON.parse(
  readFileSync(join(ROOT, "template", "design", "tokens.json"), "utf8"),
) as {
  color: Record<string, string>;
};

/** WCAG relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const GROUNDS = ["bg", "bg-subtle", "surface", "surface-2", "surface-3"] as const;
const TEXT = [
  "fg",
  "fg-bright",
  "fg-muted",
  "fg-dim",
  "accent",
  "success",
  "warn",
  "danger",
] as const;

describe("design tokens, WCAG contrast", () => {
  const cases = TEXT.flatMap((text) => GROUNDS.map((ground) => [text, ground] as const));

  it.each(cases)("text token %s on %s reaches 4.5:1 (AA)", (text, ground) => {
    expect(contrast(tokens.color[text]!, tokens.color[ground]!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(GROUNDS)("fg-faint, for decoration only, reaches 3:1 on %s", (ground) => {
    expect(contrast(tokens.color["fg-faint"]!, tokens.color[ground]!)).toBeGreaterThanOrEqual(3);
  });

  it("the primary button text (page color on bright white) reaches 4.5:1", () => {
    expect(contrast(tokens.color.bg!, tokens.color["fg-bright"]!)).toBeGreaterThanOrEqual(4.5);
  });

  it("the text on the strong accent (accent-contrast on accent-strong) reaches 4.5:1", () => {
    expect(
      contrast(tokens.color["accent-contrast"]!, tokens.color["accent-strong"]!),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("the focus ring color reaches 3:1 on every ground, as a non-text indicator", () => {
    for (const ground of GROUNDS)
      expect(
        contrast(tokens.color["accent-strong"]!, tokens.color[ground]!),
      ).toBeGreaterThanOrEqual(3);
  });

  it("borders can be told apart from the page, and a hover border from a plain one", () => {
    expect(contrast(tokens.color["border-strong"]!, tokens.color.bg!)).toBeGreaterThanOrEqual(1.3);
    expect(contrast(tokens.color["border-hover"]!, tokens.color.bg!)).toBeGreaterThan(
      contrast(tokens.color["border-strong"]!, tokens.color.bg!),
    );
  });
});

describe("generated CSS", () => {
  it("is in sync with design/tokens.json", () => {
    expect(() =>
      execFileSync("node", ["scripts/build-tokens.mjs", "--check"], { cwd: ROOT, stdio: "pipe" }),
    ).not.toThrow();
  });
});
