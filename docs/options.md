# Options by topic

The same keys as the [configuration reference](./configuration.md), sorted by what you want to do, each with an example you can paste.

The reference is the one place where each key is documented: its type, its default, the values it accepts and its description. These pages do not repeat it. They show a group of keys together in a `sitekit.config.json`, and say what the group changes on the site.

Every example on these pages is a complete `sitekit.config.json` for the keys it shows, and a test checks it against the real schema. Another test reads the schema and fails when a key has no example here, so a new key cannot ship without one.

## The topics

| I want to...                                        | Keys                                      | Page                                                  |
| --------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------- |
| Name the site and shape the home page               | `site`, `hero`, `features`, `stats`       | [Identity and the home page](./options-identity.md)   |
| Set the menu, the footer, the collections and files | `nav`, `footer`, `collections`, `sources` | [Navigation and collections](./options-navigation.md) |
| Choose the first theme a visitor sees               | `theme`                                   | [Theme and design](./options-theme.md)                |
| Turn search and `llms.txt` on or off                | `search`, `llms`                          | [Search and llms.txt](./options-search-llms.md)       |
| Decide what blocks a publish, and what is kept out  | `check`, `anonymize`, `vars`, `deploy`    | [Content checks and publishing](./options-checks.md)  |
| Show an edit link and the date of the last change   | `editLink`, `lastUpdated`                 | [Edit link and dates](./options-edit-link.md)         |
| Use a brand logo as an icon                         | `features[].icon`                         | [Brand logos](./options-brand-logos.md)               |

> [!NOTE]
> The file is a closed contract. A key that is not in the schema fails the build and `sitekit check`, and the message names it. If you are not sure of a name, start from the reference.

## How the examples were checked

What each page says a key changes comes from building a site with that key and reading the result: the HTML of the pages, the files next to them, and the output of `sitekit check`. A sentence that starts with a path, a tag or a message is what was found there. Where a key only has an effect with another one, the page says so.
