---
title: Callout
description: "A note, a tip, an important point, a warning or a caution."
---

# Callout

## About

A highlighted note inside a page, with five kinds. The same five also come from markdown as `> [!NOTE]` and the others, see [Callouts](../callouts.md); both look the same.

## Accessibility

- It is an `<aside>` with `role="note"`, and it is a note, not an alert: nothing is announced when it appears.
- The kind is written in the text (Note, Tip, Important, Warning, Caution), so the color of the edge and of the label is not the only cue.
- The icon is `aria-hidden`.
- The tones are the tokens `brand`, `success`, `warn`, `fg-bright` and `destructive`, and the label uses the same tone as the edge. All reach AA on the callout in both themes.

## Source

- [`Callout.tsx`](../../template/src/presentation/components/site/Callout.tsx)
