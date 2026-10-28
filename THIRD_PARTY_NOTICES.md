# Third-party notices

sitekit is MIT licensed. Parts of the template are built on the work of others, listed here with what they are used for and under which license.

## Code that is copied into this repository

### shadcn/ui

The primitives in `template/src/presentation/components/ui/` (button, badge, card, tabs, tooltip, separator, breadcrumb, sheet) are
generated from [shadcn/ui](https://ui.shadcn.com) and adapted to this project's aliases and tokens.

```text
MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Packages a generated site depends on

These are installed from the public npm registry. They are not copied into this repository, and each keeps its own license.

| Package                                                                                             | License    | Used for                                        |
| --------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------- |
| [Astro](https://astro.build) and its integrations                                                   | MIT        | The static site framework                       |
| [Tailwind CSS](https://tailwindcss.com)                                                             | MIT        | Styling                                         |
| [React](https://react.dev)                                                                          | MIT        | Components                                      |
| [Radix UI](https://www.radix-ui.com) (`radix-ui`)                                                   | MIT        | Accessible primitives under the shadcn/ui parts |
| [lucide-react](https://lucide.dev)                                                                  | ISC        | Icons                                           |
| [class-variance-authority](https://cva.style)                                                       | Apache-2.0 | Component variants                              |
| [clsx](https://github.com/lukeed/clsx), [tailwind-merge](https://github.com/dcastil/tailwind-merge) | MIT        | Class names                                     |
| [Zod](https://zod.dev)                                                                              | MIT        | The config schema                               |
| [gray-matter](https://github.com/jonschlinkert/gray-matter)                                         | MIT        | Markdown frontmatter                            |
| [Geist](https://vercel.com/font) via `@fontsource-variable/geist` and `geist-mono`                  | OFL-1.1    | The typefaces, served from the site itself      |

Development and test only, never shipped: Playwright (Apache-2.0), axe-core and `@axe-core/playwright` (MPL-2.0), Jest, ESLint, Prettier, tsdown.

## Design reference

The look (dark, mono labels, thin borders, a hero with a copyable command) takes its direction from [skills.addy.ie](https://skills.addy.ie) by
Addy Osmani. No code, styles, text or assets of that site are used.
