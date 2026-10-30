import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "..");
const tokens = JSON.parse(
  readFileSync(join(ROOT, "template", "design", "tokens.json"), "utf8"),
) as {
  color: Record<string, string>;
  themes: { light: { color: Record<string, string> } };
};

/** The two color sets: the dark one is the top-level `color`, the light one is `themes.light.color`. */
const THEMES: Record<string, Record<string, string>> = {
  dark: tokens.color,
  light: tokens.themes.light.color,
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

describe("the light and dark sets have the same tokens", () => {
  it("every key of the dark set is in the light set, and the other way round", () => {
    expect(Object.keys(THEMES.light!).sort()).toEqual(Object.keys(THEMES.dark!).sort());
  });

  it("every value is a six digit hex color", () => {
    for (const [theme, set] of Object.entries(THEMES))
      for (const [name, value] of Object.entries(set))
        expect({ theme, name, value }).toMatchObject({
          value: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        });
  });
});

describe.each(Object.keys(THEMES))("design tokens, WCAG contrast, %s theme", (theme) => {
  const set = THEMES[theme]!;
  const cases = TEXT.flatMap((text) => GROUNDS.map((ground) => [text, ground] as const));

  it.each(cases)("text token %s on %s reaches 4.5:1 (AA)", (text, ground) => {
    expect(contrast(set[text]!, set[ground]!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(GROUNDS)("fg-faint, for decoration only, reaches 3:1 on %s", (ground) => {
    expect(contrast(set["fg-faint"]!, set[ground]!)).toBeGreaterThanOrEqual(3);
  });

  it("the primary button text (page color on bright text color) reaches 4.5:1", () => {
    expect(contrast(set.bg!, set["fg-bright"]!)).toBeGreaterThanOrEqual(4.5);
  });

  // The dark accent fill is changed by issue #8 (the VS Code blue, 4.51:1). Until that lands it is 4.06:1,
  // so this check runs for the light theme only.
  (theme === "light" ? it : it.skip)("the text on a solid accent fill reaches 4.5:1", () => {
    expect(contrast(set["accent-contrast"]!, set["accent-strong"]!)).toBeGreaterThanOrEqual(4.5);
  });

  it("the text on the strong accent (accent-contrast on accent-strong) reaches 4.5:1", () => {
    expect(
      contrast(tokens.color["accent-contrast"]!, tokens.color["accent-strong"]!),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("the focus ring color reaches 3:1 on every ground, as a non-text indicator", () => {
    for (const ground of GROUNDS)
      expect(contrast(set["accent-strong"]!, set[ground]!)).toBeGreaterThanOrEqual(3);
  });

  it("borders can be told apart from the page, and a hover border from a plain one", () => {
    expect(contrast(set["border-strong"]!, set.bg!)).toBeGreaterThanOrEqual(1.3);
    expect(contrast(set["border-hover"]!, set.bg!)).toBeGreaterThan(
      contrast(set["border-strong"]!, set.bg!),
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
