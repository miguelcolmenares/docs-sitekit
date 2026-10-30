---
order: 6
---

# Upgrading

Bring a site that `sitekit init` made up to the version of the kit you have installed, without losing what you changed.

## Why it exists

`init` copies the template into your repository, and from then on the files are yours. When the kit fixes something, such as a contrast
value, a security finding in a helper or a new theme, you would have to copy files by hand and guess which ones changed.
`sitekit upgrade` does that comparison for you.

It can do it safely because `init` and `add` write a lock file, `site/.sitekit.json`. The lock holds the version that wrote the
files and a hash of every file as it was written. For each file in the lock, the upgrade compares three things: your file now, the
version it was written from (by its hash), and the kit's file.

## Run it

Run it from the root of the repository, with the newest kit:

```bash
npx docs-sitekit@latest upgrade
```

Use `--dir <folder>` when the site is not in `site/`. The command prints what it did to every file and what to do next. It exits with
0 when the upgrade ran, also when files are left for you to merge.

## The four cases

| Your file        | The kit's file | What happens                                                                    |
| ---------------- | -------------- | ------------------------------------------------------------------------------- |
| Not edited       | Changed        | **Replaced** by the new version.                                                |
| Edited           | Not changed    | **Kept** as it is.                                                              |
| Edited           | Changed        | **Left as it is.** The new version is written next to it as `file.sitekit-new`. |
| Not in your site | New            | **Added.**                                                                      |

A file that is the same in both versions, and a file you already copied from the new version by hand, need nothing and are counted as
current. A file you deleted is not brought back. A file in the lock that the kit no longer ships is left where it is and listed.

If you already have a file at the path of a new file of the kit, and it is not the same, the upgrade treats it as the third case:
your file stays and the kit's version is written as `.sitekit-new`.

## Look before you write

`--dry-run` prints the same report and writes nothing, not even a `.sitekit-new` file:

```bash
npx docs-sitekit@latest upgrade --dry-run
```

The upgrade is also a dry run by default when `git status` shows uncommitted changes in the repository, and it says so. Commit or stash
first, so that a single `git diff` shows what the upgrade did. Pass `--apply` to write anyway. When git is not available, or the folder
is not a repository, the upgrade cannot tell and writes.

## Merge a conflict

For a file with a `.sitekit-new` copy, compare the two, bring what you want into your file, and delete the copy:

```bash
diff site/src/styles/prose.css site/src/styles/prose.css.sitekit-new
```

Your file is never overwritten in this case, so nothing is lost if you leave it for later. The lock keeps the old hash of that file,
so the next upgrade finds the same conflict until your file is the new version.

## What it never touches

- **Your content.** `docs/`, `examples/`, `README.md` and `CHANGELOG.md` are not in the lock.
- **Files that are not in the lock and that the kit does not ship.** Your own files in `site/` stay as they are.
- **The deploy workflow**, `.github/workflows/docs.yml`. When it still pins the old version, the report says so and you change it.
- **`sitekit.config.json`**, with one exception: an option that did not exist in your version is added with the value that keeps the
  site as it was. Nothing you have set is changed.

The options added this way are `theme` with `default: "dark"`, `search` with `enabled: false` and `llms` with `enabled: false`. The
site looks and works as before, and you turn a feature on when you want it. `search` and `llms` are not written when the site already has the
files of that feature.

`package.json` and `package-lock.json` are compared like any other file, with the name and description your site already has, so the
name is not a change. If the kit changed the dependencies and you did not edit those files, they are replaced and you run
`npm install` in the site folder.

## After the upgrade

The lock is rewritten with the version that ran the upgrade, and with the new hash of every file that was replaced or added. A file
that was kept or left for you to merge keeps its old hash.

1. Run `npm install` in the site folder when `package.json` changed.
2. Build the site and run `npx docs-sitekit check`.
3. Merge the `.sitekit-new` files, if any, and delete them.
4. Set the version of `.github/workflows/docs.yml` to the one you upgraded to.
