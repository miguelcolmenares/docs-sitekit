#!/usr/bin/env node
// Fail when design/tokens.json has a pair of colors below the contrast it needs (WCAG 2.2 AA).
// Run it from the site folder, after a change to the tokens: node scripts/check-contrast.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GROUNDS = ["bg", "bg-subtle", "surface", "surface-2", "surface-3"];
const TEXT = ["fg", "fg-bright", "fg-muted", "fg-dim", "accent", "success", "warn", "danger"];

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const channel = (value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** The contrast ratio of two colors written as #rrggbb. */
export function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Every pair that is too low, as a line of text, and how many pairs were measured. */
export function checkTokens(tokens) {
  const sets = { dark: tokens.color, light: tokens.themes.light.color };
  const problems = [];
  let checked = 0;
  const need = (theme, foreground, background, minimum, role) => {
    const set = sets[theme];
    const ratio = contrast(set[foreground], set[background]);
    checked += 1;
    if (ratio < minimum) {
      problems.push(
        `${theme}: ${foreground} ${set[foreground]} on ${background} ${set[background]} is ${ratio.toFixed(2)}:1, ${role} needs ${minimum}:1`,
      );
    }
  };
  for (const theme of Object.keys(sets)) {
    for (const ground of GROUNDS) {
      for (const text of TEXT) need(theme, text, ground, 4.5, "text");
      need(theme, "fg-faint", ground, 3, "decoration");
      need(theme, "accent-strong", ground, 3, "the focus ring");
    }
    need(theme, "accent-contrast", "accent-strong", 4.5, "text on a fill");
  }
  return { problems, checked };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tokens = JSON.parse(readFileSync(join(process.cwd(), "design", "tokens.json"), "utf8"));
  const { problems, checked } = checkTokens(tokens);
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    console.error(`${problems.length} of ${checked} pairs are too low.`);
    process.exit(1);
  }
  console.log(`${checked} pairs reach the contrast they need.`);
}
