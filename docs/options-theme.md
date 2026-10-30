# Options: theme and design

One key picks the theme a visitor sees first: `theme.default`. Everything else about the look is in `design/tokens.json`, not in the config.

The key is documented in the [configuration reference](./configuration.md#theme). This page says what each value does to the page.

## The first theme

```json title="sitekit.config.json" {3}
{
  "theme": { "default": "system" }
}
```

The three values change what the server writes into every page:

| `default`         | `data-theme` on `<html>` | `theme-color` in the head |
| ----------------- | ------------------------ | ------------------------- |
| `dark`, or no key | `dark`                   | `#09090b`                 |
| `light`           | `light`                  | `#ffffff`                 |
| `system`          | no attribute             | `#09090b`                 |

Those two colors are the `bg` token of the dark and of the light set. With `system` the page has no theme in its HTML, because the server cannot know the system of the visitor. A script in the head decides before the first paint, so there is no flash.

What the script does, in this order:

1. It uses the choice the visitor saved with the switch in the header, kept in the browser under the key `theme`.
2. Else it uses `theme.default`. With `system` that means `light` when the operating system asks for a light theme and `dark` otherwise, and the page follows a change of that setting while it is open.

It writes the result as `data-theme` on `<html>`, sets `color-scheme` and changes the `theme-color` of the head to match. A visitor who used the switch keeps their choice on every page, whatever `default` says.

Without JavaScript the `dark` and `light` values still work, because they are in the HTML. With `system` the styles follow the `prefers-color-scheme` setting of the browser, and the page is light for a visitor whose system is light.

> [!TIP]
> Pick `system` when you do not know who reads the site. Pick `dark` or `light` when the brand of the site is one of them: the visitors still have the switch.

## Colors, radius and fonts

They are not config keys. `design/tokens.json` is the only source of the colors of both themes, the radius, the fonts and the layout, and `npm run build:tokens` turns it into CSS variables. The accent is the color most sites change, and the contrast tests fail a new one that is too faint to read. See [Design tokens](./design-tokens.md).
