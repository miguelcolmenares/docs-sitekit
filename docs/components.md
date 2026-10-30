---
order: 2
---

# Components

The design system is a set of React components, written in the shadcn style and rendered at build time. Only the copy button and the mobile menu hydrate.

## Layout

- **SiteHeader**, sticky and translucent, with the brand, the navigation, a repository button with the logo of the host and one primary action.
- **Hero**, with a status badge, a headline, a lede, a copyable command and up to two actions.
- **SectionHeader**, a mono eyebrow, a heading and a lede.
- **SiteFooter**, the brand, link columns and a legal bar.
- **CtaBand**, a closing headline with a command and actions.

## Content

- **ItemCard** and **CardGrid**, for catalogs. The grid has explicit tracks, so columns line up.
- **FeatureGrid**, an icon, an eyebrow, a title and text. The icon can be a brand logo, see [Brand logos](./brand-logos.md).
- **StatRow**, two to five numbers, each with a label and an optional note.
- **CatalogFilter**, a text field and tag buttons that narrow the cards of an index page. See [CatalogFilter](#catalogfilter).
- **FlowDiagram**, steps in a row that stack on small screens.
- **CommandTable**, a command and what it does.
- **Callout**, a note, a tip, an important point, a warning or a caution. The same five also come from markdown, see [Callouts](./callouts.md).
- **ToneBadge**, the only place a status color is chosen.

## StatRow

A row of numbers for a project page: downloads, a version, the Node versions it supports. It is a description list, so a screen reader says each label with its value, and no meaning depends on color alone. The value is the large text, in the mono face, and a long value wraps inside its card.

```tsx
<StatRow
  stats={[
    { value: "1.2k", label: "Downloads", note: "Last 30 days" },
    { value: "v1.2.3", label: "Version" },
  ]}
/>
```

- It takes two to five items and throws, with the limits in the message, outside them.
- One column on a phone, then up to one column per item on wider screens, on explicit tracks.
- The numbers come from props. The kit fetches nothing at run time, so the page decides where a number comes from.
- The home page shows a row when `sitekit.config.json` has a `stats` key with the same items, as this site does. Without the key, nothing is shown.
- `sitekit add stat-row` restores the file.

## CatalogFilter

A bar above the cards of an index page, to narrow the page you are already on. Search finds a page across the site, the filter narrows this one. It is built from the `tags` in the frontmatter of the pages that the grid shows:

```markdown
---
tags: [Setup, Guide]
---
```

- **It appears only when a page of the index has a tag.** An index without tags looks and works as before.
- **Without JavaScript every card is shown and the bar is not.** The bar is hidden in the HTML, and a one line script right after it shows it, so it is in the first paint and nothing moves. A card that does not match gets the `hidden` attribute, and a group with no card left is hidden with its heading.
- **The text field** keeps the cards that contain every word, in the title, the description or the tags, whatever the case and the accents.
- **The tag buttons** are toggle buttons with `aria-pressed`. With several tags selected a card needs all of them.
- **The status line** is a polite live region that says "N of M shown." A state with no match says "Nothing matches this filter." and shows a "Clear filter" button.
- **The state is in the address**, `?tag=setup&tag=guide&q=card`, so a filtered view can be shared, and loading that address shows it. A tag button adds a history entry, so the back button undoes it. Typing replaces the current entry, so one search does not fill the history.
- Every control is at least 44 px, and the focus ring is the one of the rest of the site.
- `sitekit add catalog-filter` restores its component, its script and the matching rules. The index layout that uses it, `CollectionIndex.astro`, is yours to edit.

The matching is a set of pure functions in `src/domain/filter/`, the same ones that build the page and run in the browser.

## Rules

- Borders of 1px, never shadows.
- Mono type for names, numbers and commands.
- Tones only through `ToneBadge`.
- Components take data through props. They never import site content.
