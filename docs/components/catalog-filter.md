---
title: CatalogFilter
description: "A text field and tag buttons that narrow the cards of an index page, with the state in the address."
---

# CatalogFilter

## About

A bar above the cards of an index page, to narrow the page you are already on. Search finds a page across the site, the filter narrows this one. It is built from the `tags` in the frontmatter of the pages that the grid shows:

```markdown
---
tags: [Setup, Guide]
---
```

The index layout, `CollectionIndex.astro`, uses it and is yours to edit. In the preview above the cards carry the `data-filter-item`, `data-filter-tags` and `data-filter-text` attributes that the script reads. A page shows one bar, because the script takes the first one. The preview changes the address of this page, as the filter does on an index.

- **It appears only when a page of the index has a tag.** An index without tags looks and works as before.
- **The text field** keeps the cards that contain every word, in the title, the description or the tags, whatever the case and the accents.
- **The tag buttons** are toggle buttons. With several tags selected a card needs all of them.
- **The state is in the address**, `?tag=setup&tag=guide&q=card`, so a filtered view can be shared, and loading that address shows it. A tag button adds a history entry, so the back button undoes it. Typing replaces the current entry, so one search does not fill the history.
- The matching is a set of pure functions in `src/domain/filter/`, the same ones that build the page and run in the browser.
- `sitekit add catalog-filter` restores its component, its script and the matching rules.

## Accessibility

- Without JavaScript every card is shown and the bar is not. The bar is hidden in the HTML, and a one line script right after it shows it, so it is in the first paint and nothing moves.
- The tag buttons have `aria-pressed`. The text field has a visible label.
- The status line is a polite live region that says "N of M shown." A state with no match says "Nothing matches this filter." and shows a "Clear filter" button.
- Every control is at least 44 px, and the focus ring is the one of the rest of the site.

## Source

- [`CatalogFilter.astro`](../../template/src/presentation/components/site/CatalogFilter.astro)
- [`catalogFilter.ts`](../../template/src/presentation/filter/catalogFilter.ts)
