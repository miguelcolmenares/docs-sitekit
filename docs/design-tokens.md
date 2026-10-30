---
order: 3
---

# Design tokens

`design/tokens.json` is the single source of truth for colors, radius, fonts, layout and motion. `npm run build:tokens` turns it into CSS variables.

## Colors

The site has two color sets with the same names: the dark set is the top-level `color` group, and the light set is `themes.light.color`. Surfaces climb from the page background through four raised steps, and text has five levels from bright to faint.

`npm run build:tokens` writes the dark set under `:root` and the light set under `:root[data-theme="light"]`. It also writes the light set for a page that has no `data-theme` attribute, under `prefers-color-scheme: light`. That is what a visitor without JavaScript gets with `theme.default` set to `system`. A test fails when a key is in one set and not in the other.

## Theme

`theme.default` in `sitekit.config.json` sets the theme a visitor sees first. Its values and its default are in the [configuration reference](./configuration.md#theme).

The header has a switch. A visitor's choice is saved in the browser under the `theme` key and wins over the default on every page. A script in the head applies the theme before the first paint, so there is no flash.

## The accent

The default accent is the blue of the VS Code editor: `color.accent` is `#4fc1ff`, `color.accent-strong` is `#007acc`, and `color.accent-contrast` is `#ffffff`, the text on the strong accent.

`accent` is the text color for links, labels and highlights. In the dark set it reaches 9.86:1 on the page background, and the light set has its own `accent`, listed below.

`accent-strong` is for fills, rings and borders only. Never use it as text on the dark ground: it reaches 4.41:1 there, below the 4.5:1 that text needs. A test fails when a template file uses it as a text color. The template uses it for the focus ring of buttons and tabs (`ring`), the text selection, the glow behind the hero and the quote border. Other focused elements get an outline in `accent`. `accent-contrast` is the text for a fill in that color, such as a button, and reaches 4.51:1 on it.

## Change the accent

Edit `color.accent`, `color.accent-strong` and, if the fill needs another text color, `color.accent-contrast` in `design/tokens.json`, then run `npm run build:tokens`. Edit the light values under `themes.light.color` as well, so the accent is right in both themes. Everything that uses the brand color follows.

A new accent must keep the contrast of the default. The token tests check `accent` on every surface it sits on, `accent-contrast` on `accent-strong`, and the focus ring on every ground, so a color that fails them fails `npm test`.

A site generated with `init` keeps its own `design/tokens.json`, so changing the kit does not change a site that already exists.

## Light set and measured contrast

Every text token is checked on every surface it sits on, at 4.5:1 or more (WCAG AA). The ratios below are measured with the WCAG formula from the light values in `design/tokens.json`. The contrast test checks the same pairs, and the browser meter checks every route in both themes.

| Token                             | Light value | bg    | bg-subtle | surface | surface-2 | surface-3 |
| --------------------------------- | ----------- | ----- | --------- | ------- | --------- | --------- |
| `fg`                              | `#1f2328`   | 15.80 | 14.87     | 14.84   | 13.94     | 12.94     |
| `fg-bright`                       | `#0d1117`   | 18.92 | 17.81     | 17.78   | 16.70     | 15.50     |
| `fg-muted`                        | `#49515a`   | 8.05  | 7.58      | 7.56    | 7.11      | 6.60      |
| `fg-dim`                          | `#57606a`   | 6.39  | 6.01      | 6.00    | 5.64      | 5.23      |
| `accent`                          | `#0066b8`   | 5.85  | 5.50      | 5.49    | 5.16      | 4.79      |
| `success`                         | `#116329`   | 7.39  | 6.96      | 6.94    | 6.53      | 6.06      |
| `warn`                            | `#7d4e00`   | 7.09  | 6.67      | 6.66    | 6.26      | 5.81      |
| `danger`                          | `#a40e26`   | 7.87  | 7.40      | 7.39    | 6.94      | 6.44      |
| `fg-faint` (decoration only, 3:1) | `#737c86`   | 4.24  | 3.99      | 3.98    | 3.74      | 3.47      |
| `accent-strong` (focus ring, 3:1) | `#007acc`   | 4.51  | 4.24      | 4.24    | 3.98      | 3.69      |

Other pairs:

| Pair                                                               | Ratio |
| ------------------------------------------------------------------ | ----- |
| `accent-contrast` `#ffffff` text on `accent-strong` `#007acc` fill | 4.51  |
| `bg` `#ffffff` text on `fg-bright` `#0d1117` (primary button)      | 18.92 |
| `border-strong` `#afb8c1` on `bg` (a border can be seen)           | 2.01  |
| `border-hover` `#8c959f` on `bg`                                   | 3.04  |

Code blocks use Shiki's `github-light-high-contrast` theme in light and `github-dark-default` in dark. Every token color of the light code theme reaches 4.5:1 on the code surface `#f6f8fa`. The lowest is the comment color `#66707b`, at 4.73:1.

The code blocks have three tones for lines, `code-highlight`, `code-add` and `code-remove`, in both color sets. They are tints of the code surface, kept light enough that the code colors still read on them. The lowest ratio of any token color of the code theme on any of the three is 5.18:1 in the dark set and 4.55:1 in the light set, both on `code-highlight` and both for the comment color. The contrast test checks every token color of both code themes on every tone, and that `fg`, `fg-muted`, `success` and `danger` reach 4.5:1 on them. See [Code blocks](./code-blocks.md).

## Type

Geist for text and Geist Mono for names, numbers and commands, both self-hosted. No request leaves the page for fonts. The two files of the first screen are preloaded, and each font has a fallback with its measures, see [Performance](./performance.md#how-the-fonts-are-loaded).
