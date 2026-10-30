# Options: search and llms.txt

Two features of the site that you can turn on or off: the search dialog with `search`, and the map for language models with `llms`.

The keys are documented in the configuration reference, under [`search`](./configuration.md#search) and [`llms`](./configuration.md#llms). This page shows them in use and says what they change. How search works for a reader is in [Search](./search.md), and what `llms.txt` is for is in [llms.txt](./llms.md).

## Search

```json title="sitekit.config.json" {2}
{
  "search": { "enabled": false }
}
```

Search is on when the key is missing. With `enabled` set to `false` the build changes in three places:

- The header has no Search button, and the pages have no search dialog.
- The file `search-index.json` is not written, so there is nothing to download.
- `sitekit check` does not look for the index.

Leave it on for a site with more than a few pages. Turn it off for a one page site, where the dialog would find nothing the reader cannot see.

## llms.txt and Markdown copies

```json title="sitekit.config.json"
{
  "collections": [
    { "id": "docs", "label": "Docs", "dir": "../docs" },
    { "id": "examples", "label": "Examples", "dir": "../examples" }
  ],
  "llms": {
    "enabled": true,
    "optional": ["examples"],
    "markdownPages": true
  }
}
```

The example has the collections too, because `optional` names one of them.

- **`enabled`** writes `llms.txt` at the site base, with the name of the site, its description, the install command and the repository, and one section for each collection with a line `- [title](address): description` for each page. Every page of the site also gets `<link rel="describedby" href="https://.../llms.txt">` in its head. Without it there is no file and no link.
- **`optional`** moves the pages of the collections it names to a section called `## Optional`, at the end of the file, which a tool may skip when it needs a shorter text. In the example above, the pages of Examples are listed there and the pages of Docs are in their own section. `changelog` is accepted as well. An id that is not a collection fails the build: `llms.optional names "nope", which is not a collection of this site.`
- **`markdownPages`** writes a Markdown copy of each page next to its HTML, as `index.html.md` in the folder of the page, and adds `<link rel="alternate" type="text/markdown">` to the head of the page that points to it. It has an effect only when `enabled` is also `true`.

> [!NOTE]
> `llms.txt` is a proposal that some tools read. It is not a ranking signal for search engines, and turning it on does not change how a page ranks. See [llms.txt](./llms.md).
