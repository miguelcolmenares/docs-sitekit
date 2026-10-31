---
title: SideCard
description: "A card of metadata, links and tags beside the text of a detail page, collapsed on a phone."
---

# SideCard

## About

The card of a [detail page](../detail-page.md): a version, a license, links and tags beside the text. A page gets it from `meta`, `links` and `tags` in its frontmatter, and the component takes its data through props and imports no content. It builds on the tag rules of [`CatalogFilter`](./catalog-filter.md), so `sitekit add side-card` restores that component too.

Its script belongs to the page, so a page shows one card. On a phone the card shows its first three rows and an "All details" button; the preview above does that on a narrow screen. A second card on the same page would not be collapsed, because the script takes the first one.

## Accessibility

- The card is an `<aside>` named by `label`, which is "Details" unless you change it.
- The metadata is a description list, so a screen reader says each label with its value. The links and the tags are lists named "Links" and "Tags".
- A long value, such as a hash or an address, wraps.
- The button has `aria-expanded` and is 44 px high. It is hidden in the HTML and shown by the script, so without JavaScript the whole card is shown and there is no dead control.
- A link is 44 px high.

## Source

- [`SideCard.tsx`](../../template/src/presentation/components/site/SideCard.tsx)
- [`sideCard.ts`](../../template/src/presentation/sideCard/sideCard.ts)
