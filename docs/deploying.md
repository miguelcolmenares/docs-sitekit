---
order: 5
---

# Deploying

The site is static, so GitHub Pages serves it directly.

## GitHub Pages

Set the repository to publish from GitHub Actions, and keep `site.base` equal to `/<repository>/` in `sitekit.config.json`.

## Rebuild on every release

`init` writes `.github/workflows/docs.yml`. It calls the docs-sitekit action, which installs the site, builds it, checks it and uploads it, and then a
separate job deploys it. The workflow runs when the docs change and when a release is published, so the changelog and the version in the footer
(read from `package.json` on each build) are always the latest. See the README of the repository for every input of the action.

The checkout in that workflow uses `fetch-depth: 0`, the full history. The date of the last change of a page comes from the history of its file, and a
shallow clone would give every page the same date. See [Edit this page](./edit-link.md).

## Check before you publish

```bash
npx docs-sitekit check --dist dist
```

It rebuilds the content, scans it and the built files for credentials and internal hosts, reports broken links, missing images and other problems of the markdown with their file and line (see [Content](./content.md)), and checks the repository visibility. A private repository's Pages site is public, so the check fails until you say that is intended.
