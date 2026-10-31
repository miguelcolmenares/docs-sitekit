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

/**
 * The text colors of the two Shiki themes the site uses (see renderMarkdown.ts), by theme of the page. The page's dark theme
 * uses github-dark-default and its light theme github-light-high-contrast. The colors that are backgrounds in those
 * themes (`markup.ignored`, `carriage-return`) are not text and are left out; a test below fails when a theme has a
 * text color this list does not know.
 */
const CODE_THEMES = {
  dark: {
    file: "github-dark-default.mjs",
    text: [
      "#8b949e",
      "#ff7b72",
      "#79c0ff",
      "#ffa657",
      "#e6edf3",
      "#d2a8ff",
      "#7ee787",
      "#a5d6ff",
      "#ffa198",
      "#f0f6fc",
    ],
    notText: ["#161b22"],
  },
  light: {
    file: "github-light-high-contrast.mjs",
    text: [
      "#66707b",
      "#a0111f",
      "#023b95",
      "#702c00",
      "#0e1116",
      "#622cbc",
      "#024c1a",
      "#032563",
      "#6e011a",
      "#4b535d",
    ],
    notText: ["#ffffff", "#e7ecf0"],
  },
} as const;

describe.each(Object.keys(THEMES))("code highlight and diff tones, %s theme", (theme) => {
  const set = THEMES[theme]!;
  const { file, text, notText } = CODE_THEMES[theme as keyof typeof CODE_THEMES];
  const TONES = ["code-highlight", "code-add", "code-remove"] as const;

  it("the Shiki theme has the text colors this test knows, and no other", () => {
    // The theme file is a module that holds one JSON string: read the string, then the JSON in it.
    const module = readFileSync(
      join(ROOT, "template", "node_modules", "@shikijs", "themes", "dist", file),
      "utf8",
    );
    const json = JSON.parse(/JSON\.parse\(("(?:[^"\\]|\\.)*")\)/.exec(module)![1]!) as string;
    const parsed = JSON.parse(json) as {
      tokenColors: Array<{ settings?: { foreground?: string } }>;
    };
    const found = new Set(
      parsed.tokenColors.flatMap((rule) => rule.settings?.foreground?.toLowerCase() ?? []),
    );
    expect(found.size).toBeGreaterThan(8);
    expect(
      [...found].filter(
        (color) =>
          !(text as readonly string[]).includes(color!) &&
          !(notText as readonly string[]).includes(color!),
      ),
    ).toEqual([]);
    for (const color of text) expect(found).toContain(color);
  });

  const cases = TONES.flatMap((tone) => text.map((color) => [tone, color] as const));
  it.each(cases)("%s keeps the code color %s at 4.5:1 or more (AA)", (tone, color) => {
    expect(contrast(color, set[tone]!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(TONES)("%s can be told from the code surface, so a highlight is visible", (tone) => {
    expect(contrast(set[tone]!, set.surface!)).toBeGreaterThanOrEqual(1.03);
  });

  it.each(
    TONES.flatMap((tone) =>
      ["fg", "fg-muted", "success", "danger"].map((name) => [tone, name] as const),
    ),
  )(
    "%s keeps the %s text token at 4.5:1 or more, for the signs and any text over it",
    (tone, name) => {
      expect(contrast(set[name]!, set[tone]!)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("the left edge of a line (accent-strong, success, danger) reaches 3:1 on its own tone", () => {
    expect(contrast(set["accent-strong"]!, set["code-highlight"]!)).toBeGreaterThanOrEqual(3);
    expect(contrast(set.success!, set["code-add"]!)).toBeGreaterThanOrEqual(3);
    expect(contrast(set.danger!, set["code-remove"]!)).toBeGreaterThanOrEqual(3);
  });

  it("the copy button text (fg-muted on surface-3) reaches 4.5:1", () => {
    expect(contrast(set["fg-muted"]!, set["surface-3"]!)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("generated CSS", () => {
  it("is in sync with design/tokens.json", () => {
    expect(() =>
      execFileSync("node", ["scripts/build-tokens.mjs", "--check"], { cwd: ROOT, stdio: "pipe" }),
    ).not.toThrow();
  });
});

describe("the color sets under an attribute, for the previews of the component pages", () => {
  const css = readFileSync(
    join(ROOT, "template", "src", "examples", "host", "previewTheme.css"),
    "utf8",
  );

  it.each(Object.keys(THEMES))(
    "holds every color of the %s theme, with the same value",
    (theme) => {
      const block = css.split(`[data-preview-theme="${theme}"] {`)[1]!.split("}")[0]!;
      for (const [name, value] of Object.entries(THEMES[theme]!)) {
        expect(block).toContain(`--sk-${name}: ${value};`);
      }
      expect(block).toContain(`color-scheme: ${theme};`);
    },
  );
});
