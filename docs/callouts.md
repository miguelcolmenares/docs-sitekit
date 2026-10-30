# Callouts

Highlight a note, a tip or a warning in a page, with plain markdown.

## Syntax

Start a blockquote with a marker on a line of its own. This is the alert syntax that GitHub renders, so the page reads well in the repository and on the site.

```markdown
> [!NOTE]
> Useful information that a reader should know, even when skimming.
```

The marker line is removed, and the rest of the blockquote is the text of the callout. The marker is not case sensitive, but it must be alone on its line: text after it on the same line makes the blockquote a plain one.

## The five kinds

> [!NOTE]
> Useful information that a reader should know, even when skimming.

> [!TIP]
> Advice that helps a reader do something better or faster.

> [!IMPORTANT]
> What a reader needs to know to get the result they expect.

> [!WARNING]
> Something that can go wrong, and that a reader should check before going on.

> [!CAUTION]
> Something that can cause harm or lose data.

Each kind has its own icon, color and visible label, so the kind is never told by color alone. A callout is a note in the page, not an alert, so a screen reader does not interrupt the reader to announce it.

## What a callout can hold

A callout holds the same things as any blockquote: paragraphs, lists, code and links.

> [!TIP]
> Before you publish, build the site and check it:
>
> 1. `npm run build`, to build it.
> 2. `npx docs-sitekit check --dist dist`, to scan it for credentials and internal hosts.
>
> ```bash
> npm run build
> npx docs-sitekit check --dist dist
> ```

A callout can also sit inside a list item:

- Install the package.
  > [!WARNING]
  > Use Node 22 or newer.
- Run the command.

## What stays as it is

A blockquote without a marker is a plain blockquote:

> A quote that is only a quote.

A marker in a code block or in a code span, such as `> [!NOTE]`, is shown as written. A marker with a name that is not one of the five stays a plain blockquote too:

> [!NOTES]
> This one has no kind, so it is a quote.
