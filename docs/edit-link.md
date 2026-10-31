---
order: 7
---

# Edit this page and the date of the last change

A link at the foot of each page to its source file, and the date the file last changed.

## What the reader gets

A reader who finds a mistake can open the file on the repository host and propose the fix. A reader who finds an old page can
see how old it is. Both come from what the kit already knows: the address of the repository, the branch, the path of the source
file and the history of that file in git.

Both are shown at the foot of the page, after the content. The home page and the 404 page are generated and have no source file, so
they do not have them. The pages of a collection do, and so does the changelog page, because `CHANGELOG.md` is a file you edit.

## Turn it on

Add the keys to `sitekit.config.json`:

```json
"editLink": {
  "enabled": true,
  "branch": "main"
},
"lastUpdated": {
  "enabled": true
}
```

Each field, its default and what it does are in the configuration reference: [`editLink`](./configuration.md#editlink) and [`lastUpdated`](./configuration.md#lastupdated).

`sitekit init` writes both on for a new site. `editLink` is on when the repository is on GitHub, and `branch` is the branch that
`origin` points at, else the branch that is checked out. A site generated before these options existed has no keys, so it does not
change by itself. `sitekit upgrade` writes both with `enabled: false`, and you turn them on when you want them.

## The edit link

The address is built from `site.repository`, the branch and the path of the file from the root of the git repository:

| Host      | Address                                      |
| --------- | -------------------------------------------- |
| GitHub    | `{repository}/edit/{branch}/{path}`          |
| GitLab    | `{repository}/-/edit/{branch}/{path}`        |
| Bitbucket | `{repository}/src/{branch}/{path}?mode=edit` |

The host is found from the domain of `site.repository`. When it is not one of the three, for example a GitLab on your own domain,
set `editLink.host`. When there is no `site.repository`, or the host cannot be found, the link is turned off and the build and
`sitekit check` say why. The kit does not guess an address that goes nowhere.

The path is right for a page in `docs/`, for a collection with a folder of its own, and for a site whose sources are in a subfolder
of the repository. When `sources.root` is not the root of the git repository, the kit asks git for the folder in between and puts it
in front of the path.

## The date of the last change

The date is the author date of the last commit that changed the file, read with `git log -1 --format=%aI -- <file>` at build time.
It is the history of that file, not the last commit of the repository, so a page nobody touched keeps its old date. The page shows it
as a `<time>` element: `<time datetime="2026-03-15">15 March 2026</time>`. The day is the one written in the commit, so it does not
depend on the time zone of the machine that builds. A file that git has never seen, such as a new file that is not committed yet,
has no date.

### The full history is needed

A shallow clone has only the latest commits, so git would answer with the date of the oldest commit it has for every file. That is
wrong, and the kit does not publish it. In a shallow clone, or outside a git repository, the build shows no dates and prints a
warning, and `sitekit check` warns when the clone is shallow and `lastUpdated` is on. The warning does not fail the check, because the
site is still correct, only without dates.

`actions/checkout` fetches one commit by default. The workflow that `init` writes sets `fetch-depth: 0` for this:

```yaml
- uses: actions/checkout@<commit>
  with:
    fetch-depth: 0
```

A workflow written before these options existed does not have it, and `sitekit upgrade` never edits the workflow. Add the `with`
block yourself when you turn `lastUpdated` on.

## The look

The line is small text in the muted color, which reaches WCAG AA in the dark and the light theme, and the link is a 44 px target. The
component is `PageInfo`, and `sitekit add page-info` restores it. See [PageInfo](./components/page-info.md).
