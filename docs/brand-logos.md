---
order: 3
---

# Brand logos

The `icon` of a feature in `sitekit.config.json` is a [lucide](https://lucide.dev) name, and lucide has no brand logos. A logo is written as `brand:<slug>` instead:

```json
{
  "features": [
    {
      "icon": "brand:github",
      "eyebrow": "Source",
      "title": "On GitHub",
      "text": "The code is public."
    }
  ]
}
```

The same value works wherever the kit takes an icon: the `features` of the config, the `name` of the `Icon` component, `FeatureGrid`, and the `icon` of a footer link in `SiteFooter`.

A logo is drawn as an inline SVG, filled with `currentColor`. It takes the color of the text around it, and the hover color of a link it is in. It is monochrome on purpose, the kit does not use brand colors. The page asks no host for it: the path data is part of the site, and the generated site has no new dependency.

## The brands that ship

| `brand:` value      | Brand        |
| ------------------- | ------------ |
| `brand:astro`       | Astro        |
| `brand:docker`      | Docker       |
| `brand:github`      | GitHub       |
| `brand:gitlab`      | GitLab       |
| `brand:nextdotjs`   | Next.js      |
| `brand:nodedotjs`   | Node.js      |
| `brand:npm`         | npm          |
| `brand:react`       | React        |
| `brand:tailwindcss` | Tailwind CSS |
| `brand:typescript`  | TypeScript   |
| `brand:vercel`      | Vercel       |

The slug is the one [Simple Icons](https://simpleicons.org) uses, so Next.js is `nextdotjs`. A slug that does not exist fails the build, names the slug, and suggests the closest ones:

```text
features.0.icon: Unknown brand "nextjs". Did you mean brand:nextdotjs (Next.js)? A logo that does not ship can be added as "brand:custom/<name>".
```

## The repository button

When `site.repository` is set, the header shows a button with the logo of the host and its name, and the footer has the same link in the Project column. The kit has the logos of GitHub and GitLab. For any other host the button says "Repository" and uses a plain icon.

The button is 44 px tall. On a phone it moves into the open menu, because the bar has no room for it, and keeps the 44 px target there. The footer link is 44 px tall on a phone too.

## Your own logo

For a brand the kit does not ship, add an SVG file to a `brands` folder next to `sitekit.config.json`, and use it as `brand:custom/<name>`:

```text
site/
  sitekit.config.json
  brands/
    acme.svg
```

```json
{ "icon": "brand:custom/acme" }
```

The name is the file name without `.svg`, in lowercase letters, digits and hyphens. A name with no file fails the build and lists the files that are there. `sitekit check` reads the folder too.

The file is read as data, not copied. The kit keeps the `viewBox` and the `d` of each `<path>`, and refuses the rest, with the file named in the message:

- Only `<svg>`, `<path>`, `<g>`, `<title>` and `<desc>` are allowed. Convert other shapes to paths in your design tool. This also keeps scripts and external references out of a logo.
- A path with a `stroke`, or with `fill="none"`, is refused. Convert strokes to outlines.
- A `transform` is refused. Apply it in your design tool so the path data is final.
- The file needs a `viewBox`, and it must be 20 KB or less.

Colors in the file are ignored, the logo is drawn in the text color. You are responsible for the right to use the logo and for following its owner's guidelines.

## Which brands are not shipped, and why

- **AWS.** Its logo is governed by the AWS trademark guidelines and the Architecture Icons terms, and Simple Icons does not carry it. The kit ships no AWS mark. Download the official files from [the AWS Architecture Icons page](https://aws.amazon.com/architecture/icons/) and add the one you need as a custom logo.
- **LinkedIn, Playwright and Visual Studio Code.** They are not in Simple Icons 16.36.0, the version the kit reads. Use a custom logo from the owner's brand page.
- **PHP.** The logo is released by its author under CC BY-SA 4.0 ([php.net/download-logos](https://www.php.net/download-logos)), not CC0, so it is out of the default set.

## The licence gate

The kit does not ship a logo on the memory of anyone about its licence. `npm run build:brands` in the repository of the kit reads the pinned `simple-icons` package (version `16.36.0`, exact, a development dependency of the kit only) and writes `template/src/domain/brands/brandData.ts`, with the licence of each icon. The list of brands is `scripts/brands/curated.json`.

- Simple Icons is CC0, and an icon that has its own licence says so in its `license` field. An icon whose licence is not CC0 fails the script.
- The way out is an entry in `scripts/brands/allowlist.json`, with the `license`, the `author` and the `attribution` text. The entry must name the same licence the icon has. Then the attribution is written to the module and to `THIRD_PARTY_NOTICES.md`.
- The script rewrites only the block between two markers of `THIRD_PARTY_NOTICES.md`, so a re-run leaves no diff. `npm run build:brands -- --check` fails when the module or the notices are out of date.

To add a brand to the kit, add its slug to `curated.json` and run `npm run build:brands`. Moving to a newer Simple Icons means changing the pinned version on purpose, never `latest`, because a moving version changes what the kit ships between two builds.

The marks belong to their owners. Showing one names the product or service and does not mean the owner endorses the site. Check the guidelines of a brand before you use its logo, the module keeps the `guidelines` link where Simple Icons has one.
