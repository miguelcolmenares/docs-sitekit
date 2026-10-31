---
order: 4
description: A page with a card of metadata beside its text, written in the frontmatter.
meta:
  - label: Component
    value: SideCard
  - label: Install
    value: npx docs-sitekit add side-card
  - label: Layout
    value: DocPage.astro
  - label: Frontmatter
    value: meta, links and tags
  - label: Phone
    value: Above the text, collapsed to its first three rows
links:
  - label: Repository
    href: https://github.com/miguelcolmenares/docs-sitekit
  - label: Components
    href: ./components.md
  - label: Changelog
    href: ../CHANGELOG.md
tags: [Layout, Components]
---

# A detail page with a side card

A catalog entry (a component, a plugin, a package, an example) reads better as a page with the text on the left and a card on the right: its version, its license, its links, its tags. This page is one. The card beside it is written in the frontmatter of this file, and it is the same component any page of your site can use.

## Frontmatter

```yaml
---
meta:
  - label: Version
    value: "1.2.0"
  - label: License
    value: MIT
  - label: Checksum
    value: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
links:
  - label: Repository
    href: https://github.com/user/widget
  - label: Changelog
    href: ../CHANGELOG.md
tags: [Plugin, Forms]
---
```

- **`meta`** is a list of items with a `label` and a `value`. Both are text, so put a number such as `1.0` in quotes, or YAML reads it as the number 1. A long value, such as a hash or an address, wraps inside the card.
- **`links`** is a list of items with a `label` and an `href`. An `href` is a web address, a `mailto:` address, or a path to a file of the repository. A path is resolved like a link in the text: a page of the site becomes its route, and any other file becomes its address on the repository. A link to a file that does not exist, or one that is excluded from the site, is left out.
- **`tags`** is the same key the [filter bar](./components/catalog-filter.md) reads. The card shows the tags of its page.

A page has a card when `meta` or `links` has at least one valid item. A page that has only `tags` does not get a card, so an index with a filter bar does not change. A page with neither is laid out as before.

## What the reader sees

- **On a desktop** (the `lg` width and up) the text and the card sit side by side. The card is always complete and stays in view while the text scrolls. The page has no table of contents then, because the card takes its place, and from `lg` to `xl` the list of pages of the collection is hidden to leave room for the text.
- **On a phone** the card is under the title and above the text. It shows its first three rows, and a button, "All details", shows the rest, the links and the tags. The button has `aria-expanded` and is at least 44 px high, and it works with the keyboard like any button.
- **Without JavaScript** the card is shown in full, and the button is not.

## The component

`SideCard` takes the rows, the links and the tags through props and imports no content. The metadata is a description list, so a screen reader says each label with its value. It uses the tokens of the site, in both themes.

```tsx
<SideCard
  rows={[{ label: "License", value: "MIT" }]}
  links={[{ label: "Repository", href: "https://github.com/user/widget" }]}
  tags={["Plugin"]}
/>
```

`npx docs-sitekit add side-card` restores the component, its script, the rules that read the frontmatter, and the tag rules of the filter bar that they use. The layout that places it, `DocPage.astro`, is yours to edit.

## Checks

The card reads only `label` and `value` in `meta`, and `label` and `href` in `links`. `sitekit check` and the build report what is wrong with the card as a `card` finding, an error by default, with the file and the line of the key in the frontmatter:

```text
docs/widget.md:5: error: Item 2 of "meta" has the key "lable", which the card does not read. It takes "label" and "value".
```

- An unknown key, such as `lable` for `label`. The item keeps its place and the key is reported.
- An item that is not an object, or that has no text for one of its two keys. It is left out. A number such as `1.0` is not text, so write it in quotes.
- A `meta` or `links` that is not a list.
- A link that starts with `javascript:`, `data:` or another scheme than `http:`, `https:` or `mailto:`, or with `//`. It is left out.

A link to a file that does not exist, or to a file you excluded, is left out of the card and reported like the same link in the text, as a `links` or `excludedLinks` finding (warnings), at the line of its `href`. The `meta` and `links` keys are known to the `frontmatter` check, so they do not make it report them. Each kind follows `check` in `sitekit.config.json`, so `"check": { "card": "warning" }` lowers the card findings to warnings. See [Content](./content.md#what-check-finds-in-the-content).
