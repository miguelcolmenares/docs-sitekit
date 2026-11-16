---
demo: counter
---

# Prebuilt component examples

Add isolated previews to an ordinary Markdown page with `demos` in `sitekit.config.json` and a `demo` identifier in its frontmatter.
The files are built by your project. The documentation site displays them and their source; it does not execute PHP or another server language.

```json
{ "demos": { "dir": "../demos" } }
```

The directory is relative to the site folder and must stay inside `sources.root`. It contains `manifest.json` and the fixture and source files.
A page selects an example with this frontmatter:

```yaml
demo: counter
```

## Manifest v1

```json
{
  "schemaVersion": 1,
  "examples": [
    {
      "id": "counter",
      "title": "Counter",
      "preview": "counter/index.html",
      "sources": [{ "path": "counter/example.php", "language": "php", "label": "PHP" }],
      "variants": [
        { "id": "alternate", "title": "Alternate", "preview": "counter/alternate.html" }
      ],
      "viewports": [{ "label": "Narrow", "width": 360, "height": 420 }],
      "api": [
        { "name": "label", "type": "string", "description": "Visible label.", "required": true }
      ]
    }
  ]
}
```

The manifest is closed: an unknown key fails validation. Example IDs and each example's variant IDs must be unique.
Viewport labels and API names must also be unique within their example. IDs use lowercase words separated by hyphens.

`id`, `title`, `preview` and at least one `sources` entry are required. A source has `path`, `language` and an optional `label`.
`variants`, `viewports` and `api` are optional. A variant has `id`, `title`, `preview` and optional `sources`; without sources it uses the example's files.
An API row has `name`, `type`, `description`, optional boolean `required` and optional string `default`.
Widths are integer CSS pixels from 240 to 2560. Optional heights are integer CSS pixels from 120 to 1600.

## Local artifacts

All manifest paths are relative to the demo directory. Previews are complete `.html` documents, with their own language, title, CSS and JavaScript.
Static assets support `.html`, `.css`, `.js`, `.mjs`, `.json`, `.svg` and `.txt`. Other files must be declared as displayed source and are not served as executable asset URLs.
The `demo-assets` collection ID is reserved only when `demos` is configured.
URLs, absolute paths, traversal, encoded paths, missing files and symlinks that leave the directory are rejected.
The host preserves the site's base path and uses a titled, scrollable iframe with an `allow-scripts` sandbox.
The sandbox does not grant same-origin access, form submission, popups or parent navigation. Examples must work without cookies, storage or remote requests.
Use bundled classic scripts: module loading from an opaque sandbox can need CORS headers that static hosting does not provide.

Use native controls to select a variant or viewport. Source disclosures display escaped code and the API table shows the manifest's explicit metadata.
Keep authentication values and private data out of every published artifact and source file. Run `sitekit check --dist site/dist` after building.

This contract is for prebuilt documentation examples. It does not replace integration tests in the runtime your project targets.
