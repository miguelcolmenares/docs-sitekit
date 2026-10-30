---
order: 4
---

# Content

How a markdown file becomes a page.

## Title and description

The title is the `title` in the frontmatter, else the first `#` heading, else the file name. The description is the `description` in the frontmatter, else the first paragraph of prose. Badges, tables, quotes, HTML and code blocks are skipped, and a `#` comment inside a code block is never read as a title.

## Order

Pages sort by file name. Put `order: 1` in the frontmatter to move a page up.

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

## Exclude and replace

`anonymize.excludePaths` keeps files from being read at all. `anonymize.replace` swaps literal text everywhere, for a client name or an internal host.
