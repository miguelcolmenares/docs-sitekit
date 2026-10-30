---
order: 5
---

# Search

Every site has a search dialog. A reader opens it with the search button in the header, with Ctrl K or Cmd K, or with the slash key when no field has the focus.

## Using it

- Type words. Every word must match somewhere on the page, at the start of a word or inside one. Case does not matter.
- A match in a title ranks above a match in a heading, and a heading above the body text.
- The result shows the section that matched. Enter opens that section, so `page#heading` is the address you get.
- The arrow keys move through the results, and Home and End go to the first and the last. The cursor in the box does not move with them, so use the mouse or the left and right arrows to edit the query.
- Escape closes the dialog and puts the focus back on the button or the element that opened it.

## What is indexed

The title, the headings and the body of every page, the changelog included. Code is indexed as it is written, so a command can be found by its words. Markdown marks, links and HTML tags are not indexed, and neither are the menus and the footer.

The index is one file, `search-index.json`, built next to the pages. It lists every page once.

## Turning it off

```json
"search": { "enabled": false }
```

With this key the site has no search button, no dialog and no index, and `sitekit check` does not look for the index. A new site has search on, because `init` writes the key.

## How it loads

A page that is not searched costs one small script, which listens for the shortcut and for the focus of the button. The first time a reader uses search, the search code and the index are loaded, once, from the site itself. No request leaves the site.

## What it does not do yet

There is no typo tolerance in this version. A misspelled word finds nothing, so `instal` does not find `install`. Try a shorter word first.
