---
title: ToneBadge
description: "The only way to show a status color."
---

# ToneBadge

## About

A small pill with a text and one of four tones. A status color is chosen here and nowhere else, and a test fails when another component names one. `Callout` is the other place that has a tone of its own, for its edge and label.

## Accessibility

- The tone is never the only cue: the badge always holds a text that says the status in words.
- The dot is decorative, so it is `aria-hidden`.
- The badge is not interactive and takes no focus.
- Every tone reaches WCAG AA on the page and on a surface in both themes, checked on the tokens and measured in the browser on every route.

## Source

- [`ToneBadge.tsx`](../../template/src/presentation/components/site/ToneBadge.tsx)
