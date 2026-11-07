---
title: SourceToHtml
description: "A Markdown sample with its source, its preview and the HTML the kit builds from it."
---

# SourceToHtml

## About

The home page of this site shows one of the things the kit does for every page: a Markdown file becomes HTML. The component
shows a sample. A button chooses the sample. On the left is its Markdown source, with the title of the file. On the right is
the page the sample builds, in a Preview tab, and the HTML of that page, in an HTML tab.

The samples are not written by hand in the component. The build renders each one with the function that renders a page,
`renderMarkdown`, so the preview and the HTML are what the kit writes for that file. Its relative links are rewritten by the
same rules, and its code is highlighted at build time. The page needs no Markdown parser and no highlighter in the browser.
Only the buttons run JavaScript, and that is loaded when the component is visible.

The samples come from the config key `demo`, one entry for each sample: its button label, the path of the file it stands for,
and the Markdown file, which is read from the site folder. Three or four samples make the component. Without the key the home
page has no section. The home page reads the samples with `renderDemo` of `loadSite`, which a site made by `init` has. A site made
earlier needs that function and the key before the component can show anything.

The preview is a picture of the page, so it is not part of the page. Its ids are prefixed, so they do not repeat the ids of the
page, its links are text, and its headings are not read as headings. The samples are not documents of the site, so the search
index, `llms.txt` and the table of contents do not contain them.

Without JavaScript every panel is shown one after the other, and every sample can be read. With JavaScript the panels of a
sample and a view are laid over one another, so the box has the height of the tallest one, and a change of sample or view moves
nothing on the page.

## Accessibility

- The buttons of the samples are real buttons with `aria-pressed`, and each one is 44 px high on a phone.
- The Preview and HTML tabs follow the tabs pattern: `role="tablist"`, `aria-selected`, `aria-controls`, roving focus, and the
  arrow keys, Home and End move between them.
- Each panel is a labelled region, and a panel that scrolls is focusable, as the other blocks of code are.
- The links of the preview are text and not links, so no keyboard user lands on one that leads nowhere.
- The headings of the preview have no heading role, so a screen reader does not list them in the outline of the page.

## Source

- [`source-to-html.astro`](../../template/src/presentation/components/site/source-to-html.astro), the panels, from the samples of the build
- [`source-to-html-tabs.tsx`](../../template/src/presentation/components/site/source-to-html-tabs.tsx), the buttons and the tabs
- [`demo-samples.ts`](../../template/src/infrastructure/demo-samples.ts), the rendering of the samples and the preview
