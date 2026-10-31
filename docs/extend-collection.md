# Add a collection

Add a set of pages with its own place in the menu, and decide the order and the groups of its sidebar.

This guide adds a `notes` collection: three markdown files in a `notes/` folder at the root of the repository, in two groups.

## The files

The pages are plain markdown. A link from one note to another, such as `[glossary](./glossary.md)`, works on GitHub and on the site.

<!-- prettier-ignore-start -->
<!-- recipe-file: collection notes/welcome.md -->
```md title="notes/welcome.md"
# Welcome

Short notes the team keeps next to the code. They are not part of the manual, so they live in their own collection.

Start with the [glossary](./glossary.md), then read how a [release](./release-process.md) is made.
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

<!-- prettier-ignore-start -->
<!-- recipe-file: collection notes/glossary.md -->
```md title="notes/glossary.md"
# Glossary

The words the team uses, so a new person does not have to ask.

## Release

A tagged version of the package, published once the checks pass.

## Spike

A short piece of work to find out if an idea is possible. It ends with a note, not with a feature.
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

<!-- prettier-ignore-start -->
<!-- recipe-file: collection notes/release-process.md -->
```md title="notes/release-process.md"
# Release process

How a version leaves the repository.

## Steps

1. Update the changelog.
2. Tag the commit.
3. Wait for the checks, then publish.
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

Then add the collection to `collections` in the config of the site. The `dir` is relative to the site folder, which is why it starts with `..`.

<!-- prettier-ignore-start -->
<!-- recipe-file: collection site/sitekit.config.json -->
```json title="site/sitekit.config.json"
{
  "collections": [
    {
      "id": "notes",
      "label": "Notes",
      "dir": "../notes",
      "lede": "Short notes the team keeps next to the code.",
      "groups": [
        { "name": "Start", "tone": "brand", "items": ["welcome", "glossary"] },
        { "name": "Process", "tone": "warn", "items": ["release-process"] }
      ]
    }
  ]
}
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

## What decides the order

- **The place in the menu** is the place in the `collections` list. `docs` and `examples` were there first, so `notes` comes after them and before the Changelog. Write the entry first in the list to put it first.
- **The groups** are the headings of the index and of the sidebar, in the order of the config. The notes are in the order of `items`, so `welcome` comes before `glossary` although the file names sort the other way.
- **The `tone`** colors the badge of the group on each card.

When a collection has groups, every page must be in one. A page that is in none stops `sitekit check`:

```text
draft is in no group of "Notes". Add it to a group, or remove the groups to sort by name.
```

Without `groups`, the pages are sorted by the `order` of their frontmatter and then by file name. Every key is in [Navigation and collections](./options-navigation.md#collections-and-groups).

## How it is tested

- `scripts/verify-package.mjs` (section 5d, `collection`) adds a note that no group lists and checks that `sitekit check` exits with 1 and prints the message above.
- The group `recipe collection` of `e2e/specs/recipes.spec.ts` checks that the header lists Docs, Examples, Notes and Changelog in that order. It also checks that the index has the groups Start and Process in that order, that the cards follow `items`, that the sidebar of a page lists the same groups and pages with the current page marked, that a link between two notes works, and that no page scrolls sideways at 320 px.
