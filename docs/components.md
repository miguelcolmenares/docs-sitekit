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
- **FlowDiagram**, steps in a row that stack on small screens.
- **CommandTable**, a command and what it does.
- **Callout**, a note, a tip, an important point, a warning or a caution. The same five also come from markdown, see [Callouts](./callouts.md).
- **ToneBadge**, the only place a status color is chosen.

## Rules

- Borders of 1px, never shadows.
- Mono type for names, numbers and commands.
- Tones only through `ToneBadge`.
- Components take data through props. They never import site content.
