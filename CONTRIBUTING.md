# Contributing

Thanks for helping. This is a small project with strict checks, so most of the work of reviewing is done by the tests.

## Set up

You need Node 22.23.4 or newer (Node 26 is the current LTS).

```bash
git clone https://github.com/miguelcolmenares/docs-sitekit.git
cd docs-sitekit
npm run bootstrap     # installs the CLI and the template
npm test              # unit and integration
npm run test:e2e      # packs the package, generates a site, builds it, drives it in a browser
```

## Before you open a pull request

Run `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test` and `npm run test:e2e`. CI runs them on Node 22, 24 and 26, and it also checks that
every export of our own code has a TSDoc comment.

## What a change needs

- **A test at the right level.** Rules and use cases get unit tests, file handling gets an integration test, and anything a visitor sees gets a Playwright check.
- **The design rules hold.** They are tests: no shadows, status colors only in `ToneBadge` and `Callout`, components never import content, WCAG AA contrast,
  and 44 px touch targets on a phone. See [AGENTS.md](AGENTS.md).
- **A component has a page, or a reason it has none.** A new entry of `template/registry.json` either points at a folder of examples (`"example": "src/examples/<name>"`, with a page in `docs/components/<name>.md` and an entry in `template/src/examples/catalog.ts`) or gets a `###` heading in `docs/components.md` that says why it has no page. A test fails on both omissions. The props of the page come from the TSDoc of the component: every prop needs a comment, and `npm run build:docs` regenerates the table and fails on one without it. The examples are kit documentation and stay out of the package and out of a generated site.
- **Tokens come from one file.** Change `template/design/tokens.json` and run `npm run build:tokens`. Do not edit `tokens.css`.
- **No code copied from elsewhere**, and no dependency on a private package.

## Commits and pull requests

Plain, imperative messages. One idea per pull request. The `main` branch needs the CI checks to pass.

## Reporting bugs

Use the bug report form. A repository that reproduces it, or the `sitekit.config.json` and the command that failed, helps most.
