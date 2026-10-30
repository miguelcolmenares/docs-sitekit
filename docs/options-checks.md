# Options: content checks and publishing

The keys that decide what blocks a publish and what is kept out of the site: `check`, `anonymize`, `vars` and `deploy`.

Each key is documented in the configuration reference, under [`check`](./configuration.md#check), [`anonymize`](./configuration.md#anonymize), [`vars`](./configuration.md#vars) and [`deploy`](./configuration.md#deploy). This page shows them together and says what they change. What the check reads and what it skips is in [Content](./content.md#what-check-finds-in-the-content).

## How serious each finding is

```json title="sitekit.config.json" {3,9,11}
{
  "check": {
    "links": "error",
    "excludedLinks": "warning",
    "anchors": "warning",
    "images": "error",
    "frontmatter": "warning",
    "order": "error",
    "duplicateHeadings": "off",
    "callouts": "warning",
    "variables": "error",
    "snippets": "error",
    "card": "error"
  }
}
```

Each key is a kind of finding, and the value is `error`, `warning` or `off`. The example writes every kind, but you only need to write the ones you want to change: a kind you leave out keeps its default. The highlighted lines are the three that differ from the defaults, a broken link and an undeclared variable that now stop a publish, and repeated headings that are no longer reported.

What the value does:

- **`error`** is printed by the build, and `sitekit check` exits with 1, so a pipeline that runs it stops. The last line of the check says `Not safe to publish.`
- **`warning`** is printed with the file and the line, and the check still ends with `Safe to publish.`
- **`off`** is not reported at all.

The build only prints findings, whatever their severity. The command `sitekit check` is the one that decides. A name under `check` that is not a kind fails with the name and the list of kinds.

These are lines that `sitekit check` prints for a page with one of each problem, with the default severity of each kind:

| Kind                | A line it prints                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `links`             | `docs/problems.md:8: warning: Link "./nope.md" does not match any file`                                                                                                     |
| `excludedLinks`     | `docs/problems.md:8: warning: Link "./hidden.md" points to an excluded file, so only its text is kept`                                                                      |
| `anchors`           | `docs/problems.md:8: warning: Link "./guide.md#nowhere" points to a heading that does not exist in docs/guide.md`                                                           |
| `images`            | `docs/problems.md:10: error: Image "./pic.png" does not exist`                                                                                                              |
| `frontmatter`       | `docs/problems.md:2: warning: Frontmatter key "titel" is not one the kit reads (title, description, order, tags, meta, links). Did you mean "title"?`                       |
| `order`             | `docs/problems.md:3: error: Frontmatter "order" must be a number, and this is "first". Write it without quotes, for example order: 2.`                                      |
| `duplicateHeadings` | `docs/problems.md:21: warning: Heading "Same" makes the same anchor as the one on line 19, so its link is #same-1`                                                          |
| `callouts`          | `docs/problems.md:12: warning: "[!NOTES]" is not a callout marker, so this stays a plain blockquote. The markers are [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]` |
| `variables`         | `docs/problems.md:17: warning: Unknown variable "undeclared". Define it under "vars" in sitekit.config.json, or put it in a code span to show it as written.`               |
| `snippets`          | `docs/problems.md:15: error: Snippet "missing.md" was not found. Snippets are the files under snippets/ at the root of the repository.`                                     |
| `card`              | `docs/card.md:3: error: Item 1 of "meta" has the key "lable", which the card does not read. It takes "label" and "value".`                                                  |

## Keep files and words out of the site

```json title="sitekit.config.json"
{
  "anonymize": {
    "excludePaths": ["docs/drafts/**"],
    "replace": {
      "BigCorp": "the client",
      "builder.internal": "the build host"
    },
    "denyPatterns": ["PROJ-\\d+"],
    "allow": ["support@acme.example"]
  }
}
```

Given a page that says `The client BigCorp runs on host builder.internal and ticket PROJ-1234 is open. Contact support@acme.example.`, the example does this:

- **`excludePaths`** removes the files that match from the site. A page in `docs/drafts/` is not read, so it has no page, no search entry and no line in `llms.txt`. The globs are relative to `sources.root`.
- **`replace`** swaps each text everywhere it is found, before the page is read. The page above is built as `The client the client runs on host the build host and ticket PROJ-1234 is open.`
- **`denyPatterns`** are regular expressions that `sitekit check` reports as a leak, besides the credentials and internal hosts it always looks for. The ticket number above is reported as `deny-pattern-1`, once for the source file and once for each built file that holds it. A leak is an error.
- **`allow`** lists exact texts that `check` accepts although a pattern matches them. Without it, the support address above is reported as an `email-address` by the built-in patterns. With it, it passes.

> [!WARNING]
> In a JSON string a backslash is written twice. The pattern `PROJ-\d+` is `"PROJ-\\d+"` in the file.

## Variables

```json title="sitekit.config.json"
{
  "vars": {
    "product": "Acme",
    "package": "@acme/queue"
  }
}
```

A page that writes `{{ product }}` is built with `Acme` in that place, in prose, headings, link text and the frontmatter. In a code span or a fenced block the text is left as written, so a page can show the syntax. A name that is not declared stays as written and is a `variables` finding.

`{{ version }}` needs no entry: its value is `site.version`, else the `version` of the `package.json` at the root of the repository. A `version` written under `vars` wins for the text of the pages, and it does not change the `v2.4.0` label of the footer, which keeps following `site.version`.

## Where it is published

```json title="sitekit.config.json"
{
  "deploy": {
    "target": "github-pages",
    "acknowledgePublicPages": true,
    "repositoryVisibility": "private"
  }
}
```

These keys change what `sitekit check` says about the repository, and nothing in the pages.

| The config says                                        | `sitekit check` prints                                                                                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| a public repository                                    | Nothing about the repository.                                                                                                                         |
| a private one, and no `acknowledgePublicPages`         | `error: The repository is private, and GitHub Pages would publish this site publicly. Set deploy.acknowledgePublicPages to true if that is intended.` |
| a private one, with `acknowledgePublicPages` as `true` | `warning: The repository is private, and GitHub Pages will publish this site publicly. Acknowledged in the config.`                                   |
| `target` as `none`                                     | Nothing: the visibility is not looked at.                                                                                                             |

`repositoryVisibility` is for a runner where `check` cannot get the answer from GitHub. Without it, and without an answer, the check stops with `error: Cannot tell whether the repository is private. Set deploy.repositoryVisibility in sitekit.config.json.`
