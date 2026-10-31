---
title: Breadcrumbs
description: "Breadcrumb trail for a page."
---

# Breadcrumbs

## About

The trail from the home page to the current page, built on the `Breadcrumb` of shadcn/ui. The last item is the page itself and has no link.

## Accessibility

- It is a `<nav>` named "breadcrumb" that holds an ordered list.
- The current page has `aria-current="page"`.
- The chevron between two items is `aria-hidden`.
- A link is 44 px high on a phone and 24 px from the `md` width.

## Source

- [`Breadcrumbs.tsx`](../../template/src/presentation/components/site/Breadcrumbs.tsx)
- [`breadcrumb.tsx`](../../template/src/presentation/components/ui/breadcrumb.tsx)
