#!/usr/bin/env node
// Generate template/src/styles/tokens.css from template/design/tokens.json.
// The JSON is the source of truth. Run with --check to fail when the CSS is out of date.
// The dark set (the top-level groups) goes under `:root`. The light set (`themes.light.color`)
// goes under `:root[data-theme="light"]`, and under a media query for a page that has no
// `data-theme` attribute, which is what a visitor without JavaScript gets with `theme.default` "system".
//
// It also writes the color sets for a part of a page: `[data-preview-theme="dark"]` and `[data-preview-theme="light"]`,
// in template/src/examples/host/previewTheme.css, which only the component pages of this project use. A preview there
// can show a component in the other theme without leaving the page.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = join(ROOT, "template", "design", "tokens.json");
const TARGET = join(ROOT, "template", "src", "styles", "tokens.css");
const PREVIEW_TARGET = join(ROOT, "template", "src", "examples", "host", "previewTheme.css");

const declarations = (group, values) =>
  Object.entries(values).map(
    ([name, value]) => `  --sk-${group === "color" ? "" : `${group}-`}${name}: ${value};`,
  );

/** Fail when a key is in one color set and not in the other, so a theme can never miss a token. */
export function checkThemeParity(tokens) {
  const dark = Object.keys(tokens.color ?? {});
  const light = Object.keys(tokens.themes?.light?.color ?? {});
  const onlyDark = dark.filter((key) => !light.includes(key));
  const onlyLight = light.filter((key) => !dark.includes(key));
  if (onlyDark.length || onlyLight.length)
    throw new Error(
      `The light and dark color sets differ. Only in dark: ${onlyDark.join(", ") || "none"}. Only in light: ${onlyLight.join(", ") || "none"}.`,
    );
}

export function renderTokens(tokens) {
  checkThemeParity(tokens);
  const { themes, ...dark } = tokens;
  const light = themes.light.color;
  const lines = [
    "/* Generated from design/tokens.json by scripts/build-tokens.mjs. Do not edit. */",
    ":root {",
  ];
  for (const [group, values] of Object.entries(dark)) lines.push(...declarations(group, values));
  lines.push("}", ':root[data-theme="light"] {', ...declarations("color", light), "}");
  lines.push(
    "@media (prefers-color-scheme: light) {",
    ':root:not([data-theme="dark"]) {',
    ...declarations("color", light),
    "}",
    "}",
    "",
  );
  return lines.join("\n");
}

/** The two color sets again, each under an attribute that can be put on any element. */
export function renderPreviewThemes(tokens) {
  checkThemeParity(tokens);
  const { color: dark, themes } = tokens;
  return [
    "/* Generated from design/tokens.json by scripts/build-tokens.mjs. Do not edit. */",
    "/* The colors of each theme under an attribute of its own, so a preview can show the other theme. */",
    '[data-preview-theme="dark"] {',
    "  color-scheme: dark;",
    ...declarations("color", dark),
    "}",
    '[data-preview-theme="light"] {',
    "  color-scheme: light;",
    ...declarations("color", themes.light.color),
    "}",
    "",
  ].join("\n");
}

const tokens = JSON.parse(readFileSync(SOURCE, "utf8"));
const outputs = [
  { target: TARGET, css: renderTokens(tokens), name: "template/src/styles/tokens.css" },
  {
    target: PREVIEW_TARGET,
    css: renderPreviewThemes(tokens),
    name: "template/src/examples/host/previewTheme.css",
  },
];
if (process.argv.includes("--check")) {
  for (const { target, css, name } of outputs) {
    let current = "";
    try {
      current = readFileSync(target, "utf8");
    } catch {
      // a missing file counts as out of date
    }
    if (current !== css) {
      console.error(`${name} is out of date. Run \`node scripts/build-tokens.mjs\`.`);
      process.exit(1);
    }
  }
} else {
  for (const { target, css } of outputs) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, css);
  }
}
