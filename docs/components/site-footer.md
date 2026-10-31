---
title: SiteFooter
description: "Brand, link columns and a legal bar."
---

# SiteFooter

## About

The footer of every page: the brand with a sentence and a command, one column of links for each group, and a legal line with the license, the version and a credit. The columns have explicit tracks, so they sit side by side from the `md` width and stack under it.

## Accessibility

- It is the `<footer>` of the page, which is a landmark.
- Each column is a `<nav>` named by its title, which is also its `h2`.
- A link is 44 px high on a phone and 32 px from the `md` width.
- An external link opens in a new tab with `rel="noopener noreferrer"` and shows an arrow that is `aria-hidden`. The arrow is the only sign of the new tab, so the link does not say it.
- A brand logo before a link is decorative.

## Source

- [`SiteFooter.tsx`](../../template/src/presentation/components/site/SiteFooter.tsx)
