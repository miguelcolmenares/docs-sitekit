---
order: 6
---

# Code blocks

A title, highlighted lines, added and removed lines, and a button that copies the code, all written in the fence.

## Syntax

The options go after the language, in the part of the fence that GitHub ignores, so the page reads well in the repository too.

````markdown
```ts title="src/config.ts" {2,4-6}
export const config = {
  retries: 3,
  timeoutMilliseconds: 15000,
  endpoint: "https://example.com/api",
};
```
````

## Title

`title="..."` puts the name over the block, in a caption bar. Use double or single quotes. The title cannot hold the quote that opens it, and it is plain text.

```ts title="src/config.ts"
export const config = {
  retries: 3,
  timeoutMilliseconds: 15000,
};
```

## Highlighted lines

`{2,4-6}` highlights line 2 and lines 4 to 6, counted from 1 inside the block. A number past the end of the block is ignored. The highlighted lines have a background and a bar on their left edge, and the colors of the code stay readable on them.

```ts {2,4-5}
export function retry(attempts: number) {
  let tries = 0;
  while (tries < attempts) {
    tries += 1;
    console.log(`try ${tries}`);
  }
}
```

You can use both together: `ts title="src/retry.ts" {2}`.

## Added and removed lines

End a line with a comment that says `[!code ++]` for an added line or `[!code --]` for a removed one. The comment can start with `//`, `#`, `--`, `;`, `/*` or `<!--`, and it is taken out of the code before the block is drawn. The line gets a tone and a sign in the left margin, so the tone is not the only cue.

```ts title="src/config.ts"
export const config = {
  retries: 3, // [!code --]
  retries: 5, // [!code ++]
  timeoutMilliseconds: 15000,
};
```

A block in the `diff` language does the same with the `+` and `-` at the start of its lines. The two file header lines of a unified diff (`--- a/file` and `+++ b/file`) are left plain when a hunk header (`@@`) follows them.

```diff
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,4 +1,4 @@
 export const config = {
-  retries: 3,
+  retries: 5,
   timeoutMilliseconds: 15000,
 };
```

## The copy button

Every block has a copy button. It is a real button, so it works with the keyboard, it has the name "Copy code", and its target is 44 px high. After a copy it says "Copied" for a moment, and a polite status region announces the same word to a screen reader.

The button copies the text of the code exactly as the block shows it. The comments of `[!code ++]` and `[!code --]` are not in it, and neither are the signs drawn in the margin. A block in the `diff` language is copied as it is written, with its `+` and `-`, because that is the text of the patch. The removed lines of a marked block are copied too, since the block shows them.

The button is hidden without JavaScript, and in a browser that does not allow writing to the clipboard, so the block still reads and the code can be selected. The script is small, ships with the page and makes no request to another host.

## Long lines

A line that is wider than the page scrolls inside the block, and the title bar and the button stay where they are. The block can be focused and scrolled with the keyboard.

```ts title="src/endpoints.ts" {2-3}
export const endpoints = {
  documentation:
    "https://example.com/a/very/long/path/to/the/documentation/that/keeps/going/and/going/and/going/until/it/is/wider/than/a/phone",
};
```

## A site generated earlier

A site made with an earlier version keeps its own copy of the template, so it draws these blocks only after these files are copied from this version: `domain/codeBlocks.ts`, `infrastructure/codeBlocks.ts`, `presentation/code/copyCode.ts`, `styles/code.css`, the change in `infrastructure/renderMarkdown.ts`, the script and the change in `presentation/layouts/DocPage.astro`, the import in `styles/global.css`, the removed band and button rules in `styles/prose.css`, and the three `code-` colors of `design/tokens.json` in both color sets.
