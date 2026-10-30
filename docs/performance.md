---
order: 8
---

# Performance

A page of a generated site is drawn on a phone in about 2 seconds in Lighthouse's mobile test, and nothing on it moves when the web font arrives. This page says how the fonts and the menu are built so that holds, what the budget is, and how to keep it.

## How the fonts are loaded

Geist and Geist Mono are self-hosted. They come from the `@fontsource-variable/geist` and `@fontsource-variable/geist-mono` packages, the build copies the files into `_astro/`, and no request leaves the site for a font. Both keep `font-display: swap`: the text is drawn at once in a fallback font and changes to Geist when the file arrives.

Three things make that swap cheap.

**The two files of the first screen are preloaded.** The layout adds a `<link rel="preload" as="font" type="font/woff2" crossorigin>` for `geist-latin-wght-normal.woff2` and `geist-mono-latin-wght-normal.woff2`. Without it the browser finds the fonts only after it has downloaded and read the stylesheet, which is the second request of the page. The address comes from the same import the stylesheet uses, so it is one file, never two. The `crossorigin` attribute is needed even on the same host: a font is always fetched in anonymous CORS mode, and a preload without it is not reused. The other subsets (Latin Extended, Cyrillic, Vietnamese) are not preloaded. The browser downloads one only when a page has characters in its range.

**The fallback font has Geist's measures.** `global.css` declares two faces, `Geist Fallback` and `Geist Mono Fallback`. Each is a font the visitor already has (Arial, or Courier New for the mono face, with Liberation Sans, Liberation Mono and Helvetica as stand-ins where those are missing), scaled with `size-adjust` and moved with `ascent-override`, `descent-override` and `line-gap-override` so it takes the room Geist takes. `design/tokens.json` lists them right after the web font in `font.sans` and `font.mono`, and `tokens.css` is generated from it.

**The values were measured, not guessed.** The ascent and the descent come from the font file, and the line gap is 0 for both fonts. The `size-adjust` is the width of the same text in Geist divided by its width in the fallback, in a browser: 1.029 for the regular weight of the sans face, over the prose of this project's own `docs/` (9,524 characters), and 0.9986 for the bold weight against Arial Bold. The mono face is 0.9998, over 259 lines of TypeScript. That is not what the average character width of the file gives (1.0475 for Geist against Arial): over 164 paragraphs in boxes from 280 to 760 px, 1.0475 breaks 8% of them into a different number of lines than Geist does, and 1.029 breaks about 3%.

A fallback matches the average, not every line. A line that sits within a percent of the edge of its box can still wrap once more, or once less, when Geist arrives, and the text under it moves. The browser test lists the pages it checks and says why one is not among them.

If you change a font, change `design/tokens.json`, run `npm run build:tokens`, preload the file of the new font and measure the fallback again. The layout shift test below fails when the numbers stop being right.

## The mobile menu

The menu is a native modal `<dialog>` and a short script, not a React component. The browser traps the focus inside it, closes it with Escape, makes the page behind it inert and returns the focus to the button that opened it. The links and the close button are 44 px tall. It replaced a Radix sheet that sent React, React DOM and the Radix packages to every page for a button that only toggles. On `main` that bundle, `MobileMenu.*.js`, was 700 KB before compression, because it also carried the whole lucide icon set through `Icon`.

The button is in `SiteHeader.astro` and has `data-mobile-menu-open`. The dialog is `MobileMenu.astro`, which the layout renders after the header, the way it renders the search dialog. The registry entry `mobile-menu` is now that `.astro` file. `components/ui/sheet.tsx` is still in the registry for a site that wants a sheet, but the template no longer uses it.

A site generated earlier keeps its own copy of the template, so it gets this after `MobileMenu.astro`, `SiteHeader.astro`, `BaseLayout.astro`, `global.css` and `design/tokens.json` are copied from this version and `MobileMenu.tsx` is deleted. `sitekit upgrade` copies the files you did not edit and lists `MobileMenu.tsx` as a file the kit no longer ships, which you can delete. See [Upgrading](./upgrading.md).

The only component that still hydrates is the copy button of the install command (`CommandBox`, with `client:visible`, or `client:load` on the gallery pages), on the pages that show one. It loads the Astro client and React, about 80 KB compressed. That is what is left of the JavaScript on the home page, and it is the first thing to look at if the numbers have to go lower.

## What each change did

