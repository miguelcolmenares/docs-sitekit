import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { measureContrast } from "../support/contrast";

// The recipes of "Extending your site" (docs/extend-*.md). Each one is a folder in e2e/recipes/ that verify-package.mjs
// applied to a site made by `sitekit init`, built, and checked with `sitekit check`. This file drives the result. The
// commands the pages name (add, upgrade, check, build:tokens) are run by verify-package.mjs, section 5d.
//
// The site is a repository called `recipes`, served under /recipes/ on the third port after the one of the generated site.
const SITE = `http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4401) + 3}`;
const BASE = "/recipes/";

test.use({ baseURL: SITE });

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const theme = (page: Page, value: "dark" | "light") =>
  page.addInitScript((chosen) => localStorage.setItem("theme", chosen), value);
// A color transition is not a color: the colors are read when it has ended.
const settle = (page: Page) =>
  page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
/** A token as the browser computes it: `var(--sk-surface)` as the `rgb(...)` text a style reports. */
const token = (page: Page, name: string) =>
  page.evaluate((property) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${property})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);

test.describe("recipe tool-page: an interactive page that is not markdown", () => {
  const PAGE = `${BASE}configurator/`;
  const SIZES = [
    { name: "320", width: 320, height: 640 },
    { name: "375", width: 375, height: 667 },
    { name: "1280", width: 1280, height: 800 },
  ];

  // What the form says before anyone types, and what it writes for a full set of choices.
  const DEFAULT_SNIPPET = `{
  "hero": {
    "title": "Documentation that looks like a product",
    "lede": "Guides, reference and examples in one place.",
    "primary": {
      "label": "Get started",
      "href": "/docs/getting-started/"
    }
  }
}`;
  const FULL_SNIPPET = `{
  "hero": {
    "badge": "Version 2",
    "title": "Docs for Acme",
    "lede": "Everything about Acme, in one place.",
    "primary": {
      "label": "Read the guide",
      "href": "/examples/"
    },
    "secondary": {
      "label": "Read the changelog",
      "href": "/changelog/"
    }
  }
}`;

  const snippet = (page: Page) => page.locator("[data-snippet]");
  // The <pre> around it: the block that scrolls when a line is long.
  const block = (page: Page) => snippet(page).locator("xpath=..");

  for (const size of SIZES) {
    test.describe(`at ${size.name} px`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      test("fits the screen: no sideways scroll, the form, the preview and the snippet all in view", async ({
        page,
      }) => {
        await page.goto(PAGE);
        expect(await overflow(page)).toBeLessThanOrEqual(0);
        for (const locator of [
          page.getByRole("heading", { level: 1, name: "Hero configurator" }),
          page.getByLabel("Title"),
          page.getByLabel("Button goes to"),
          page.locator("[data-preview]"),
          block(page),
          page.getByRole("button", { name: "Copy the snippet" }),
        ]) {
          await locator.scrollIntoViewIfNeeded();
          const box = (await locator.boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(size.width);
        }
      });

      test("puts the form and the output side by side on a wide screen, and one above the other on a phone", async ({
        page,
      }) => {
        await page.goto(PAGE);
        const form = (await page.locator("[data-form]").boundingBox())!;
        const preview = (await page.locator("[data-preview]").boundingBox())!;
        if (size.width >= 1024) {
          expect(preview.x).toBeGreaterThanOrEqual(form.x + form.width);
        } else {
          expect(preview.y).toBeGreaterThanOrEqual(form.y + form.height);
          expect(Math.abs(preview.x - form.x)).toBeLessThanOrEqual(1);
        }
      });

      test("a long line scrolls inside the snippet and the page stays still", async ({ page }) => {
        await page.goto(PAGE);
        await page.getByLabel("Lede").fill("w".repeat(200));
        const { scrolls, tab } = await block(page).evaluate((node) => ({
          scrolls: node.scrollWidth > node.clientWidth,
          tab: node.getAttribute("tabindex"),
        }));
        expect(scrolls).toBe(true);
        expect(tab).toBe("0");
        expect(await overflow(page)).toBeLessThanOrEqual(0);
      });
    });
  }

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 320, height: 640 } });

    test("every field and the button are at least 44 px tall", async ({ page }) => {
      await page.goto(PAGE);
      for (const locator of [
        page.getByLabel("Title"),
        page.getByLabel("Lede"),
        page.getByLabel("Badge (optional)"),
        page.getByLabel("Button text"),
        page.getByLabel("Button goes to"),
        page.getByLabel("Add a second button"),
        page.getByRole("button", { name: "Copy the snippet" }),
      ]) {
        const target = locator.locator(
          "xpath=self::*[not(@type='checkbox')] | self::*[@type='checkbox']/..",
        );
        expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
    });
  });

  test.describe("the generated output", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("is the expected text before anything is typed", async ({ page }) => {
      await page.goto(PAGE);
      expect(await snippet(page).textContent()).toBe(DEFAULT_SNIPPET);
    });

    test("is the expected text for a full set of choices", async ({ page }) => {
      await page.goto(PAGE);
      await page.getByLabel("Title").fill("Docs for Acme");
      await page.getByLabel("Lede").fill("Everything about Acme, in one place.");
      await page.getByLabel("Badge (optional)").fill("Version 2");
      await page.getByLabel("Button text").fill("Read the guide");
      await page.getByLabel("Button goes to").selectOption({ label: "Examples" });
      await page.getByLabel("Add a second button").check();
      expect(await snippet(page).textContent()).toBe(FULL_SNIPPET);
    });

    test("goes back to the short form when the options are turned off again", async ({ page }) => {
      await page.goto(PAGE);
      await page.getByLabel("Badge (optional)").fill("Version 2");
      await page.getByLabel("Add a second button").check();
      await page.getByLabel("Badge (optional)").fill("  ");
      await page.getByLabel("Add a second button").uncheck();
      expect(await snippet(page).textContent()).toBe(DEFAULT_SNIPPET);
    });

    test("escapes what is typed, so the text is always JSON that holds exactly the input", async ({
      page,
    }) => {
      await page.goto(PAGE);
      const title = 'Say "hello" \\ and <b>more</b>';
      await page.getByLabel("Title").fill(title);
      const parsed = JSON.parse((await snippet(page).textContent())!);
      expect(parsed.hero.title).toBe(title);
    });

    test("says what the config would refuse, and the page still gives a snippet", async ({
      page,
    }) => {
      await page.goto(PAGE);
      await expect(page.locator("[data-problems]")).toHaveText("");
      await page.getByLabel("Title").fill("");
      await expect(page.locator("[data-problems]")).toHaveText("The title is empty.");
      await page.getByLabel("Button text").fill("");
      await expect(page.locator("[data-problems]")).toHaveText(
        "The title is empty. The button text is empty.",
      );
    });

    test("the preview follows the form, and shows the badge and the second button only when asked", async ({
      page,
    }) => {
      await page.goto(PAGE);
      const preview = page.locator("[data-preview]");
      await expect(page.locator("[data-preview-badge]")).toBeHidden();
      await expect(page.locator("[data-preview-secondary]")).toBeHidden();
      await page.getByLabel("Title").fill("A new title");
      await page.getByLabel("Badge (optional)").fill("Beta");
      await page.getByLabel("Add a second button").check();
      await expect(preview.locator("[data-preview-title]")).toHaveText("A new title");
      await expect(preview.locator("[data-preview-badge]")).toHaveText("Beta");
      await expect(preview.locator("[data-preview-secondary]")).toBeVisible();
    });

    test("the preview shows text, never HTML", async ({ page }) => {
      await page.goto(PAGE);
      await page.getByLabel("Title").fill("<img src=x onerror=alert(1)>");
      await expect(page.locator("[data-preview-title]")).toHaveText("<img src=x onerror=alert(1)>");
      await expect(page.locator("[data-preview] img")).toHaveCount(0);
    });

    test("the copy button puts the snippet on the clipboard", async ({ page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: SITE });
      await page.goto(PAGE);
      await page.getByLabel("Title").fill("Copied title");
      const expected = await snippet(page).textContent();
      await page.getByRole("button", { name: "Copy the snippet" }).click();
      await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
    });
  });

  test("shows the preview and the default snippet without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: SITE, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(PAGE);
    expect(await snippet(page).textContent()).toBe(DEFAULT_SNIPPET);
    await expect(page.locator("[data-preview-title]")).toHaveText(
      "Documentation that looks like a product",
    );
    await context.close();
  });

  test("is a page of the site: its header, its footer, its title and its skip link", async ({
    page,
  }) => {
    await page.goto(PAGE);
    await expect(page).toHaveTitle("Hero configurator · recipes");
    await expect(page.locator("header").getByRole("link", { name: "Docs" })).toBeVisible();
    await expect(page.locator("footer")).toContainText("MIT licensed");
    await expect(page.locator("main#main")).toContainText("Hero configurator");
  });

  test("fetches nothing: every request goes to the site, and nothing is logged as an error", async ({
    page,
  }) => {
    const requests: string[] = [];
    const errors: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(PAGE);
    await page.getByLabel("Title").fill("Typing causes no request");
    await page.getByLabel("Add a second button").check();
    await page.waitForLoadState("networkidle");
    expect(requests.filter((url) => !url.startsWith(`${SITE}/`))).toEqual([]);
    expect(errors).toEqual([]);
  });

  for (const value of ["dark", "light"] as const) {
    test(`uses the tokens of the site, so it follows the ${value} theme and keeps AA contrast`, async ({
      page,
    }) => {
      await theme(page, value);
      await page.setViewportSize({ width: 375, height: 800 });
      await page.goto(PAGE);
      await settle(page);
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(value);
      const colors = await page.evaluate(() => {
        const input = getComputedStyle(document.querySelector("#title")!);
        const code = getComputedStyle(document.querySelector("[data-snippet]")!.parentElement!);
        return { field: input.backgroundColor, block: code.backgroundColor, text: input.color };
      });
      expect(colors.field).toBe(await token(page, "--sk-surface"));
      expect(colors.block).toBe(await token(page, "--sk-surface"));
      expect(colors.text).toBe(await token(page, "--sk-fg-bright"));
      await page.getByLabel("Title").fill("");
      await page.getByLabel("Add a second button").check();
      await page.getByLabel("Badge (optional)").fill("Beta");
      const { offenders, checked } = await measureContrast(page);
      expect(checked).toBeGreaterThan(15);
      expect(offenders).toEqual([]);
    });
  }
});

