---
order: 2
---

# Components

The design system is a set of React components, written in the shadcn style and rendered at build time. Only the copy button and the mobile menu hydrate.

## Layout

- **SiteHeader**, sticky and translucent, with the brand, the navigation, a GitHub link and one primary action.
- **Hero**, with a status badge, a headline, a lede, a copyable command and up to two actions.
- **SectionHeader**, a mono eyebrow, a heading and a lede.
- **SiteFooter**, the brand, link columns and a legal bar.
- **CtaBand**, a closing headline with a command and actions.

## Content

- **ItemCard** and **CardGrid**, for catalogs. The grid has explicit tracks, so columns line up.
- **FeatureGrid**, an icon, an eyebrow, a title and text.
- **StatRow**, two to five numbers, each with a label and an optional note.
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

## Rules

- Borders of 1px, never shadows.
- Mono type for names, numbers and commands.
- Tones only through `ToneBadge`.
- Components take data through props. They never import site content.
