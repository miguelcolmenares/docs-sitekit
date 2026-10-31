---
order: 2
---

# Configuration reference

Every key of `sitekit.config.json`, with its type, its default, the values it accepts and what it does.

This page is generated from the schema in `template/src/domain/config.ts`, so it cannot drift from it. Run `npm run build:docs` after changing a key, and a test fails while the page is out of date. An unknown key is an error: the file is a closed contract.

In the Default column, `required` is a key you must write, and `none` is an optional key that has no default. A key inside a list is written `list[].key`.

## site

The identity of the site and where it is published.

| Key | Type | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `site.name` | string | required | any | The name of the site, in the header, the footer and the title of every page. |
| `site.description` | string | required | any | What the site is about, in one sentence. It is the meta description of a page that has none, and the line under the name in the footer. |
| `site.url` | string (URL) | required | any | The origin of the published site, for example `https://user.github.io`. It is used for canonical links, the sitemap and `llms.txt`. |
| `site.base` | string | `"/"` | matches `^\/([\w.-]+\/)*$` | The path the site is served from: `/`, or `/repository-name/` on GitHub Pages. |
| `site.repository` | string (URL) | none | any | The address of the repository. The header, the footer and `llms.txt` link to it, and `check` asks GitHub for its visibility. |
| `site.license` | string | none | any | The license of the project, shown in the footer. |
| `site.version` | string | none | any | A version to show in the footer. When it is missing, the site reads it from the `package.json` of the repository. |
| `site.installCommand` | string | none | any | The command the hero and the closing band offer to copy, for example `npm install my-package`. |

## hero

The top of the home page.

| Key | Type | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `hero.badge` | string | none | any | A short status line above the title. |
| `hero.title` | string | required | any | The headline of the home page. |
| `hero.lede` | string | required | any | The text under the headline. |
| `hero.primary` | object | required | - | The main action of the hero. |
| `hero.primary.label` | string | required | any | The text of the link. |
| `hero.primary.href` | string | required | any | Where the link goes: a path of the site such as `/docs/`, or a full URL. |
| `hero.secondary` | object | none | - | A second, quieter action. |
| `hero.secondary.label` | string | required | any | The text of the link. |
| `hero.secondary.href` | string | required | any | Where the link goes: a path of the site such as `/docs/`, or a full URL. |

## features

| Key | Type | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `features` | array of object | `[]` | - | The cards of the features section of the home page. Without any, the section is left out. |
| `features[].icon` | string | required | any | A lucide icon in kebab-case, such as `shield-check`, or a brand logo, such as `brand:github` or `brand:custom/my-logo`. |
| `features[].eyebrow` | string | required | any | A short mono label above the title. |
| `features[].title` | string | required | any | The title of the card. |
| `features[].text` | string | required | any | The text of the card. |

## stats

| Key | Type | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `stats` | array of object | `[]` | - | Two to five numbers under the hero, each with a label. They are written by hand: the kit fetches nothing. Without any, the row is left out. |
| `stats[].value` | string | required | any | The number or short value, shown as the large text. |
| `stats[].label` | string | required | any | What the value counts. |
| `stats[].note` | string | none | any | A line of text under the value. |

## nav

| Key | Type | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `nav` | array of object | `[]` | - | The links of the header menu. A path that starts with `/` gets the site base. When it is empty, the header lists the collections and the changelog. |
| `nav[].label` | string | required | any | The text of the link. |
| `nav[].href` | string | required | any | Where the link goes: a path of the site such as `/docs/`, or a full URL. |

## footer

The footer of every page.

| Key | Type | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `footer.links` | array of object | `[]` | - | Extra links in the Project column of the footer, after the repository and the issues. A path that starts with `/` gets the site base. |
| `footer.links[].label` | string | required | any | The text of the link. |
| `footer.links[].href` | string | required | any | Where the link goes: a path of the site such as `/docs/`, or a full URL. |

## theme

The color theme a visitor sees first.

| Key | Type | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `theme.default` | string | `"dark"` | `"dark"`, `"light"`, `"system"` | The theme a visitor sees first. `system` follows the operating system. A choice the visitor made in the header wins. |

## sources

Where the repository is, relative to the site folder.

| Key | Type | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `sources.root` | string | `".."` | any | The root of the repository being documented, relative to the site folder. |
| `sources.changelog` | string | `"../CHANGELOG.md"` | any | The changelog file, relative to the site folder. It becomes the Changelog page. |

## collections

| Key | Type | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `collections` | array of object | `[]` | - | The sets of pages, such as docs, tutorials and examples. Each is a menu entry with its own index. |
| `collections[].id` | string | required | matches `^[a-z0-9-]+$` | The route segment and the menu key, unique in the site. `changelog`, `gallery`, `404` and `_astro` are reserved. |
| `collections[].label` | string | required | any | The name of the collection in the menu and as its title. |
| `collections[].dir` | string | required | any | The folder to read, relative to the site folder. A page belongs to the collection with the deepest folder. |
| `collections[].lede` | string | none | any | One sentence under the title of the collection. |
| `collections[].groups` | array of object | `[]` | - | Headings that sort the pages of the collection. When there is any group, every page must be in one. |
| `collections[].groups[].name` | string | required | any | The heading of the group. |
| `collections[].groups[].tone` | string | `"neutral"` | `"neutral"`, `"brand"`, `"success"`, `"warn"` | The tone of the badge on the cards of the group. |
| `collections[].groups[].items` | array of string | required | at least 1 item | Slugs of the pages in the group, in the order they appear. |

