# Prebuilt examples in a generated site

This recipe adds a component example to an ordinary Markdown page. The preview has its own HTML, CSS and classic JavaScript.
It also displays a PHP source file as text, without running PHP. The [manifest reference](./demo-previews.md) lists the closed contract.

## Add the page and config

<!-- prettier-ignore-start -->
<!-- recipe-file: demo-previews site/sitekit.config.json -->
```json title="site/sitekit.config.json"
{
  "demos": { "dir": "../demos" }
}
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

<!-- prettier-ignore-start -->
<!-- recipe-file: demo-previews docs/prebuilt-counter.md -->
```md title="docs/prebuilt-counter.md"
---
title: Prebuilt counter
description: A local interactive fixture with its source, alternate state and API reference.
demo: counter
---

# Prebuilt counter

This example runs in an isolated document with its own CSS and classic JavaScript.
The PHP file is displayed as text. The site never executes it.
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

## Describe the example

<!-- prettier-ignore-start -->
<!-- recipe-file: demo-previews demos/manifest.json -->
```json title="demos/manifest.json"
{
  "schemaVersion": 1,
  "examples": [
    {
      "id": "counter",
      "title": "Counter",
      "preview": "counter/index.html",
      "sources": [
        { "path": "counter/index.html", "language": "html", "label": "HTML fixture" },
        { "path": "counter/counter.js", "language": "javascript", "label": "JavaScript behavior" },
        { "path": "counter/source.php", "language": "php", "label": "PHP source" }
      ],
      "variants": [
        { "id": "alternate", "title": "Alternate counter", "preview": "counter/alternate.html" }
      ],
      "viewports": [
        { "label": "Narrow", "width": 360, "height": 240 },
        { "label": "Wide", "width": 782, "height": 360 }
      ],
      "api": [
        {
          "name": "label",
          "type": "string",
          "description": "The visible count label.",
          "required": true
        }
      ]
    }
  ]
}
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

## Add the prebuilt files

The directory is dedicated to publication. Every supported static asset in it is published; declared server-language source is displayed on the documentation page.
Keep private data out of it. Relative links between these HTML, CSS and JavaScript files work under the site's configured base path.

<!-- prettier-ignore-start -->
<!-- recipe-file: demo-previews demos/counter/index.html -->
```html title="demos/counter/index.html"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Counter fixture</title>
    <link rel="stylesheet" href="counter.css" />
  </head>
  <body>
    <main>
      <h1>Counter</h1>
      <button type="button">Count <span>0</span></button>
      <p role="status">Ready</p>
    </main>
    <script src="counter.js"></script>
  </body>
</html>
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

<!-- prettier-ignore-start -->
<!-- recipe-file: demo-previews demos/counter/alternate.html -->
```html title="demos/counter/alternate.html"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Alternate counter fixture</title>
    <link rel="stylesheet" href="counter.css" />
  </head>
  <body>
    <main>
      <h1>Alternate counter</h1>
      <button type="button">Count <span>10</span></button>
      <p role="status">Ready</p>
    </main>
    <script src="counter.js"></script>
  </body>
</html>
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

<!-- prettier-ignore-start -->
<!-- recipe-file: demo-previews demos/counter/counter.css -->
```css title="demos/counter/counter.css"
body {
  margin: 0;
  padding: 20px;
  color: #171717;
  background: #fff;
  font:
    16px/1.5 system-ui,
    sans-serif;
}
button {
  min-height: 44px;
  padding: 8px 16px;
  border: 1px solid #525252;
  border-radius: 6px;
  color: inherit;
  background: #fff;
  font: inherit;
}
button:focus-visible {
  outline: 2px solid #171717;
  outline-offset: 3px;
}
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

<!-- prettier-ignore-start -->
<!-- recipe-file: demo-previews demos/counter/counter.js -->
```js title="demos/counter/counter.js"
/* global document */
const button = document.querySelector("button");
button.addEventListener("click", () => {
  const count = button.querySelector("span");
  count.textContent = String(Number(count.textContent) + 1);
  document.querySelector('[role="status"]').textContent = "Count updated";
});
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

<!-- prettier-ignore-start -->
<!-- recipe-file: demo-previews demos/counter/source.php -->
```php title="demos/counter/source.php"
<?php
// Displayed as text by the site, never interpreted by its build or server.
echo '<button type="button">Count <span>0</span></button>';
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

Build the site, then run the publication check:

```sh
npm run build --prefix site
npx docs-sitekit check --dist site/dist
```

## How it is tested

`scripts/verify-package.mjs` applies this recipe to a site created from the packed package, builds the site and runs `check --dist`.
It checks the base path, packaged script and sandbox, and verifies that the PHP source has no executable asset URL.
The group `recipe demo-previews` in `e2e/specs/recipes.spec.ts` checks the counter, variant and viewport controls, source disclosures, keyboard access and frame isolation.
`src/__tests__/integration/demo-previews.test.ts` checks missing files, path containment, escaping symlinks and publication scanning of fixture and source formats.
