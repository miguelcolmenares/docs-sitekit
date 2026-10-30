# docs-sitekit

Documentation sites that look like a product, published to GitHub Pages. A design system with a light and a dark theme, a content
pipeline that reads your repository, and a scaffold you run once with `npx`.

- **Design system**: tokens and components built on Astro, Tailwind, shadcn/ui and lucide-react. The components are
  copied into your site, so you own them.
- **Your repository is the source**: `docs/`, `examples/` and `CHANGELOG.md` become pages. Relative links keep working
  on GitHub and on the site.
- **Rebuilds on every release** with a reusable GitHub Action that installs, builds, checks and uploads the site.
- **Safe to publish**: a closed config contract, and a check that scans the content and the built files for
  credentials and internal hosts, and for a private repository whose Pages site would be public.
- **No token, no private registry**: a generated site builds with public packages only, and does not depend on this CLI.
- **Static and fast**: every route is a real HTML file with its own title. Only the copy buttons, the mobile menu and search (loaded on demand) ship JavaScript.
- MIT licensed.

## Start

Run this in the root of the repository you want to document. It needs Node 22.23.4 or newer.

```bash
npx docs-sitekit init
cd site && npm ci && npm run dev
```

`init` reads `package.json` and the git remote to fill `site/sitekit.config.json`, copies the site into `site/`, and writes
a GitHub Pages workflow to `.github/workflows/docs.yml`. It refuses a folder that already has files unless you pass `--force`,
and `--dry-run` shows what it would write.

## Commands

| Command                                 | What it does                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `sitekit init [--dir site] [--dry-run]` | Create the site, its config and the deploy workflow.                          |
| `sitekit check [--dist site/dist]`      | Scan the content and the built site, report broken links, check visibility.   |
| `sitekit list`                          | List the components.                                                          |
| `sitekit add <component> [--force]`     | Copy a component and what it needs. A file you edited is kept.                |
| `sitekit upgrade [--dry-run] [--apply]` | Bring a site up to the installed kit. A file you edited is never overwritten. |

## GitHub Action

`init` writes a workflow that rebuilds the site with this repository's action. You can also call it from any workflow of your own, for example to
rebuild the site on every release.

```yaml
- uses: actions/checkout@v7
- uses: miguelcolmenares/docs-sitekit@v0.1.1
  with:
    version: 0.1.1 # the docs-sitekit CLI that runs `check`
```

The action installs the site, builds it, runs `sitekit check` on the result, and uploads it as the GitHub Pages artifact. **Deploying stays in
your workflow**, in a job of its own with the permissions it needs, so a pull request can build and check a site without being able to publish it.

### Rebuild on every release

```yaml
name: Docs

on:
  push:
    branches: [main]
    paths: ["site/**", "docs/**", "examples/**", "README.md", "CHANGELOG.md"]
  release:
    types: [published]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: miguelcolmenares/docs-sitekit@v0.1.1
        with:
          version: 0.1.1

  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

A release changes the changelog and the version in the footer, which is read from the repository's `package.json` on every build, so rebuilding is
all it takes. For a package that publishes from a tag, add the same two jobs after the publish job and give the deploy job `needs: [publish, build]`.

### Inputs

| Input          | Default  | What it does                                                                                        |
| -------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `dir`          | `site`   | Folder of the site, relative to the repository root.                                                |
| `version`      | `latest` | Version of `docs-sitekit` that runs `check`. Pin an exact version so every run uses the same rules. |
| `node-version` | `24`     | Node.js version. A generated site needs 22.23.4 or newer.                                           |
| `check`        | `true`   | Run `sitekit check` on the built site and fail on a problem. Turn it off only to debug.             |
| `upload`       | `true`   | Upload the built site as the GitHub Pages artifact. Turn it off for a build that is only checked.   |

### Outputs

| Output | What it is                                               |
| ------ | -------------------------------------------------------- |
| `dist` | Path of the built site, relative to the repository root. |

### Good to know

- The build job needs only `contents: read`. The action never asks for `pages` or `id-token`: only the deploy job does.
- Pin the action to a version tag, or to a commit. Tags of this repository are immutable.
- A private repository's GitHub Pages site is public. `check` stops the job until you set `deploy.acknowledgePublicPages` in the site's config, and
  it asks GitHub for the visibility, so give the step a token (the action already passes `github.token`).
- It needs no secret and no private registry, so it runs the same for pull requests from forks and from Dependabot.

## Content

| Source         | Becomes                  |
| -------------- | ------------------------ |
| `docs/**/*.md` | Pages under **Docs**     |
| `examples/`    | Pages under **Examples** |
| `CHANGELOG.md` | The **Changelog** page   |

A source that does not exist makes no page and no menu entry. The title is the frontmatter `title`, else the first `#` heading,
else the file name. The description is the frontmatter `description`, else the first paragraph of prose (badges, tables, quotes,
HTML and code are skipped). `order: 1` in the frontmatter moves a page up.

With the `llms` key in `sitekit.config.json`, the site also writes an `llms.txt` map of its pages and a Markdown copy of each
one, for assistants and developer tools. It is a community proposal, not a search feature: Google Search does not use it.
See [docs/llms.md](docs/llms.md).

With the `editLink` and `lastUpdated` keys, every page ends with a link to edit its source file on the repository host and the date of
the last commit that changed that file. A new site has both on. See [docs/edit-link.md](docs/edit-link.md).

## Theme

The site is dark by default. A header switch lets the visitor pick the light theme, and the choice is remembered in the browser. Set `theme.default` in `sitekit.config.json` to change the first view (see the [configuration reference](docs/configuration.md#theme)). A site generated before this option was added keeps its own tokens file and has no light set, so it stays dark until it adds one (see `design/tokens.json` in the site).

## Documentation

The documentation site is built with this kit. Read it under `docs/`: getting started, components, design tokens, content, deploying.

Every key of `sitekit.config.json`, with its type, default and allowed values, is in the [configuration reference](docs/configuration.md). It is generated from the schema, and a test fails when it is out of date.

## Development

```bash
npm run bootstrap      # installs the CLI and the template
npm test               # unit and integration
npm run test:e2e       # packs the package, generates a site, builds it, and drives it in a browser
npm run build:tokens   # regenerate the CSS from template/design/tokens.json
npm run build:docs     # regenerate docs/configuration.md from the config schema
```

See [AGENTS.md](AGENTS.md) for the layout and the rules.

## Credits

Built on [Astro](https://astro.build), [Tailwind CSS](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com) (MIT),
[Radix UI](https://www.radix-ui.com), [lucide](https://lucide.dev) (ISC) and the Geist fonts (OFL). The look takes its
direction from [skills.addy.ie](https://skills.addy.ie) by Addy Osmani: dark, mono labels, thin borders. Nothing of that site's code,
styles or text is used.

## License

[MIT](LICENSE)
