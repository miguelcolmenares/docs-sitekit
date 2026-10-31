---
title: StatRow
description: "Two to five numbers, each with a label and a note."
---

# StatRow

## About

A row of numbers for a project page: downloads, a version, the Node versions it supports. The value is the large text, in the mono face, and a long value wraps inside its card.

- It takes two to five items and throws, with the limits in the message, outside them.
- One column on a phone, then up to one column per item on wider screens, on explicit tracks.
- The numbers come from props. The kit fetches nothing at run time, so the page decides where a number comes from.
- The home page shows a row when `sitekit.config.json` has a `stats` key with the same items, as this site does. Without the key, nothing is shown.

## Accessibility

- It is a description list, so a screen reader says each label with its value, and no meaning depends on color alone.
- A long value wraps (`overflow-wrap: anywhere`), so it never widens the page.
- The label, the value and the note use the `fg-muted` and `fg-bright` tokens, which reach AA in both themes, and the row chooses no status color.

## Source

- [`StatRow.tsx`](../../template/src/presentation/components/site/StatRow.tsx)
