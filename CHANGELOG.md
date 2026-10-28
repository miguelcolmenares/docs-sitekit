# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-28

First release. The package is `docs-sitekit` and the action is `miguelcolmenares/docs-sitekit`. The `sitekit` command is the one you run: `npx docs-sitekit init`.

### Added

- `sitekit init`, `check`, `list` and `add`. `init` reads `package.json` and the git remote, finds `docs/`, `docs/tutorials/`, `docs/examples/` and `examples/`, writes the site and a GitHub Pages workflow, and refuses a folder that already has files.
- **Collections and groups.** A site has any number of collections (Docs, Tutorials, Examples). A page belongs to the collection with the deepest folder, so `docs/tutorials/` can sit inside `docs/`. Pages can be put in groups with a tone, and a page that is in no group, or a group that names a page that does not exist, fails the build instead of being skipped.
- **A reusable GitHub Action** (`miguelcolmenares/sitekit`) that installs, builds and checks a site and uploads it as the Pages artifact. The workflow `init` writes uses it and rebuilds the site when a release is published. Deploying stays in a separate job.
- A dark design system on Astro, Tailwind, shadcn/ui and lucide-react: tokens, header, hero, section headers, cards, feature grid, flow diagram, command table, callouts, footer, doc layout with table of contents, and copy buttons. Tokens come from one file, and contrast is tested on them.
- A content pipeline that turns markdown into pages, derives titles and descriptions without being fooled by badges, tables or code fences, rewrites relative links, and fails on two files that would get the same route.
- The version in the footer is read from the repository's `package.json` on every build, so a site rebuilt for a release shows the release.
- A publish check, `sitekit check`: credentials and internal hosts in the content and in the built files, the repository's visibility (a private repository's Pages site is public), and the shape of the output, including a `404.html` that is not a copy of `index.html`.
- Pack-and-install verification, and Playwright tests on a phone (320, 360 and 390 px) and a desktop: WCAG AA contrast measured in the browser, touch targets, scrollable code blocks and tables that can be focused, no horizontal scroll, keyboard use, and accessibility checks.
- Security policy, contributing guide, issue and pull request templates, and third-party notices.