test.describe("recipe collection: a collection with its own order and groups", () => {
  test("is in the header after the collections that were there, before the changelog", async ({
    page,
  }) => {
    await page.goto(BASE);
    const links = await page.locator("header nav a").allTextContents();
    expect(links.map((text) => text.trim()).filter((text) => text)).toEqual([
      "Docs",
      "Examples",
      "Notes",
      "Changelog",
    ]);
  });

  test("the index has one section for each group, in the order of the config, and the pages in the order of items", async ({
    page,
  }) => {
    await page.goto(`${BASE}notes/`);
    await expect(page.getByRole("heading", { level: 1, name: "Notes" })).toBeVisible();
    await expect(
      page.getByText("Short notes the team keeps next to the code.").first(),
    ).toBeVisible();
    const order = await page
      .locator("main h2, main a[href^='/recipes/notes/']")
      .evaluateAll((nodes) =>
        nodes.map((node) =>
          node.tagName === "H2" ? `# ${node.textContent!.trim()}` : node.getAttribute("href")!,
        ),
      );
    const groups = order.filter((entry) => entry.startsWith("# "));
    expect(groups).toEqual(["# Start", "# Process"]);
    const pages = order.filter((entry) => !entry.startsWith("# "));
    expect([...new Set(pages)]).toEqual([
      "/recipes/notes/welcome/",
      "/recipes/notes/glossary/",
      "/recipes/notes/release-process/",
    ]);
  });

  test("the sidebar of a page names the groups and lists the pages in the same order", async ({
    page,
  }) => {
    await page.goto(`${BASE}notes/glossary/`);
    const sidebar = page.getByRole("navigation", { name: "Notes" });
    const lines = await sidebar.locator("p, a").allTextContents();
    expect(lines.map((line) => line.trim())).toEqual([
      "Notes",
      "Start",
      "Welcome",
      "Glossary",
      "Process",
      "Release process",
    ]);
    await expect(sidebar.getByRole("link", { name: "Glossary" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("a link between two notes goes to the page", async ({ page }) => {
    await page.goto(`${BASE}notes/welcome/`);
    await page.getByRole("link", { name: "glossary", exact: true }).click();
    await expect(page).toHaveURL(`${SITE}${BASE}notes/glossary/`);
  });

  test("does not scroll sideways on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const route of [`${BASE}notes/`, `${BASE}notes/welcome/`]) {
      await page.goto(route);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("recipe component: a component you changed, kept by add and by upgrade", () => {
  for (const value of ["dark", "light"] as const) {
    test(`the stat values use the accent in the ${value} theme, and keep AA contrast`, async ({
      page,
    }) => {
      await theme(page, value);
      await page.goto(BASE);
      await settle(page);
      const values = page.locator("dl dd.font-mono");
      await expect(values).toHaveText(["1.0", "22+", "MIT"]);
      const accent = await token(page, "--sk-accent");
      for (const color of await values.evaluateAll((nodes) =>
        nodes.map((node) => getComputedStyle(node).color),
      )) {
        expect(color).toBe(accent);
      }
      const { offenders } = await measureContrast(page);
      expect(offenders).toEqual([]);
    });
  }

  test("the labels and the notes keep the look the kit gave them", async ({ page }) => {
    await page.goto(BASE);
    const first = page.locator("dl > div").first();
    await expect(first.locator("dt")).toHaveText("Version");
    await expect(first.locator("dd").last()).toHaveText("The latest release");
    expect(
      await first
        .locator("dd")
        .last()
        .evaluate((node) => getComputedStyle(node).color),
    ).toBe(await token(page, "--sk-fg-muted"));
  });
});

test.describe("recipe tokens: a new accent", () => {
  const ACCENT = { dark: "rgb(45, 212, 191)", light: "rgb(11, 95, 89)" };
  for (const value of ["dark", "light"] as const) {
    test(`the accent is the new one in the ${value} theme, on the page and in the pages' colors`, async ({
      page,
    }) => {
      await theme(page, value);
      await page.goto(BASE);
      await settle(page);
      expect(await token(page, "--sk-accent")).toBe(ACCENT[value]);
      // The stat values draw the accent as text (see the recipe component).
      const color = await page
        .locator("dl dd.font-mono")
        .first()
        .evaluate((node) => getComputedStyle(node).color);
      expect(color).toBe(ACCENT[value]);
    });

    for (const route of [
      "",
      "docs/",
      "docs/getting-started/",
      "notes/",
      "configurator/",
      "changelog/",
    ]) {
      test(`${route || "the home page"} reaches AA in the ${value} theme with it`, async ({
        page,
      }) => {
        await theme(page, value);
        await page.goto(`${BASE}${route}`);
        await settle(page);
        const { offenders, checked } = await measureContrast(page);
        expect(checked).toBeGreaterThan(10);
        expect(offenders).toEqual([]);
      });
    }
  }
});

test.describe("recipe brand-and-layout: a logo and a layout of your own", () => {
  test("the logo of the site's brands folder is drawn inline, in the color of the text", async ({
    page,
  }) => {
    await page.goto(BASE);
    const path = page.locator('svg path[d="M12 2l9 5v10l-9 5-9-5V7z"]');
    await expect(path).toHaveCount(1);
    const logo = await path.evaluate((node) => {
      const svg = node.closest("svg")!;
      return {
        ariaHidden: svg.getAttribute("aria-hidden"),
        fillAttribute: svg.getAttribute("fill"),
        fill: getComputedStyle(svg).fill,
        color: getComputedStyle(svg.parentElement!).color,
        viewBox: svg.getAttribute("viewBox"),
        images: svg.parentElement!.querySelectorAll("img, image, use").length,
      };
    });
    expect(logo).toMatchObject({
      ariaHidden: "true",
      fillAttribute: "currentColor",
      viewBox: "0 0 24 24",
      images: 0,
    });
    expect(logo.fill).toBe(logo.color);
    await expect(page.getByText("A logo that ships with the site")).toBeVisible();
  });

  test("the pages of the collection that has a layout show its note, and the pages of the others do not", async ({
    page,
  }) => {
    await page.goto(`${BASE}examples/basic/`);
    await expect(page.locator("[data-example-note]")).toHaveText(
      "This is an example. Copy the folder examples/ from the repository and adapt it.",
    );
    // It is still the page of the kit: the title, the breadcrumbs and the previous and next links are there.
    await expect(page.getByRole("heading", { level: 1, name: "Basic example" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
    for (const route of ["docs/getting-started/", "notes/welcome/"]) {
      await page.goto(`${BASE}${route}`);
      await expect(page.locator("[data-example-note]")).toHaveCount(0);
    }
  });

  for (const value of ["dark", "light"] as const) {
    test(`the note does not scroll sideways on a phone and reaches AA in the ${value} theme`, async ({
      page,
    }) => {
      await theme(page, value);
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(`${BASE}examples/basic/`);
      await settle(page);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      expect((await measureContrast(page)).offenders).toEqual([]);
    });
  }
});
