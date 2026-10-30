# Options: edit link and dates

Two lines at the foot of a page: a link to its source file on the repository host, with `editLink`, and the date of the last change, with `lastUpdated`.

The keys are documented in the configuration reference, under [`editLink`](./configuration.md#editlink) and [`lastUpdated`](./configuration.md#lastupdated). This page shows them in use and says what they change. How the address is built, and why a shallow clone shows no dates, is in [Edit this page and the date of the last change](./edit-link.md).

## The link to the file

```json title="sitekit.config.json"
{
  "site": {
    "name": "Acme",
    "description": "Acme runs background jobs for your app.",
    "url": "https://acme.example",
    "repository": "https://github.com/acme/acme"
  },
  "editLink": {
    "enabled": true,
    "branch": "trunk"
  }
}
```

The example has `site.repository` too, because the link is built from it. For the page `docs/guide.md` the foot of the page gets a link called `Edit this page`, with this address:

```text
https://github.com/acme/acme/edit/trunk/docs/guide.md
```

- **`enabled`** turns the link on. It is on the pages of the collections and on the Changelog page. It is not on the home page, the 404 page or the index page of a collection, which have no source file.
- **`branch`** is the branch in the address. Without it the address uses `main`.
- **`host`** is for a repository on a domain that the kit does not know. The next example is a GitLab that you run yourself:

```json title="sitekit.config.json" {10}
{
  "site": {
    "name": "Acme",
    "description": "Acme runs background jobs for your app.",
    "url": "https://acme.example",
    "repository": "https://git.acme.example/docs/acme"
  },
  "editLink": {
    "enabled": true,
    "host": "gitlab"
  }
}
```

The address of the same page is now `https://git.acme.example/docs/acme/-/edit/main/docs/guide.md`. With the host `bitbucket` it would be `https://git.acme.example/docs/acme/src/main/docs/guide.md?mode=edit`. Without `host`, a repository on a domain the kit does not know gets no link, and the build prints `editLink is on, but the host of https://git.acme.example/docs/acme is not known. Set editLink.host to "github", "gitlab", "bitbucket", or turn editLink off.`

> [!WARNING]
> When `editLink` is on and `site.repository` is not set, there is no address to build. The link is turned off, and the build prints `editLink is on, but site.repository is not set, so there is no address to edit on.`

## The date of the last change

```json title="sitekit.config.json"
{
  "lastUpdated": { "enabled": true }
}
```

Each page that has a source file gets a line with the date of the last commit that changed that file, as `<time datetime="2026-10-30">30 October 2026</time>`. The month is written out, so `03/04` is never read two ways. Without the key there is no date, and the key is independent of `editLink`: one can be on without the other.

> [!IMPORTANT]
> The date is read from git when the site is built, so the build needs the whole history. `actions/checkout` fetches one commit by default, and a shallow clone shows no dates. Set `fetch-depth: 0` in the workflow.
