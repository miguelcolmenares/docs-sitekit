# Keep the build safe

Know what `sitekit check` looks for before a site is published, and add a rule of your own to the closed config.

`sitekit check` is the command that decides if a site is safe to publish. The generated workflow and the `docs-sitekit` Action run it after the build, so a failing check stops the deploy. It exits with 1 when it finds an error and prints `Safe to publish.` or `Not safe to publish.` at the end.

## What it looks for

- **Credentials and internal details in your files.** Every markdown file the site publishes is scanned. The high confidence rules look for AWS access keys, private keys, GitHub, Slack and npm tokens and JSON web tokens. The medium confidence rules look for `password = "..."` style assignments, AWS ARNs with an account number, private network addresses, internal host names (`.internal`, `.corp`, `.lan`, `.intranet`) and email addresses. An address at `example.com`, `.test` or `.invalid`, and `noreply`, are not reported.
- **Problems in the content.** Broken links and images, anchors, frontmatter, repeated headings, callout markers, variables and snippets, each with a file, a line and a severity you can set with `check`. See [Content](./content.md#what-check-finds-in-the-content).
- **The repository.** A site on GitHub Pages is public, so `check` stops when the repository is private, unless `deploy.acknowledgePublicPages` says that is intended.
- **The built site**, with `--dist`. The high confidence rules run over every text file of the build. It also checks that `index.html` and `404.html` exist, that every page has a `<title>`, and that the search index and `llms.txt` match the pages.

A finding is printed with the file and the rule, and the first characters of the match, never the whole text. A secret is not repeated in a log.

## Add a rule

The config is closed: it takes no code, and a key that is not in the schema fails the build. The way to add a rule is a regular expression under `anonymize.denyPatterns`. This one makes `check` stop on a ticket number of the form `ACME-` and four digits:

<!-- prettier-ignore-start -->
<!-- recipe-file: safe-build site/sitekit.config.json -->
```json title="site/sitekit.config.json"
{
  "anonymize": {
    "denyPatterns": ["ACME-\\d{4}"]
  }
}
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

In a JSON string a backslash is written twice, so `\d` is `\\d`. Run `check`, and a page that says `The fix is tracked in ACME-1042.` stops it. The rule is numbered in the order of the list, `deny-pattern-1` for the first one, and the match is masked:

```text
docs/ticket.md: deny-pattern-1 (high) "ACM…"
```

A deny pattern counts as high confidence, so it also runs over the built site, in every text file. To accept a text that a pattern matches, add the exact text to `anonymize.allow`:

```json
{ "anonymize": { "allow": ["ACME-1042"] } }
```

With that, the same page passes. The other keys of `anonymize`, `excludePaths` to keep a file out and `replace` to swap a word, are in [Content checks and publishing](./options-checks.md#keep-files-and-words-out-of-the-site).

## How it is tested

- `scripts/verify-package.mjs` (section 5d, `safe build`) applies the config to a site made by `init`, writes `docs/ticket.md`, and checks that `sitekit check` exits with 1 and prints the line above without the ticket number. It adds the text to `allow` and checks that the check passes, and that the check passes on the site with every guide applied, before and after the build (`check --dist`).
- `src/__tests__/recipes.test.ts` runs the same rule with the library, with the file and with the built site.
