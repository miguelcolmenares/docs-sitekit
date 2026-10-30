---
order: 4
---

# Content

How a markdown file becomes a page.

## Title and description

The title is the `title` in the frontmatter, else the first `#` heading, else the file name. The description is the `description` in the frontmatter, else the first paragraph of prose. Badges, tables, quotes, HTML and code blocks are skipped, and a `#` comment inside a code block is never read as a title.

## Order

Pages sort by file name. Put `order: 1` in the frontmatter to move a page up. The value must be a number: `check` reports `order: "1"` as an error.

## Tags

Put `tags` in the frontmatter, a list or one comma separated string, and the index page of the collection gets a filter bar with a button per tag. Tags are trimmed, and `UI` and `ui` are the same tag. See [CatalogFilter](./components.md#catalogfilter).

## Links

Write ordinary relative links, the ones that also work on GitHub.

| The link points at                        | It becomes                          |
| ----------------------------------------- | ----------------------------------- |
| Another published page                    | The route of that page              |
| A repository file that is not on the site | A link to it on the repository host |
| A file you excluded                       | Its text only, with a warning       |
| A file that does not exist                | Left as written, with a warning     |

Links inside code are never touched.

## Callouts

Start a blockquote with `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]` or `> [!CAUTION]` on a line of its own, the alert syntax that GitHub also renders, and it becomes a callout with its own icon, color and visible label. The marker line is removed, and the rest can hold paragraphs, lists and code. A blockquote without a marker, or with a name that is not one of these five, stays a plain blockquote, and a marker inside code is never touched. See [Callouts](./callouts.md) for each kind.

## What check finds in the content

`sitekit check` reads the markdown as data, and the build prints the same findings when it ends. Each finding is one line, `file:line: severity: message`, for example `docs/guide.md:42: warning: Link "./nope.md" does not match any file`. The line is the one that holds the link, the image, the heading or the frontmatter key. `check` prints the count and exits with 1 when any finding has the severity `error`. The build prints the findings and never fails on them, so `check` is the one that decides.

| Kind (the key under `check`) | What it finds                                                                              | Default |
| ---------------------------- | ------------------------------------------------------------------------------------------ | ------- |
| `links`                      | A relative link to a file that does not exist, or that leaves the repository               | warning |
| `excludedLinks`              | A link to a file you excluded, so only its text is kept                                    | warning |
| `anchors`                    | A link to a heading that does not exist in the target page, or in the same page            | warning |
| `images`                     | A relative image path that does not exist                                                  | error   |
| `frontmatter`                | A frontmatter key the kit does not read (`titel`), with the key it looks like              | warning |
| `order`                      | An `order` that is not a number                                                            | error   |
| `duplicateHeadings`          | A second heading in a page that makes the same anchor as an earlier one                    | warning |
| `callouts`                   | A callout marker that is not one of the five, such as `[!NOTES]`, so the quote stays plain | warning |

Set the severity of a kind in `sitekit.config.json` with `error`, `warning` or `off`. A kind you do not set keeps its default:

```json
"check": {
  "links": "error",
  "frontmatter": "off"
}
```

A name under `check` that is not a kind fails the build and the check, and the message names it and lists the kinds.

What the check reads, and what it does not:

- It reads inline links and images, `[text](./file.md)` and `![alt](./image.png)`, and an image inside a link, as in a badge. Links written as references (`[text][ref]`) are not read.
- Code is never read. A link, a heading or a marker inside a fenced block or a code span is not reported, the same rule the link rewriter follows.
- A web address, a `mailto:` link and a path that starts with `/` are not checked, for links and for images.
- A heading anchor is its text in lowercase, without punctuation, with a hyphen for each space, and a repeated heading gets `-1`, `-2`, the way the page renders it. The title that the page shows at the top is not a heading you can link to. An `id` or `name` written in HTML counts as an anchor.
- An anchor is checked only against pages that are on the site. A link into an excluded page, or into a file that is only in the repository, is not checked for its anchor.
- The changelog is not checked for repeated headings, because `Added` and `Fixed` come back under every version.

## Exclude and replace

`anonymize.excludePaths` keeps files from being read at all. `anonymize.replace` swaps literal text everywhere, for a client name or an internal host.
