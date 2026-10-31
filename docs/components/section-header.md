---
title: SectionHeader
description: "Mono eyebrow, heading and lede."
---

# SectionHeader

## About

The top of a section: a short eyebrow in mono type, a heading and a lede. Children go on the right, and wrap under the text on a phone.

## Accessibility

- The heading is an `h2`. A page has one `h1`, so pass `as="h1"` only for the heading that names the page.
- The eyebrow is a paragraph, not a heading, so it adds nothing to the outline of the page.
- The heading and the lede use the `fg-bright` and `fg-muted` tokens, which reach AA in both themes.

## Source

- [`SectionHeader.tsx`](../../template/src/presentation/components/site/SectionHeader.tsx)