## deploy

How and where the site is published.

| Key | Type | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `deploy.target` | string | `"github-pages"` | `"github-pages"`, `"none"` | Where the site is published. `none` skips the repository visibility check of `check`. |
| `deploy.acknowledgePublicPages` | boolean | `false` | `true`, `false` | Say that the Pages site of a private repository is meant to be public. Without it, `check` stops for a repository that is not public. |
| `deploy.repositoryVisibility` | string | none | `"public"`, `"private"`, `"internal"` | The visibility of the repository, for a runner where `gh` cannot tell. Otherwise `check` asks GitHub. |

## search

The search dialog and its index.

| Key | Type | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `search.enabled` | boolean | `true` | `true`, `false` | Turn search on. Off, the site has no search button, no dialog and no `search-index.json`. |

## anonymize

What is kept out of the site, replaced in it, and treated as a leak.

| Key | Type | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `anonymize.excludePaths` | array of string | `[]` | any | Glob patterns of files that are never read, relative to `sources.root`. |
| `anonymize.replace` | map of string | `{}` | any | Literal text to swap everywhere, as the text to find and its replacement. For a client name or an internal host. |
| `anonymize.denyPatterns` | array of string | `[]` | any | Regular expressions that `check` reports as a leak, besides its built-in credential patterns. |
| `anonymize.allow` | array of string | `[]` | any | Exact texts that `check` accepts even though a pattern matches them, for example a public support address. |

## check

| Key | Type | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `check` | map of string | `{}` | - | How serious each kind of content finding is. Write the kind as the key and `error`, `warning` or `off` as the value. A kind you do not write keeps its default. A name that is not a kind fails the build and `check`. |
| `check.links` | string | `"warning"` | `"error"`, `"warning"`, `"off"` | A relative link to a file that does not exist, or that leaves the repository. |
| `check.excludedLinks` | string | `"warning"` | `"error"`, `"warning"`, `"off"` | A link to a file you excluded, so only its text is kept. |
| `check.anchors` | string | `"warning"` | `"error"`, `"warning"`, `"off"` | A link to a heading that does not exist in the target page, or in the same page. |
| `check.images` | string | `"error"` | `"error"`, `"warning"`, `"off"` | A relative image path that does not exist. |
| `check.frontmatter` | string | `"warning"` | `"error"`, `"warning"`, `"off"` | A frontmatter key the kit does not read, such as `titel`, with the key it looks like. |
| `check.order` | string | `"error"` | `"error"`, `"warning"`, `"off"` | An `order` in the frontmatter that is not a number. |
| `check.duplicateHeadings` | string | `"warning"` | `"error"`, `"warning"`, `"off"` | A second heading in a page that makes the same anchor as an earlier one. |
| `check.callouts` | string | `"warning"` | `"error"`, `"warning"`, `"off"` | A callout marker that is not one of the five, such as `[!NOTES]`, so the quote stays plain. |
| `check.variables` | string | `"warning"` | `"error"`, `"warning"`, `"off"` | A `{{ name }}` that is not declared under `vars`, so it stays as written. |
| `check.snippets` | string | `"error"` | `"error"`, `"warning"`, `"off"` | An include of a snippet that does not exist, or an include inside a snippet. |
| `check.card` | string | `"error"` | `"error"`, `"warning"`, `"off"` | A side card the frontmatter got wrong: an unknown key under `meta`, a missing text, or a link with an unsafe scheme. |

## vars

| Key | Type | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `vars` | map of string | `{}` | any | Values a page writes as `{{ name }}` in its text, as the name and its value. A name starts with a letter and has letters, digits, `_` and `-`. `version` is read from the `package.json` of the repository when it is not set here, and a value written here wins over it. |

## llms

A `llms.txt` map of the site, and optionally a Markdown copy of each page. A site without the key gets neither.

| Key | Type | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `llms.enabled` | boolean | `false` | `true`, `false` | Write `llms.txt` at the site base and a discovery link in the head of every page. |
| `llms.optional` | array of string | `[]` | any | Collection ids whose pages go under `## Optional`, the part a tool may skip. `changelog` is accepted too. |
| `llms.markdownPages` | boolean | `false` | `true`, `false` | Write a Markdown copy of every page and link each page to its copy. It needs `enabled`. |

## editLink

A link at the foot of every page to its source file on the repository host. A site without the key has no link.

| Key | Type | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `editLink.enabled` | boolean | `false` | `true`, `false` | Show an "Edit this page" link at the foot of every page. It needs `site.repository`: without it, or when the host is not known, the link is turned off with a message. |
| `editLink.branch` | string | `"main"` | any | The branch the link opens the file on. |
| `editLink.host` | string | none | `"github"`, `"gitlab"`, `"bitbucket"` | The repository host, for a repository on a domain of its own, such as a self-hosted GitLab. Otherwise the host is found from `site.repository`. |

## lastUpdated

The date of the last change of each page, at the foot of the page. A site without the key shows none.

| Key | Type | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `lastUpdated.enabled` | boolean | `false` | `true`, `false` | Show the date of the last commit that changed the file, read from git at build time. It needs the full history: a shallow clone shows no dates. |
