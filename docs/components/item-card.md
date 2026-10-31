---
title: ItemCard
description: "ItemCard and CardGrid for catalogs."
---

# ItemCard

## About

A link card for a catalog: an optional badge, a title in mono type, a description and a hint, in a `CardGrid` that has explicit tracks so columns line up. Any other attribute of a link, such as the `data-` attributes that [`CatalogFilter`](./catalog-filter.md) reads, goes to the link.

## Accessibility

- The whole card is one link, so a screen reader reads the badge, the title, the description and the hint as the name of the link.
- The arrow is `aria-hidden`.
- The title is an `h3`, so put the grid under a heading of level 2.
- The grid is one column on a phone, two from `md` and three from `lg`, and a card never needs a sideways scroll.

## Source

- [`ItemCard.tsx`](../../template/src/presentation/components/site/ItemCard.tsx)
