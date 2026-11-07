<!-- agents-toolkit:planning-doc issue=82 -->

# Plan: hide the sidebars (#82) and highlight the current section (#83)

Both change `template/src/presentation/layouts/doc-page.astro`. Two commits, #82 first, then #83. Nothing here is published: `.plans/` is outside `docs/`, `template/` and the package `files`.

## Decisions

- **Hidden sidebar keeps a 44 px column** with its button (`2.75rem`). The grid tracks are CSS variables set on `<html>`: `--docs-menu-col` (220 px, or 2.75rem when hidden) and `--docs-toc-col` (200 px, or 2.75rem). The track change is a transition of `grid-template-columns`, off with `prefers-reduced-motion`.
- **State** is `data-docs-menu="hidden"` and `data-docs-toc="hidden"` on `<html>`, set by a script in the head (through a named `head` slot on `BaseLayout`), so it is applied before the first paint. Storage keys `docs-menu` and `docs-toc`. Without JavaScript the attributes are absent and the layout is the one of today.
- **Buttons** are rendered `hidden` and shown by the page script, as the copy buttons are. One button per sidebar, with `aria-expanded` and the name "Hide the docs menu" / "Show the docs menu" (and "Hide the table of contents" / "Show the table of contents").
- **Hidden sidebar** is `display: none`, so it is out of the tab order and the accessibility tree.
- **Detail pages** (with a card) have no right sidebar, so only the docs menu has a control, from `xl` up.
- **Text column**: the article keeps `max-w-prose` (65ch, the measure of today) and is centred in its track. When a sidebar is hidden the limit is 80ch, so the text grows and stays under a readable measure. The article must be `w-full` with `mx-auto`: a grid item with `margin: auto` alone shrinks to its content.
- **#83** uses three `IntersectionObserver`s on the headings and the page end, and no scroll listener. A one pixel band at the line (the `scroll-padding-top` of the page: the header and a rem) catches a heading that scrolls past it. A band from the line to the bottom of the viewport catches a heading that a jump, such as Page Down, moves past the line in one frame, which the one pixel band does not see. A one pixel mark at the end of the document says when the page cannot scroll further, so the last section is current there. On each callback the current heading is recomputed from the heading positions. A click or a `#hash` locks the link until its heading reaches the line (or 1.5 s), so the observer does not fight the scroll to the anchor.
- **Table of contents** becomes a scroll container (`max-h`, `overflow-y-auto`, `tabindex="0"`) so the active link can be kept in view. The sidebar scrolls with `scrollTop`, not `scrollIntoView`, so the page does not move.

## Files

- `template/src/presentation/layouts/doc-page.astro`: grid, controls, head script, active link markup.
- `template/src/presentation/layouts/base-layout.astro`: `<slot name="head" />`.
- `template/src/presentation/sidebars/sidebar-toggle.ts`: pure rules (`isHidden`, `labelFor`, `storageKey`) and the button wiring.
- `template/src/presentation/on-this-page/on-this-page.ts`: pure rule `activeHeadingId` and the observers.
- Tests: `src/__tests__/template/sidebar-toggle.test.ts`, `src/__tests__/template/on-this-page.test.ts`; e2e `e2e/specs/sidebars.spec.ts`, `e2e/specs/on-this-page.spec.ts`.
- Docs: `docs/options-navigation.md` (a section on the sidebars), `docs/detail-page.md` (one line), `CHANGELOG.md`.

## Checks

`npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, and `npm run format:check` (the repo runs it before a PR).
