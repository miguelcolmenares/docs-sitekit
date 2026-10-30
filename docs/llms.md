---
order: 5
---

# llms.txt

An optional map of the site for language models, written as Markdown.

## What it is for

`llms.txt` is a community proposal (https://llmstxt.org). It is a short Markdown file at the root of a site that lists its
pages with a one line description each, so a tool does not have to crawl every page to know what is there. Coding assistants
and developer tools that you point at a documentation site can read it. The proposal also suggests a Markdown copy of each
page, at the page address with `index.html.md` after it, which the same tools can read without the HTML.

The proposal is not a standard. Google Search does not use `llms.txt`, and it is not an SEO feature: it does not change how
a page ranks, and this kit makes no claim that it does. The option is for the tools that read the site on purpose.

## Turn it on

Add the `llms` key to `sitekit.config.json`:

```json
"llms": {
  "enabled": true,
  "optional": ["examples"],
  "markdownPages": true
}
```

Each field, its default and what it does are in the [configuration reference](./configuration.md#llms).

`sitekit init` writes `enabled: true` for a new site. A site generated before this option existed has no `llms` key, so it
does not change by itself until you add the key. An id in `optional` that is not a collection of the site fails the build, and
the message names the key and the id.

## What it generates

`llms.txt` has, in this order:

1. An H1 with the name of the site.
2. A blockquote with the description of the site.
3. A short paragraph with the install command and the repository, when they are set.
4. One H2 per collection, in the order of the site, with one line per page: `- [title](address): description`. The title and
   the description are the ones the page already has, and the colon part is left out when a page has no description.
5. `## Optional`, last, with the collections named in `optional`. It is left out when there are none.

Every address is absolute. It is built from `site.url` and `site.base`, so a site at `/repository/` gets
`https://user.github.io/repository/...` and a site at the root gets `https://user.github.io/...`.

With `markdownPages`, the Markdown copy of `docs/getting-started.md` is at `/repository/docs/getting-started/index.html.md`.
Its relative links are rewritten the same way the page's links are, so a link to another page is an absolute address, and a
link to a file that is not on the site points at the repository. Fenced code is left as written.

## Check it

`sitekit check --dist <folder>` checks `llms.txt` when the option is on. It fails when:

- the file is missing from the build,
- it does not start with an H1,
- a link in it is not an address of this site, or names a page that is not in the build,
- a page of the site is not listed in it,
- with `markdownPages`, a page has no Markdown copy in the build.

Each message names the link or the page. The credential and internal host scan also reads `llms.txt`, and it finds a secret
or an internal host in a description there, because the site name and description come from the config. The Markdown copies
are scanned for credentials, and their text was already scanned as the page content.
