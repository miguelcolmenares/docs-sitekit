---
title: PageInfo
description: "The line at the foot of a page: an edit link and the date of the last change."
---

# PageInfo

## About

The line at the foot of a page: an "Edit this page" link to the source file on the repository host, and the date of the last change. Each part shows only when it is given, and the whole line is left out when neither is. See [Edit this page](../edit-link.md) for the configuration that feeds it.

## Accessibility

- The link is at least 44 px high.
- The date is a `<time>` element with a machine-readable `datetime`.
- The pencil icon is `aria-hidden`.
- The text uses the `fg-muted` token, which reaches AA in both themes.

## Source

- [`PageInfo.tsx`](../../template/src/presentation/components/site/PageInfo.tsx)
