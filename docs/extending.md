# Extending your site

A site made by `sitekit init` is yours, so you can add to it. These guides show six things people add, each one small and each one run as a test.

Every guide is a folder of files in `e2e/recipes/`. The test `npm run test:e2e` applies those files to a site made by `init`, builds it, checks it with `sitekit check` and drives it in a browser. The files you read on a guide page are copied from the same folder, and a test fails when a page shows something else. If a guide stops being true, the tests fail.

| Guide                                               | What you add                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| [An interactive page](./extend-tool-page.md)        | A page that is not markdown, with its own script and styles       |
| [A collection](./extend-collection.md)              | A set of pages with its place in the menu and its own groups      |
| [A component you changed](./extend-component.md)    | A change to a component, and what `add` and `upgrade` do to it    |
| [New colors](./extend-tokens.md)                    | A new accent in `design/tokens.json`, and a check of its contrast |
| [A logo and a layout](./extend-brand-and-layout.md) | A brand logo of your own and a page layout for a collection       |
| [A safe build](./extend-safe-build.md)              | What `sitekit check` looks for, and a rule of your own            |

## Where things are in a site

The paths in the guides start at the root of your repository. The site is in `site/`, and these are the folders the guides use:

| Path                                | What it is                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `site/sitekit.config.json`          | The closed config. Every key is in the [configuration reference](./configuration.md). |
| `site/src/pages/`                   | The routes. A file here is a page, and an `.astro` file can be your own.              |
| `site/src/presentation/components/` | The components. They are copied into your site, so you can change them.               |
| `site/src/presentation/layouts/`    | `BaseLayout.astro` (header, footer, theme) and the layouts of the documents.          |
| `site/design/tokens.json`           | The colors, radius, fonts and widths. See [Design tokens](./design-tokens.md).        |
| `site/brands/`                      | Your own logos, as `.svg` files.                                                      |

## How a guide is tested

1. `scripts/verify-package.mjs` packs the kit, installs the tarball and runs `init` in a throwaway repository.
2. `scripts/recipes.mjs` applies the files of each guide. A file is copied. `site/sitekit.config.json` is merged into the config of the site (objects key by key, the items of a list added after the ones that are there). A file that ends in `.diff` is applied with `git apply`, so a guide that changes a file of the kit shows the change and fails when the file moves on.
3. The script runs the commands the guide names (`add`, `upgrade`, `check`, `npm run build:tokens`), builds the site and runs `sitekit check` on it.
4. `e2e/specs/recipes.spec.ts` opens the built site in Chromium. Each guide says which group of tests covers it.

The guides add no package to the site: `package.json` and `package-lock.json` are the same before and after, and a test compares them.
