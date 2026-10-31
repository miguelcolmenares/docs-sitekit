# Add an interactive page

Add a page that is not markdown, such as a configurator, a calculator or a playground, with its own script and styles.

This guide builds a small configurator. The visitor types a title and sets a few options, and the page shows a preview of the hero of the home page and the `hero` key of `sitekit.config.json` that makes it. It is an Astro page in `site/src/pages/`, so the route is `/configurator/`.

## What the page gets from the site

- **The layout.** `BaseLayout` gives the header with the theme switch, the footer, the skip link, the title and the description. It takes `title` and `description`, and everything in its slot is yours.
- **The tokens.** The styles use `var(--sk-surface)`, `var(--sk-border-strong)`, `var(--sk-radius-md)` and the other variables of [Design tokens](./design-tokens.md), so the page follows the theme and a change of the tokens.
- **Its own script.** A `<script>` in an `.astro` file is bundled by Astro. It imports a module of the site and needs no framework and no package.

## The files

The text of the snippet is made by a function with no browser in it. The page calls it on the server, so it is sent with the default snippet already in place, and the script calls it again each time the form changes.

<!-- prettier-ignore-start -->
<!-- recipe-file: tool-page site/src/presentation/tools/heroSnippet.ts -->
```ts title="site/src/presentation/tools/heroSnippet.ts"
/** What the form on the page collects. */
export interface HeroChoices {
  /** The headline of the home page. */
  title: string;
  /** The text under the headline. */
  lede: string;
  /** A short line above the headline. Empty leaves it out. */
  badge: string;
  /** The text of the main button. */
  action: string;
  /** Where the main button goes, a path of the site. */
  target: string;
  /** Add a second, quieter button that goes to the changelog. */
  secondary: boolean;
}

/** The form starts here, and so does the page the server sends. */
export const DEFAULT_CHOICES: HeroChoices = {
  title: "Documentation that looks like a product",
  lede: "Guides, reference and examples in one place.",
  badge: "",
  action: "Get started",
  target: "/docs/getting-started/",
  secondary: false,
};

/** The `hero` key of sitekit.config.json for these choices, as text. */
export function heroSnippet(choices: HeroChoices): string {
  const badge = choices.badge.trim();
  const hero = {
    ...(badge ? { badge } : {}),
    title: choices.title,
    lede: choices.lede,
    primary: { label: choices.action, href: choices.target },
    ...(choices.secondary
      ? { secondary: { label: "Read the changelog", href: "/changelog/" } }
      : {}),
  };
  return JSON.stringify({ hero }, null, 2);
}

/** What the config would refuse: the three texts the schema asks for must not be empty. */
export function heroProblems(choices: HeroChoices): string[] {
  const required = [
    ["title", choices.title],
    ["lede", choices.lede],
    ["button text", choices.action],
  ] as const;
  return required
    .filter(([, value]) => value.trim() === "")
    .map(([name]) => `The ${name} is empty.`);
}
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

<!-- prettier-ignore-start -->
<!-- recipe-file: tool-page site/src/pages/configurator.astro -->
```astro title="site/src/pages/configurator.astro"
---
import { buttonVariants } from "../presentation/components/ui/button";
import BaseLayout from "../presentation/layouts/BaseLayout.astro";
import { DEFAULT_CHOICES, heroSnippet } from "../presentation/tools/heroSnippet";

// The page is sent with the default choices already in place, so it reads without JavaScript.
const choices = DEFAULT_CHOICES;
const targets = [
  { value: "/docs/getting-started/", label: "Getting started" },
  { value: "/examples/", label: "Examples" },
];
---