Lighthouse 12.6.1, mobile preset (a 412 px phone, simulated slow 4G, 4x slower CPU), three runs of each build, on a site generated by `init`. The size is what the page transfers with gzip, the way GitHub Pages sends it.

| Step, in order                  | LCP            | FCP            | Performance | Transferred |
| ------------------------------- | -------------- | -------------- | ----------- | ----------- |
| `main`                          | 2.86 to 3.00 s | 2.03 to 2.10 s | 93 to 94    | 337 KB      |
| Fallback faces                  | 2.85 to 3.00 s | 2.03 to 2.10 s | 93 to 94    | 337 KB      |
| Preload of the two fonts        | 2.85 to 3.00 s | 1.73 to 1.80 s | 93 to 95    | 337 KB      |
| Inline stylesheet (not kept)    | 2.87 s         | 1.81 s         | 94          | 337 KB      |
| Menu as a dialog, without React | 1.95 s         | 1.20 to 1.28 s | 99          | 152 KB      |

The menu is the whole gain in the LCP. Without the preload (menu and fallback faces only) the LCP is already 1.95 s, and the preload then takes the FCP from 1.58 s to 1.28 s. The fallback faces and the preload do not change the LCP, because the LCP element is text and `font-display: swap` already draws it before the font arrives. The preload moves the FCP, and the fallback faces keep the swap from moving the text: on the project's own site `main` had a lab layout shift of 0.033, and either the fallback or the preload brings it to 0 in Lighthouse's test, where the font arrives quickly. The browser test, with the font 500 ms late, is what covers the fallback.

The inline stylesheet (`build.inlineStylesheets: "always"`) did not move the LCP or the FCP and puts the same 12 KB of CSS in every page again, so it was left out. The number to look at is the table, not the idea that sounds right.

On the project's own site, the same test: LCP 3.15 s to 1.95 s, performance 91 to 99. On a desktop the LCP is 0.64 s to 0.44 s, and the score stays at 100.

## The budget

Lighthouse is a lab test. These numbers compare one change with another, not a replacement for field data.

CI runs `scripts/lighthouse.mjs` on the site the end-to-end job generated and drove, three times, with the public `lighthouse` package at the exact version above (`npx lighthouse@12.6.1`). The worst run of each metric is judged, and the reports are uploaded as the `lighthouse-report` artifact whether the job passes or not.

| Metric                   | Measured | Budget           |
| ------------------------ | -------- | ---------------- |
| Largest Contentful Paint | 1,950 ms | at most 2,500 ms |
| Cumulative Layout Shift  | 0        | at most 0.01     |
| Total Blocking Time      | 0 ms     | at most 200 ms   |
| Performance score        | 99       | at least 95      |

The margins are chosen, not rounded. The LCP limit is the "good" limit of Core Web Vitals, which leaves 0.55 s over the measured value for a slower runner. The layout shift limit is the one the browser test uses, since one line that wraps differently is 0.01 or more. The page has almost no script, so a total blocking time of 200 ms would be a script that was added, not noise. The score limit leaves four points. If a limit is changed, change it in `scripts/lighthouse.mjs`, with the new measurements in the comment next to it. A test compares this page with the script.

## Keeping the numbers

The browser test `e2e/specs/vitals.spec.ts` loads pages at 360, 412 and 1440 px with every font file delayed by 500 ms, not blocked, so the swap really happens after the first paint. It reads the layout shifts and the largest contentful paint with a `PerformanceObserver` and fails above a layout shift of 0.01 or an LCP of 2,500 ms. The message names the elements that moved and the LCP element with its four phases: first byte, load delay, load time and render delay. A second pair of tests checks that the preloads are in the head, from the same host, and that no font is downloaded twice.

Rules that keep the budget:

- Do not put a client directive on anything in the header or the layout. Every island loads React.
- Do not add a font, a stylesheet or a script from another host. A test fails on a request to one.
- Preload a font only if the first screen uses it, and give it a fallback with measured values.
- Keep the CSS small. It is the one request that blocks the first paint.
- Look at the LCP element in the report before changing anything. On the pages of this kit it is the first paragraph of the hero, which is text.

To measure your own site, build it and serve it, then run Lighthouse the way CI does:

```bash
npm run build
npm run preview
npx lighthouse@12.6.1 http://localhost:4321/your-base/ --form-factor=mobile --only-categories=performance
```

Run it three times and compare the worst. A single run says little.
