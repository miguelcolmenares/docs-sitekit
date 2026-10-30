---
order: 3
---

# Design tokens

`design/tokens.json` is the single source of truth for colors, radius, fonts, layout and motion. `npm run build:tokens` turns it into CSS variables.

## Colors

The site is dark only. Surfaces climb from the page background through four raised steps, and text has five levels from bright to faint.

## The accent

The default accent is the blue of the VS Code editor: `color.accent` is `#4fc1ff`, `color.accent-strong` is `#007acc`, and `color.accent-contrast` is `#ffffff`, the text on the strong accent.

`accent` is the text color for links, labels and highlights. It reaches 9.86:1 on the page background.

`accent-strong` is for fills, rings and borders only. Never use it as text on the dark ground: it reaches 4.41:1 there, below the 4.5:1 that text needs. A test fails when a template file uses it as a text color. The template uses it for the focus ring of buttons and tabs (`ring`), the text selection, the glow behind the hero and the quote border. Other focused elements get an outline in `accent`. `accent-contrast` is the text for a fill in that color, such as a button, and reaches 4.51:1 on it.

## Change the accent

Edit `color.accent`, `color.accent-strong` and, if the fill needs another text color, `color.accent-contrast` in `design/tokens.json`, then run `npm run build:tokens`. Everything that uses the brand color follows.

A new accent must keep the contrast of the default. The token tests check `accent` on every surface it sits on, `accent-contrast` on `accent-strong`, and the focus ring on every ground, so a color that fails them fails `npm test`.

A site generated with `init` keeps its own `design/tokens.json`, so changing the kit does not change a site that already exists.

## Type

Geist for text and Geist Mono for names, numbers and commands, both self-hosted. No request leaves the page for fonts.
