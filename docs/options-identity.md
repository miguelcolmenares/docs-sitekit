# Options: identity and the home page

The keys that say what the site is, and what the home page shows first: `site`, `hero`, `features` and `stats`.

Each key is documented in the [configuration reference](./configuration.md#site). This page shows them together and says what they change.

## The name, the address and the repository

```json title="sitekit.config.json" {3-5}
{
  "site": {
    "name": "Acme",
    "description": "Acme runs background jobs for your app.",
    "url": "https://acme.example",
    "base": "/acme/",
    "repository": "https://github.com/acme/acme",
    "license": "MIT",
    "version": "2.4.0",
    "installCommand": "npm install acme"
  }
}
```

What it changes, on the pages of the built site:

- **`name`** is the text of the link to the home page in the header and of the footer. Every page title ends with it, as `Page title · Acme`. The home page title is `Acme: Acme runs background jobs for your app.`, and the features section is called `Why Acme`.
- **`description`** is the meta description of a page that has none of its own, and the line under the name in the footer.
- **`url` and `base`** build the canonical link of each page, the sitemap and `llms.txt`. With the values above, the page `docs/guide.md` has the canonical link `https://acme.example/acme/docs/guide/`, and every link and file of the site is under `/acme/`. Without `base` the site is served from `/`.
- **`repository`** adds a button with the logo and the name of the host to the header, the same link and a `Report an issue` link in the Project column of the footer, and a `View on GitHub` link in the closing band of the home page. Without it, none of the four is there.
- **`license`** adds `MIT licensed` to the line at the bottom of the footer.
- **`version`** adds `v2.4.0` to the bottom of the footer, as a link to the Changelog page when the site has one, and it is the value of `{{ version }}` in pages. Without it the site reads the `version` of the `package.json` at the root of the repository.
- **`installCommand`** is the command that the hero and the closing band offer with a copy button, and that the footer shows as text. Without it none of the three is drawn.

> [!TIP]
> On GitHub Pages a project site is served under the name of the repository, so `base` is `/repository-name/`. A site at the root of its domain uses `/`.

## The social image

When a link to the site is shared, the chat or the feed can show a picture with it. The kit draws none: it carries no image library for it, and the picture is made once, by you, so it says what you want it to say. [social-card-action](https://github.com/miguelcolmenares/social-card-action) draws one for you, in the style of this kit, and the section below shows how. Set `image` and every page names the picture with `og:image` and `twitter:image`, and asks for a large card.

```json title="sitekit.config.json" {6-7}
{
  "site": {
    "name": "Acme",
    "description": "Acme runs background jobs for your app.",
    "url": "https://acme.example",
    "image": "/social.png",
    "imageAlt": "Acme runs background jobs, with the logo on a dark background."
  }
}
```

- **`image`** is a path such as `/social.png`, which names a file in `public/` and gets the `base`, or a full `https` address, which is used as it is. Use a PNG of 1200 by 630 pixels, the size the networks show large. The kit gives no width or height, because it cannot know them.
- **`imageAlt`** is the text of the picture for a screen reader. Without it the text is the name and the description of the site, joined with a colon.

Without `image` the pages name no picture, and `twitter:card` stays `summary`.

### Draw the picture with social-card-action

[social-card-action](https://github.com/miguelcolmenares/social-card-action) is a GitHub Action that draws a 1200 by 630 PNG from the name and the description of the repository, in the dark colors of this kit, with the host at the foot. It runs in the job and adds nothing to your site or your `package.json`. Draw the card into the `public/` folder of the site, commit it, and name it with `image`:

```yaml title=".github/workflows/social-card.yml"
name: Social card

on: workflow_dispatch

permissions:
  contents: write

jobs:
  card:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - id: card
        uses: miguelcolmenares/social-card-action@v0.1.0
        with:
          path: site/public/social.png
      - if: steps.card.outputs.changed == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add site/public/social.png
          git commit -m "Update the social card"
          git push
```

Then set `"image": "/social.png"` in the `site` block of `sitekit.config.json`, as in the example above.

Run the workflow again after you change the description of the repository. The action leaves the file alone when the picture is the same, so it makes no empty commit. A repository that protects `main` needs a pull request instead of the push. The card uses the Latin letters of Geist, so a name in another alphabet needs a picture of your own.

## The hero

```json title="sitekit.config.json" {6-7}
{
  "hero": {
    "badge": "Beta",
    "title": "Background jobs without the babysitting.",
    "lede": "Queue a job, and Acme retries it until it works.",
    "primary": { "label": "Get started", "href": "/docs/getting-started/" },
    "secondary": { "label": "Source", "href": "https://github.com/acme/acme" }
  }
}
```

- **`title`** is the `h1` of the home page, and **`lede`** is the paragraph under it.
- **`badge`** is a small line above the title. Without it there is no line.
- **`primary`** is the first button. A `href` that starts with `/` is a path of the site, and the build adds the `base` to it: with the base `/acme/`, `/docs/getting-started/` becomes `/acme/docs/getting-started/`. This is done to every path, so write it without the base; the links of `nav` and `footer.links` leave a path that already starts with the base as it is, see [The base on a link](./options-navigation.md#the-base-on-a-link). The same button is in the closing band of the page.
- **`secondary`** is the quieter second link, only in the hero. A full URL is used as written. Without it the hero has one button.

## Feature cards

```json title="sitekit.config.json"
{
  "features": [
    {
      "icon": "zap",
      "eyebrow": "Fast",
      "title": "Jobs start in milliseconds",
      "text": "A worker picks a job up as soon as it is queued."
    },
    {
      "icon": "shield-check",
      "eyebrow": "Safe",
      "title": "Retries with a limit",
      "text": "A job that keeps failing stops, and says why."
    }
  ]
}
```

Each item is a card in the `Why Acme` section of the home page: the icon in a square, the `eyebrow` as a small label in the mono face, the `title` as a heading, and the `text`. The cards are in the order of the list. Without any item the section is not drawn, and the sections of the collections are numbered from `01` instead of `02`. The `icon` also takes a brand logo, see [Brand logos](./options-brand-logos.md).

## Numbers under the hero

```json title="sitekit.config.json"
{
  "stats": [
    { "value": "12 ms", "label": "Median start", "note": "Measured on the example app." },
    { "value": "0", "label": "Dependencies" },
    { "value": "MIT", "label": "License" }
  ]
}
```

The items become a row of values under the hero, each with its label, and with the `note` under the value when there is one. The kit fetches nothing, so you write the numbers yourself. The list takes two to five items or none: one item fails the build with `stats: stats takes two to five items, or none`. Without the key the row is not drawn. See [StatRow](./components/stat-row.md) for the component.
