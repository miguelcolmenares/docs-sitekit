# Options: brand logos

A brand logo is not a key of its own. It is a value of `icon`, in the cards of the `features` list.

The key is documented in the [configuration reference](./configuration.md#features). The list of logos that ship, how to add your own, and the licence rules are in [Brand logos](./brand-logos.md). This page shows the three forms of the value and what each one draws.

## The three forms of an icon

```json title="sitekit.config.json" {4,10,16}
{
  "features": [
    {
      "icon": "shield-check",
      "eyebrow": "Safe",
      "title": "Retries with a limit",
      "text": "A job that keeps failing stops, and says why."
    },
    {
      "icon": "brand:github",
      "eyebrow": "Open",
      "title": "The code is public",
      "text": "Read it, fork it, send a fix."
    },
    {
      "icon": "brand:custom/acme",
      "eyebrow": "Made by",
      "title": "From the Acme team",
      "text": "Used in production at Acme."
    }
  ]
}
```

| `icon`              | What the card draws                                                             |
| ------------------- | ------------------------------------------------------------------------------- |
| `shield-check`      | The lucide icon with that name, as an outline drawn with a stroke.              |
| `brand:github`      | The GitHub logo that ships with the kit, as a solid shape.                      |
| `brand:custom/acme` | The logo in `brands/acme.svg`, next to `sitekit.config.json`, as a solid shape. |

A brand logo is an inline SVG with `fill="currentColor"`, so it takes the brand color of the icon square and follows the theme. It is hidden from assistive technology, and the page asks no other host for it.

## When the value is wrong

- **A brand that does not ship** fails the build before anything is drawn, and the message names the closest ones: `features.0.icon: Unknown brand "nextjs". Did you mean brand:nextdotjs (Next.js)? A logo that does not ship can be added as "brand:custom/<name>".`
- **A custom name with no file** fails the build too, and lists the files that are there: `The icon "brand:custom/acme" has no file: add brands/acme.svg to the site folder. The folder brands/ does not have any .svg file yet.`

The same value works wherever the kit takes an icon, see [Brand logos](./brand-logos.md).
