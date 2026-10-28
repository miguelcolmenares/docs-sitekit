---
order: 5
---

# Deploying

The site is static, so GitHub Pages serves it directly.

## GitHub Pages

Set the repository to publish from GitHub Actions, and keep `site.base` equal to `/<repository>/` in `sitekit.config.json`.

## Rebuild on every release

`init` writes `.github/workflows/docs.yml`. It calls the sitekit action, which installs the site, builds it, checks it and uploads it, and then a
separate job deploys it. The workflow runs when the docs change and when a release is published, so the changelog and the version in the footer
(read from `package.json` on each build) are always the latest. See the README of the repository for every input of the action.

## Check before you publish

```bash
npx docs-sitekit check --dist dist
```

It rebuilds the content, scans it and the built files for credentials and internal hosts, and checks the repository visibility. A private repository's Pages site is public, so the check fails until you say that is intended.
