# Change a component, and keep the change

Add a component with `add`, change it, and see what `add` and `sitekit upgrade` do to the file you changed.

The components are copied into your site by `init`, so they are your files. `add` writes the files of one component, and the lock file `site/.sitekit.json` remembers how each file was when the kit wrote it. That is how the kit can tell a file you changed from a file it can replace.

## Add a component

```bash
npx docs-sitekit add stat-row
```

`add` writes the files of the component, and of the components it needs. A file that is missing is written, so if you deleted `StatRow.tsx` this brings it back. A file you did not change is refreshed with the kit's version, and a file you changed is kept. The [component pages](./components.md) list the files, the props and the command of each component, and `npx docs-sitekit list` prints the names.

## Change it

This change draws the value of each stat in the brand color. It is written as a diff, so you see exactly the line that changes:

<!-- prettier-ignore-start -->
<!-- recipe-file: component site/src/presentation/components/site/StatRow.tsx.diff -->
```diff title="site/src/presentation/components/site/StatRow.tsx"
diff --git a/site/src/presentation/components/site/StatRow.tsx b/site/src/presentation/components/site/StatRow.tsx
--- a/site/src/presentation/components/site/StatRow.tsx
+++ b/site/src/presentation/components/site/StatRow.tsx
@@ -51,3 +51,3 @@ export function StatRow({
           </dt>
-          <dd className="mt-3 font-mono text-3xl font-semibold tracking-tight wrap-anywhere text-fg-bright">
+          <dd className="mt-3 font-mono text-3xl font-semibold tracking-tight wrap-anywhere text-brand">
             {stat.value}
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

The color is `text-brand`. In the Tailwind theme of the kit, `accent` is the quiet surface that shadcn/ui uses for a hover, and `brand` is the accent of `design/tokens.json`. A value in `text-accent` is nearly invisible: the test caught it at 1.15:1.

The component reads its numbers from props, and the home page passes it the `stats` of the config. This is what the guide adds to the config, so the row has something to show:

<!-- prettier-ignore-start -->
<!-- recipe-file: component site/sitekit.config.json -->
```json title="site/sitekit.config.json"
{
  "stats": [
    { "value": "1.0", "label": "Version", "note": "The latest release" },
    { "value": "22+", "label": "Node", "note": "To build the site" },
    { "value": "MIT", "label": "License" }
  ]
}
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

## What `add` does now

`add` sees that the file differs from the one in the lock, and keeps yours:

```text
= src/presentation/components/site/StatRow.tsx (you changed it, kept; use --force to replace)
```

`npx docs-sitekit add stat-row --force` writes the kit's version over yours.

## What `upgrade` does

Commit your change first. With uncommitted changes `sitekit upgrade` is a dry run, so that one `git diff` shows what an upgrade did. Then run it:

```bash
npx docs-sitekit@latest upgrade
```

When the new kit did not change `StatRow.tsx`, the file is kept as it is:

```text
= site/src/presentation/components/site/StatRow.tsx (you changed it, the kit did not, kept)
```

When the new kit changed the same file, `upgrade` does not touch yours. It writes the kit's version next to it as `StatRow.tsx.sitekit-new`, and you merge the two. [Upgrading](./upgrading.md) lists the four cases and shows how to merge.

## How it is tested

- `scripts/verify-package.mjs` (section 5d, `component`) deletes `StatRow.tsx`, runs `add stat-row` and checks that the kit's file is back. It applies the diff, runs `add` again and checks the message above and that the file is as you changed it. It commits, runs the real `sitekit upgrade` and checks the line above, `0 replaced, 0 added, 1 kept, 0 to merge`, and that the working tree is clean afterwards.
- The case in which both you and the kit changed the file is covered where the upgrade from the published 0.1.0 is tested, in the same script (section 5b).
- The group `recipe component` of `e2e/specs/recipes.spec.ts` builds the site with the change and checks that the values are drawn in the accent color, in the dark and the light theme, with AA contrast, while the labels and the notes keep the look the kit gave them.
