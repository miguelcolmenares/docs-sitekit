---
title: FeatureGrid
description: "Icon, eyebrow, title and text."
---

# FeatureGrid

## About

Features as cards, two columns from the `md` width. Each has an icon, a short eyebrow, a title and a sentence. The icon can be a brand logo, see [Brand logos](../brand-logos.md).

## Accessibility

- Each feature is an `<article>` with an `h3`, so put the grid under a heading of level 2.
- The icon is decorative and `aria-hidden`.
- The eyebrow uses the `brand` token, which reaches AA on the surface of the card in both themes.

## Source

- [`FeatureGrid.tsx`](../../template/src/presentation/components/site/FeatureGrid.tsx)
