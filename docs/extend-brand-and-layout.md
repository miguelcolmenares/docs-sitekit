# Add a logo and a layout of your own

Draw a brand logo the kit does not ship, and give one collection a page layout of your own.

## A logo of your own

Put an `.svg` file in `site/brands/`, and use it as `brand:custom/<name>` wherever the kit takes an icon. The name is the file name without `.svg`.

<!-- prettier-ignore-start -->
<!-- recipe-file: brand-and-layout site/brands/compass.svg -->
```xml title="site/brands/compass.svg"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2l9 5v10l-9 5-9-5V7z"/></svg>
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

This feature card uses it:

<!-- prettier-ignore-start -->
<!-- recipe-file: brand-and-layout site/sitekit.config.json -->
```json title="site/sitekit.config.json"
{
  "features": [
    {
      "icon": "brand:custom/compass",
      "eyebrow": "Our own mark",
      "title": "A logo that ships with the site",
      "text": "Drawn in brands/compass.svg and filled with the color of the text."
    }
  ]
}
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

The logo is drawn as an inline SVG filled with `currentColor`, hidden from assistive technology because the title of the card names it, and it asks nothing from another host. The file must be plain: one `viewBox`, and `<path>` shapes with no stroke and no transform. The rules, and what happens with a file that breaks them, are in [Brand logos](./brand-logos.md#your-own-logo).

## A layout for a collection

The pages of a collection are drawn by `DocPage.astro`. To draw the pages of one collection in your own way, add a layout named after the `id` of the collection in `site/src/presentation/layouts/collections/`. Nothing else is registered: the route looks for the file by that name, and uses `DocPage` when there is none.

<!-- prettier-ignore-start -->
<!-- recipe-file: brand-and-layout site/src/presentation/layouts/collections/examples.astro -->
```astro title="site/src/presentation/layouts/collections/examples.astro"
---
import type { ComponentProps } from "astro/types";
import DocPage from "../DocPage.astro";

// The pages of the collection "examples" use this layout, because its file is named after the id of the collection.
// It takes the props of DocPage, draws DocPage, and puts more in its slot.
type Props = ComponentProps<typeof DocPage>;
const page = Astro.props;
---

<DocPage {...page}>
  <p class="mt-6 rounded-md border border-border bg-surface px-4 py-3 text-sm text-fg-muted" data-example-note>
    This is an example. Copy the folder <code class="font-mono text-fg">examples/</code> from the repository and adapt it.
  </p>
</DocPage>
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

The layout takes the same props as `DocPage`, draws it, and puts a note in its slot. The slot of `DocPage` is under the title and above the text, so the note appears there on every page of `examples`. A layout can also draw something else around `DocPage`, or not use it, as long as it keeps the title, the breadcrumbs and the links to the previous and next page that a reader expects. The `id` of the file is the `id` of the collection, so a collection called `notes` is `notes.astro`.

## How it is tested

- `scripts/verify-package.mjs` (section 5d) adds the files to a site made by `init`, builds the site and runs `sitekit check` on it. The build reads the logo, and `check` reads the `brands` folder too.
- The group `recipe brand-and-layout` of `e2e/specs/recipes.spec.ts` checks that the logo is one inline `<svg>` with the path of the file, filled with the color of the text around it and hidden from assistive technology, with no `<img>` and no `<use>`. It checks that the pages of `examples` show the note and keep their title, breadcrumbs and links, that the pages of the other collections do not show it, and that the note does not scroll sideways at 320 px and reaches AA in both themes.