<BaseLayout title="Hero configurator" description="Fill in a form and copy the hero key of sitekit.config.json.">
  <div class="mx-auto max-w-site px-5 py-14">
    <h1 class="text-3xl font-semibold text-fg-bright">Hero configurator</h1>
    <p class="mt-3 max-w-prose text-fg-muted">Fill in the form. The preview and the <code>hero</code> key of <code>sitekit.config.json</code> follow what you type.</p>

    <div class="tool" data-tool>
      <form class="form" data-form>
        <div class="field">
          <label for="title">Title</label>
          <input id="title" name="title" value={choices.title} autocomplete="off" />
        </div>
        <div class="field">
          <label for="lede">Lede</label>
          <input id="lede" name="lede" value={choices.lede} autocomplete="off" />
        </div>
        <div class="field">
          <label for="badge">Badge (optional)</label>
          <input id="badge" name="badge" value={choices.badge} autocomplete="off" />
        </div>
        <div class="field">
          <label for="action">Button text</label>
          <input id="action" name="action" value={choices.action} autocomplete="off" />
        </div>
        <div class="field">
          <label for="target">Button goes to</label>
          <select id="target" name="target">
            {targets.map((target) => <option value={target.value} selected={target.value === choices.target}>{target.label}</option>)}
          </select>
        </div>
        <label class="check"><input type="checkbox" name="secondary" /> Add a second button</label>
      </form>

      <div class="output">
        <section aria-labelledby="preview-title">
          <h2 id="preview-title">Preview</h2>
          <div class="preview" data-preview>
            <p class="badge" data-preview-badge hidden></p>
            <p class="headline" data-preview-title>{choices.title}</p>
            <p class="lede" data-preview-lede>{choices.lede}</p>
            <p class="actions">
              <span class="primary" data-preview-action>{choices.action}</span>
              <span class="secondary" data-preview-secondary hidden>Read the changelog</span>
            </p>
          </div>
        </section>

        <section aria-labelledby="snippet-title">
          <h2 id="snippet-title">sitekit.config.json</h2>
          <pre tabindex="0"><code data-snippet>{heroSnippet(choices)}</code></pre>
          <p class="problems" data-problems role="status"></p>
          <button type="button" data-copy class={`${buttonVariants({ variant: "outline" })} min-h-11`}>Copy the snippet</button>
        </section>
      </div>
    </div>
  </div>
</BaseLayout>

<style>
  .tool {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 2rem;
    margin-top: 2rem;
  }
  @media (min-width: 64rem) {
    .tool {
      grid-template-columns: minmax(0, 22rem) minmax(0, 1fr);
      align-items: start;
    }
  }
  .form,
  .output {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    min-width: 0;
  }
  .field {
    display: grid;
    gap: 0.375rem;
  }
  label {
    color: var(--sk-fg);
    font-size: 0.875rem;
    font-weight: 500;
  }
  input:not([type="checkbox"]),
  select {
    min-height: 2.75rem;
    width: 100%;
    padding: 0 0.75rem;
    color: var(--sk-fg-bright);
    background: var(--sk-surface);
    border: 1px solid var(--sk-border-strong);
    border-radius: var(--sk-radius-md);
    font: inherit;
  }
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--sk-accent);
    outline-offset: 2px;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 2.75rem;
  }
  .check input {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: var(--sk-accent-strong);
  }
  h2 {
    margin-bottom: 0.75rem;
    color: var(--sk-fg-bright);
    font-size: 1.125rem;
    font-weight: 600;
  }
  .preview {
    padding: 1.5rem;
    background: var(--sk-bg-subtle);
    border: 1px solid var(--sk-border);
    border-radius: var(--sk-radius-lg);
  }
  .badge {
    display: inline-block;
    padding: 0.125rem 0.75rem;
    color: var(--sk-accent);
    font-family: var(--sk-font-mono);
    font-size: 0.75rem;
    border: 1px solid var(--sk-border-strong);
    border-radius: 999px;
    overflow-wrap: anywhere;
  }
  .badge[hidden] {
    display: none;
  }
  .headline {
    margin-top: 0.75rem;
    color: var(--sk-fg-bright);
    font-size: clamp(1.5rem, 5vw, 2.25rem);
    font-weight: 600;
    line-height: 1.1;
    overflow-wrap: anywhere;
  }
  .lede {
    margin-top: 0.75rem;
    color: var(--sk-fg-muted);
    overflow-wrap: anywhere;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }
  .primary,
  .secondary {
    padding: 0.5rem 1rem;
    border-radius: var(--sk-radius-md);
    font-size: 0.875rem;
    font-weight: 500;
  }
  .primary {
    color: var(--sk-accent-contrast);
    background: var(--sk-accent-strong);
  }
  .secondary {
    color: var(--sk-fg);
    border: 1px solid var(--sk-border-strong);
  }
  pre {
    overflow-x: auto;
    padding: 1rem;
    color: var(--sk-fg);
    background: var(--sk-surface);
    border: 1px solid var(--sk-border);
    border-radius: var(--sk-radius-md);
    font-family: var(--sk-font-mono);
    font-size: 0.8125rem;
    line-height: 1.6;
  }
  .problems {
    min-height: 1.5rem;
    margin: 0.5rem 0;
    color: var(--sk-danger);
    font-size: 0.875rem;
  }
