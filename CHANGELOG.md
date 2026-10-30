# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **A `StatRow` component for a few numbers with their labels.** Two to five items, each a value, a label and an optional note, as a description list so the label and the value are read together. The value is the large text in the mono face and wraps when it is long. The grid has explicit tracks, one column on a phone, and it chooses no status color. The home page shows it when `sitekit.config.json` has a `stats` key (two to five items, or none), and a site without the key does not change. `sitekit add stat-row` restores it. See `docs/components.md`.
- **Search.** A header button, Ctrl K or Cmd K, and the slash key open a dialog that searches the title, headings and text of every page, and opens the section that matched. The search code and the index load on first use, and `search.enabled` in the config turns it off. `sitekit check` verifies that the index lists every page. Typo tolerance is not in this version.
- **A light theme, with a switch in the header.** The site stays dark by default. `theme.default` in `sitekit.config.json` takes `dark`, `light` or `system`, and an invalid value fails the build with the key named. A visitor's choice is saved in the browser and wins over the default, and the theme is applied before the first paint. The light set is a second set of colors in `design/tokens.json`, with the same keys as the dark one, and a test fails when the keys differ. Code blocks have a light highlighter theme. A site generated with an earlier version keeps its own `design/tokens.json`, which has no light set, so it stays dark until it adds one.
- **An `llms` key for `llms.txt`.** With `enabled`, the site writes `llms.txt` at its base: an H1 with the name, the description, one H2 per collection with absolute links and descriptions, and `## Optional` for the collections listed in `optional`. With `markdownPages`, each page also has a Markdown copy at its address with `index.html.md` after it, and the page links to it. `sitekit init` turns it on for a new site, and a site without the key does not change. It is a community proposal, not a search feature. See `docs/llms.md`.
- `sitekit check` verifies `llms.txt` when it is on: the H1, every link, every page listed, the Markdown copies, and the credential and internal host scan.
- **Callouts written in markdown.** A blockquote that starts with `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]` or `> [!CAUTION]` on its own line becomes a callout, the alert syntax that GitHub renders too. It is plain HTML with `role="note"`, a hidden icon and a visible label, so it needs no JavaScript, and the tones come from the existing color tokens. A callout can hold paragraphs, lists and code, and can sit in a list item. A blockquote without a marker, an unknown marker such as `[!NOTES]`, and a marker in code are left as they are. The `Callout` component has the same five kinds, `role="note"` and a colored left edge, and the docs have a new page, Callouts. A site generated earlier keeps its own copy of the template, so it renders callouts only after `callouts.ts`, `calloutIcons.ts`, `remarkCallouts.ts`, the change in `renderMarkdown.ts` and the callout styles of `prose.css` are copied from this version. See `docs/callouts.md`.

### Changed

- **The project site announces `https://miguelcolmenares.com/docs-sitekit/` as its address**, in its canonical links, its sitemap and its `llms.txt`. The personal domain serves the site through a proxy, and GitHub Pages keeps answering at the old address. A site generated with `init` is not affected.
- **The default accent is the VS Code blue**: `accent` `#4fc1ff`, `accent-strong` `#007acc` and `accent-contrast` `#ffffff`, in place of the purple. A site generated with `init` takes the blue from the kit it is generated with. A site generated earlier keeps its own `design/tokens.json`, so it stays purple until its owner changes that file.
- **The Action's Marketplace icon is blue**, `branding.color` in `action.yml`, to match the new default accent. Blue is the closest color the Marketplace offers to the VS Code blue.

### Fixed

- **The name of the tool is `docs-sitekit` everywhere a reader sees it.** The footer of every generated site, the Action address, its name, the issue forms, the contributing steps and the help text used the old short name. The `sitekit` command and the file names do not change. A test reads these texts and fails on the old name. The Action address in the 0.1.0 notes is corrected too.

## [0.1.1] - 2026-10-28

### Fixed

- **Two CodeQL findings in `describe.ts`**, the file that turns markdown into titles and descriptions and that every generated site carries. Removing HTML tags in a single pass left a `<script` behind when tags were nested, so tags are now removed until the text stops changing. The check for a row of badges used a nested repetition that could backtrack exponentially on a long run of badge-like text, and now removes each badge with a single pattern. Both have regression tests. A site generated with 0.1.0 can copy `describe.ts` from this version.
- The project site is served under `/docs-sitekit/`, where it was still asking for its assets under the old repository name. A test now ties the site's base path, address and repository to `package.json`.

## [0.1.0] - 2026-10-28

First release. The package is `docs-sitekit` and the action is `miguelcolmenares/docs-sitekit`. The `sitekit` command is the one you run: `npx docs-sitekit init`.

### Added

- `sitekit init`, `check`, `list` and `add`. `init` reads `package.json` and the git remote, finds `docs/`, `docs/tutorials/`, `docs/examples/` and `examples/`, writes the site and a GitHub Pages workflow, and refuses a folder that already has files.
- **Collections and groups.** A site has any number of collections (Docs, Tutorials, Examples). A page belongs to the collection with the deepest folder, so `docs/tutorials/` can sit inside `docs/`. Pages can be put in groups with a tone, and a page that is in no group, or a group that names a page that does not exist, fails the build instead of being skipped.
- **A reusable GitHub Action** (`miguelcolmenares/docs-sitekit`) that installs, builds and checks a site and uploads it as the Pages artifact. The workflow `init` writes uses it and rebuilds the site when a release is published. Deploying stays in a separate job.
- A dark design system on Astro, Tailwind, shadcn/ui and lucide-react: tokens, header, hero, section headers, cards, feature grid, flow diagram, command table, callouts, footer, doc layout with table of contents, and copy buttons. Tokens come from one file, and contrast is tested on them.
- A content pipeline that turns markdown into pages, derives titles and descriptions without being fooled by badges, tables or code fences, rewrites relative links, and fails on two files that would get the same route.
- The version in the footer is read from the repository's `package.json` on every build, so a site rebuilt for a release shows the release.
- A publish check, `sitekit check`: credentials and internal hosts in the content and in the built files, the repository's visibility (a private repository's Pages site is public), and the shape of the output, including a `404.html` that is not a copy of `index.html`.
- Pack-and-install verification, and Playwright tests on a phone (320, 360 and 390 px) and a desktop: WCAG AA contrast measured in the browser, touch targets, scrollable code blocks and tables that can be focused, no horizontal scroll, keyboard use, and accessibility checks.
- Security policy, contributing guide, issue and pull request templates, and third-party notices.
