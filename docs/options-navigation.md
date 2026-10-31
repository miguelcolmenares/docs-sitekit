# Options: navigation and collections

The keys that decide what the reader can click: the header menu `nav`, the `footer`, the `collections` of pages, and the `sources` they are read from.

Each key is documented in the [configuration reference](./configuration.md#nav). This page shows them together and says what they change.

## The header menu

```json title="sitekit.config.json" {3-4}
{
  "nav": [
    { "label": "Guide", "href": "/docs/getting-started/" },
    { "label": "Blog", "href": "https://blog.acme.example" }
  ]
}
```

With a `nav`, the header shows these links, in this order, and the menu that opens on a phone shows the same ones. Without it, the header has one link for each collection that has pages, in the order of `collections`, and then `Changelog` when the site has a changelog page.

### The base on a link

A link whose `href` starts with `/` is a path of the site, and the build adds the `base` to it. With the base `/acme/`, `/docs/getting-started/` becomes `/acme/docs/getting-started/`, so the same config works under any base. Some links are left as written:

| `href`                                            | On the page                   | Why                                       |
| ------------------------------------------------- | ----------------------------- | ----------------------------------------- |
| `/docs/getting-started/`                          | `/acme/docs/getting-started/` | A path of the site gets the base          |
| `/acme/docs/getting-started/`                     | `/acme/docs/getting-started/` | It already starts with the base           |
| `https://blog.acme.example`, `//cdn.acme.example` | as written                    | A web address                             |
| `mailto:support@acme.example`                     | as written                    | Not a path                                |
| `#install`, `docs/start/`                         | as written                    | An anchor, or a path relative to the page |

This holds for the `nav` in the header and in the menu of a phone, and for the links of the footer. On a site with the base `/`, nothing changes.

A site that wrote the base into its hrefs, which this page used to ask for, keeps working: a path that starts with the base is not changed. The one case to know is a path that starts with the base by accident. With the base `/docs/`, a link written `/docs/api/` is left as `/docs/api/`, the address as it stands, and does not become `/docs/docs/api/`. A path that starts with the base is always taken as complete. To reach `/docs/docs/api/` on that site, write the base twice.

The buttons of the hero follow a simpler rule, see [Identity and the home page](./options-identity.md): they add the base to every path that starts with `/`, whether or not it starts with the base already.

The `nav` does not change the footer. The Documentation column of the footer always lists the collections and the changelog.

## Links in the footer

```json title="sitekit.config.json"
{
  "footer": {
    "links": [{ "label": "Status", "href": "https://status.acme.example" }]
  }
}
```

The links go in the Project column of the footer, after the link to the repository and `Report an issue`. They follow the same rule as the `nav`, see [The base on a link](#the-base-on-a-link).

## Collections and groups

```json title="sitekit.config.json" {8-15}
{
  "collections": [
    {
      "id": "docs",
      "label": "Docs",
      "dir": "../docs",
      "lede": "Guides and reference for Acme.",
      "groups": [
        {
          "name": "Start",
          "tone": "brand",
          "items": ["getting-started", "upgrading"]
        },
        { "name": "Reference", "tone": "neutral", "items": ["configuration"] }
      ]
    },
    { "id": "examples", "label": "Examples", "dir": "../examples" }
  ]
}
```

- **`id` and `label`.** The `id` is the route: this collection is at `/docs/`, and each page at `/docs/<page>/`. The `label` is the name in the menu and the title of the index page.
- **`dir`** is the folder of markdown files, relative to the site folder. Every markdown file in it, at any depth, is a page. The slug of a page is its file name, so the item `getting-started` is `getting-started.md`.
- **`lede`** is the sentence under the title of the index page, and under the heading of the collection on the home page. The home page lists the first six pages of each collection, with an `All docs` link to the index.
- **`groups`** sort the pages. The index page of the collection has one section for each group, with its `name` as the heading, and every card carries the `name` in a badge. The sidebar of each page shows the name above the pages of the group. The order is the order of the config, for the groups and for the `items`, so the `order` of the frontmatter and the file names no longer sort the pages of this collection.
- **`tone`** colors that badge. It takes `neutral`, `brand`, `success` or `warn`, and `neutral` is the default.

Groups are strict on purpose. When a collection has groups, a page that is in none of them fails the build: `faq, first-steps are in no group of "Docs". Add them to a group, or remove the groups to sort by name.` A group that names a page that does not exist fails too, and the message lists the pages there are. Without `groups`, the pages are in one list, sorted by the `order` of the frontmatter and then by file name.

### A collection inside another one

A page belongs to the collection with the deepest folder. To give the tutorials in `docs/tutorials/` a place of their own, add a collection for that folder:

```json title="sitekit.config.json"
{
  "collections": [
    { "id": "docs", "label": "Docs", "dir": "../docs" },
    {
      "id": "tutorials",
      "label": "Tutorials",
      "dir": "../docs/tutorials",
      "lede": "Learn by building something."
    }
  ]
}
```

The pages in `docs/tutorials/` are then at `/tutorials/<page>/` and are no longer in Docs. Without the second entry they would be pages of Docs.

> [!NOTE]
> `changelog`, `gallery`, `404` and `_astro` are reserved ids, and two collections cannot share an id. Either one fails the build with the id in the message.

## Where the files are

```json title="sitekit.config.json"
{
  "sources": {
    "root": "..",
    "changelog": "../HISTORY.md"
  }
}
```

- **`changelog`** is the file that becomes the page at `/changelog/`. The title of that page is the first heading of the file, so `# History` gives a page called History at the same address. When the file does not exist, there is no Changelog page and no Changelog entry in the menu or the footer.
- **`root`** is the root of the repository that is documented. Both keys are paths relative to the site folder, which is why they start with `..` for a site in a `site/` folder. The globs of `anonymize.excludePaths` are relative to it, see [Content checks and publishing](./options-checks.md), and so is the `package.json` that gives `version` when `site.version` is not set.
