# AGENTS.md

Context for any AI agent working in this repository.

## What this is

`docs-sitekit`: a CLI and a site template. The CLI scaffolds a documentation site into a repository, checks that it is
safe to publish, and restores components. The template is an Astro site with a design system. MIT, written from scratch.
Do not add code, text or configuration copied from other projects, and do not depend on private packages.

## Layout (Domain-Driven Design, barrel exports)

```text
src/                      the CLI
  domain/                 pure rules: derive a config from a repository, scan for secrets
  application/            use cases (init, check, add, list) and the ports they need
  infrastructure/         adapters: node:fs, git and gh, the packaged template
  presentation/           runCli, and cli.ts, the only file that knows where it is installed
template/                 the site that `init` copies. It has the same four layers inside src/
  src/domain/             config schema, markdown rules (title, description, links), document types
  src/application/        buildDocuments
  src/infrastructure/     reading sources, rendering markdown, loading the site
  src/presentation/       components (ui = shadcn, site = ours) and layouts
  src/pages/              Astro routes, which are entry points of the presentation layer
  design/tokens.json      the only source of colors, radius, fonts and layout
  registry.json           components, their files and what each requires
e2e/                      Playwright against a site generated from the packed tarball
scripts/                  build-tokens.mjs, build-docs.mjs (docs/configuration.md from the config schema), build-component-docs.mjs (the props tables of the component pages, from TSDoc), verify-package.mjs
template/src/examples/    the examples of the component pages, one folder per component. Kit documentation only: not in the package, not in a generated site
docs/, examples/          the documentation of this project, built with this kit (docs/components/ holds the notes of each component page)
```

Dependencies point inward. Every layer has an `index.ts`, and other layers import it, not its files. Exceptions, on purpose:
the CLI imports two files of the template infrastructure directly, so the markdown renderer never enters the CLI bundle,
and `src/presentation/cli.ts` is the composition root.

## Naming

Components `PascalCase.tsx` (`.astro` when they host an interactive island). Hooks `useThing.ts`. Everything else `camelCase.ts`.
Tests `src/__tests__/<unit>.test.ts`, template tests in `src/__tests__/template/`, specs in `e2e/specs/<topic>.spec.ts`.

## Tests

Three levels, all required for new behavior:

1. **Unit**: pure rules and use cases against an in-memory file system. Tests transpile only (`@swc/jest`); types are checked by `npm run typecheck`.
2. **Integration**: real files in a temporary directory.
3. **End to end**: `npm run test:e2e` packs the tarball, installs it, runs `init` on a throwaway repository, builds the generated site,
   checks the build, then Playwright drives it at 320, 360, 390 and desktop widths.

Rules are tests, not prose: no shadows, no decorative token as text, status colors only in `ToneBadge` and `Callout`, components
never import content, every registry file is real and every package it imports is declared. WCAG contrast is checked on the tokens
and measured in the browser on every route; the meter is itself tested against pages with a known answer.

## Rules learned the hard way

- **A generated site builds with public packages and no secret.** A private registry or a pinned external CLI breaks every job, fork and bot.
- **Commands that write must not guess the target.** `init` writes only into `--dir` and refuses a folder with files. Test it in a
  repository that has its own `src/`.
- **A command line passes `undefined` for options not given.** Never spread options over derived values.
- **Descriptions from markdown are full of traps**: badges, fences, tables, a `#` inside a code block. Cover each with a test.
- **404.html is the not-found page, never a copy of index.html.** `check` fails otherwise.
- **Scrollable regions need `tabindex="0"`**, set in the HTML so it works without JavaScript.
- **Touch targets are 44px on a phone** (24px is the floor). A link inside a sentence is exempt.
- **No layout is trusted until it is measured** at 320px: no horizontal scroll, columns side by side or stacked as intended.
- **`asChild` does not work with Astro children.** In `.astro` files use `buttonVariants` on the element.
- **Client directives exist only in `.astro` files.** A component with an interactive island is `.astro`.
- **Astro 7 needs Node 22.23.4 or newer**, and `astro preview` goes to the background without a terminal: the e2e uses its own static
  server that behaves like GitHub Pages (`e2e/serve.mjs`).
- Every key of the config schema needs a `.describe()`: `npm run build:docs` fails without one, and writes `docs/configuration.md`, which a test
  compares with the schema. Run it after changing a key, and do not edit that page by hand.
- **A registry entry has a component page or a reason it has none** (`docs/components.md`), and a page is made of four things that agree: the `example` pointer, the files in `template/src/examples/<name>/`, `docs/components/<name>.md` and its group in `template/sitekit.config.json`. Every prop of a component with a page needs a TSDoc comment, or `npm run build:docs` fails. The example is one `.astro` file that is both rendered and shown as text (`?raw`).
- **Kit-only paths** (`KIT_ONLY_PATHS` in `packagedTemplate.ts`, and the same paths negated in `files` of `package.json`) never reach the package or a generated site. `verify-package` checks both.
- **A color transition is not a color.** The browser tests wait for `document.getAnimations()` before they measure contrast.
- Do not edit `template/src/styles/tokens.css`: change `design/tokens.json` and run `npm run build:tokens`.
- Credential-shaped test values are built at run time, never written as literals.

## TSDoc

Every export of our own code has a TSDoc comment, enforced in CI by the jsdoc-to-tsdoc action. The shadcn components in
`components/ui` are generated and excluded.

## Releasing

Trusted publishing from a `v*` tag. Tags are immutable, so a tag is pushed only after the package builds and the e2e passes.
The first publication of a new package name is done by hand, then the trusted publisher is configured.

## Commits

Plain messages in the imperative. No attribution trailers.
