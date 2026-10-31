# Change the tokens

Give the site a new accent in `design/tokens.json`, rebuild the CSS, and check the contrast of the new colors.

`design/tokens.json` is the source of every color, radius, font and width. `src/styles/tokens.css` is generated from it, and the pages read the CSS variables in that file. The [Design tokens](./design-tokens.md) page lists every token and the roles of the three accent tokens: `accent` is the color of text, `accent-strong` is for fills, rings and borders and never for text, and `accent-contrast` is the text on a fill.

## Change the accent

The change below moves the accent from blue to teal, in the dark set and in the light set. It is written as a diff, so you see the four values that change. `accent-contrast` stays white.

<!-- prettier-ignore-start -->
<!-- recipe-file: tokens site/design/tokens.json.diff -->
```diff title="site/design/tokens.json"
diff --git a/site/design/tokens.json b/site/design/tokens.json
--- a/site/design/tokens.json
+++ b/site/design/tokens.json
@@ -15,4 +15,4 @@
     "fg-faint": "#6b6b71",
-    "accent": "#4fc1ff",
-    "accent-strong": "#007acc",
+    "accent": "#2dd4bf",
+    "accent-strong": "#0f766e",
     "accent-contrast": "#ffffff",
@@ -41,4 +41,4 @@
         "fg-faint": "#737c86",
-        "accent": "#0066b8",
-        "accent-strong": "#007acc",
+        "accent": "#0b5f59",
+        "accent-strong": "#0f766e",
         "accent-contrast": "#ffffff",
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

Then rebuild the CSS, from the site folder:

```bash
npm run build:tokens
```

`npm run build:tokens -- --check` fails when `tokens.css` does not match `tokens.json`, so a CI step can stop a change to one without the other. Before the command is run, the check fails and says `src/styles/tokens.css is out of date`.

Everything that uses the brand color follows, and nothing else needs to change.

## Guard the contrast

A color that looks right can fail the contrast that WCAG asks for. A text color needs 4.5:1 on every surface it sits on, and a focus ring needs 3:1. Pairs that look fine in one set can fail in the other, which is why this script measures both sets:

<!-- prettier-ignore-start -->
<!-- recipe-file: tokens site/scripts/check-contrast.mjs -->
```js title="site/scripts/check-contrast.mjs"
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
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

Add the file to `site/scripts/` and run it after a change to the tokens:

```bash
node scripts/check-contrast.mjs
```

With the teal accent it prints `102 pairs reach the contrast they need.` A violet strong accent, `#6d28d9`, looks good on a white page, but the focus ring would be 2.39:1 on the darkest surface of the dark set. The script names the pair:

```text
dark: accent-strong #6d28d9 on surface-3 #1c1c21 is 2.39:1, the focus ring needs 3:1
```

The kit tests its own tokens with the same rules, plus the code colors and the tones of the code lines. The script checks the pairs that a new accent can break. It does not replace the measure in the browser, which reads the real colors of the text on a page.

## How it is tested

- `scripts/verify-package.mjs` (section 5d, `tokens`) applies the diff to a site made by `init`. It checks that `build:tokens -- --check` fails, runs `build:tokens`, checks that `tokens.css` has the new values in both sets, and that `--check` passes. It runs the script on the new tokens, and on a tokens file with the violet strong accent, which must fail with the line above.
- The group `recipe tokens` of `e2e/specs/recipes.spec.ts` checks that the page computes the new accent in each theme, that text drawn in the accent has that color, and that six routes of the site (home, docs, a document, the new collection, the interactive page and the changelog) reach AA in both themes with it.
- `src/__tests__/recipes.test.ts` runs the script on the tokens of the kit, which pass, and on tokens with a weak accent, which fail with the pair named.
