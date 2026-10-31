---
title: ReferenceTable
description: "A table for a reference: names in code, a type, a default, allowed values and a text, in a scrollable region."
---

# ReferenceTable

## About

A table for a reference page written in Astro: a column of code names, a type, a default, the values a name accepts and a text. The configuration reference of this project is markdown, see [Configuration reference](../configuration.md), and a markdown table already scrolls and takes focus. Use the component where a page is `.astro` and the rows are data. The props tables of these pages are drawn with it.

- **The wrapper scrolls, not the page.** The table is 40rem wide at least, so on a phone it scrolls sideways inside a region that has a border, and the page does not scroll with it.
- **Names stay on one line**, so a long key scrolls instead of breaking in the middle. The description column wraps.
- **`default` and `allowed` are optional.** A row without them shows a dash, never an empty cell.

## Accessibility

- The wrapper has `role="region"`, an `aria-label` from `label` and `tabindex="0"` in the HTML, so Tab reaches it and the arrow keys scroll it, with no JavaScript. The focus ring is the one of the rest of the site.
- It is a real table: it has a caption, `scope="col"` headers and the name of each row as its `scope="row"` header, so a screen reader says the name with each cell.
- The text uses the `fg`, `fg-muted` and `brand` tokens, which reach AA in both themes, and it chooses no status color.

## Source

- [`ReferenceTable.tsx`](../../template/src/presentation/components/site/ReferenceTable.tsx)