</style>

<script>
  import { heroProblems, heroSnippet } from "../presentation/tools/heroSnippet";
  import type { HeroChoices } from "../presentation/tools/heroSnippet";

  const root = document.querySelector<HTMLElement>("[data-tool]")!;
  const form = root.querySelector<HTMLFormElement>("[data-form]")!;
  const part = (name: string) => root.querySelector<HTMLElement>(`[data-${name}]`)!;

  /** The choices as the form holds them now. */
  function read(): HeroChoices {
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? "");
    return {
      title: text("title"),
      lede: text("lede"),
      badge: text("badge"),
      action: text("action"),
      target: text("target"),
      secondary: data.get("secondary") === "on",
    };
  }

  /** Write the choices into the preview and the snippet. Only text is set, never HTML. */
  function show() {
    const choices = read();
    const badge = part("preview-badge");
    badge.textContent = choices.badge.trim();
    badge.hidden = choices.badge.trim() === "";
    part("preview-title").textContent = choices.title;
    part("preview-lede").textContent = choices.lede;
    part("preview-action").textContent = choices.action;
    part("preview-secondary").hidden = !choices.secondary;
    part("snippet").textContent = heroSnippet(choices);
    part("problems").textContent = heroProblems(choices).join(" ");
  }

  form.addEventListener("input", show);
  form.addEventListener("submit", (event) => event.preventDefault());

  const copy = part("copy");
  copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(part("snippet").textContent ?? "");
    copy.textContent = "Copied";
    setTimeout(() => (copy.textContent = "Copy the snippet"), 2000);
  });
</script>
```
<!-- /recipe-file -->
<!-- prettier-ignore-end -->

## What to keep when you write your own

- **Text only.** The script sets `textContent` and `hidden`, never `innerHTML`, so what a visitor types cannot add markup to the page.
- **A scrolling block needs `tabindex="0"`.** The `<pre>` has it in the HTML, so a keyboard user can scroll a long line without JavaScript.
- **Targets of 44 px on a phone.** The fields and the checkbox row have a `min-height` of `2.75rem`, and the button adds `min-h-11` to `buttonVariants`.
- **A grid item can be wider than its column.** The columns are `minmax(0, 1fr)`. Without the `0`, a long line in the `<pre>` stretches the grid and the page scrolls sideways.
- **Nothing is fetched.** The page makes no request while it loads or while someone types.

To reach the page from the header, add it to `nav`. A `nav` replaces the default menu, so write every link you want. See [the header menu](./options-navigation.md#the-header-menu).

## How it is tested

The tests are in the group `recipe tool-page` of `e2e/specs/recipes.spec.ts`. They check:

- At 320, 375 and 1280 px, the page does not scroll sideways and the form, the preview, the snippet and the button are inside the screen. The form and the output sit side by side at 1280 px and one above the other on a phone.
- At 320 px, a long line scrolls inside the snippet and the page stays still, and every field and the button are at least 44 px tall.
- The text of the snippet is equal to an expected text, for the default form and for a full set of choices, and the text is always JSON that holds exactly what was typed, quotes and angle brackets included.
- The preview follows the form, shows text and never HTML, and shows the badge and the second button only when asked.
- The copy button puts exactly the snippet on the clipboard.
- Without JavaScript the preview and the default snippet are there.
- Every request goes to the site, and nothing is logged as an error.
- The page follows the dark and the light theme, with the colors of the tokens, and every text reaches WCAG AA in both.

`src/__tests__/recipes.test.ts` tests `heroSnippet.ts` on its own, and checks that the snippet it writes is accepted by the real config schema.
