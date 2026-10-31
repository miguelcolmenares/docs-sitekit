---
order: 1
---

# Getting started

Create a documentation site for a repository in a few minutes.

## Requirements

Node 22 or newer. The generated site needs no token and no private registry: every package it uses is public.

## Create the site

Run this in the root of the repository you want to document:

```bash
npx docs-sitekit init
```

It writes `sitekit.config.json` and a `site/` folder, reading the name, description, license and repository from your `package.json` and git remote. Every key you can set in that file is in the [configuration reference](./configuration.md), and [Options by topic](./options.md) shows them in groups, with examples.

## Run it

```bash
cd site
npm install
npm run dev
```

## Where the content comes from

| Source         | Becomes                  |
| -------------- | ------------------------ |
| `docs/*.md`    | Pages under **Docs**     |
| `examples/`    | Pages under **Examples** |
| `CHANGELOG.md` | The **Changelog** page   |

A source that does not exist produces no page and no menu entry. Nothing is invented.

## Make it yours

The site is your code, so you can add to it. [Extending your site](./extending.md) has guides for an interactive page, a collection of your own, a component you changed, new colors, a logo and a layout, and a rule for `sitekit check`. Each one is run as a test, so it works on the site that `init` made.

## Publish

Push to the default branch. The deploy workflow builds the site and publishes it to GitHub Pages. See [Deploying](./deploying.md).
