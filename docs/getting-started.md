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

It writes `sitekit.config.json` and a `site/` folder, reading the name, description, license and repository from your `package.json` and git remote.

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

## Publish

Push to the default branch. The deploy workflow builds the site and publishes it to GitHub Pages. See [Deploying](./deploying.md).
