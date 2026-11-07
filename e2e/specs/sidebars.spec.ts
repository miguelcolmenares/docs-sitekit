import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

// The docs page of the generated site has a docs menu and "On this page". The detail page has a card, and from `xl`
// the docs menu beside it.
const BASE = "/widget/";
const PAGE = `${BASE}docs/guide/`;
const DETAIL = `${BASE}examples/detail-card/`;

const menuButton = (page: Page) => page.locator('[data-sidebar-toggle="menu"]');
const tocButton = (page: Page) => page.locator('[data-sidebar-toggle="toc"]');
const menu = (page: Page) => page.locator("#docs-menu");
const toc = (page: Page) => page.locator("#docs-toc");
const proseWidth = (page: Page) =>
  page.locator("[data-prose]").evaluate((node) => node.getBoundingClientRect().width);
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** The width of 80 characters of the text, measured in the page, and the width of the text column. */
const measure = (page: Page) =>
  page.evaluate(() => {
    const article = document.querySelector("[data-prose]")!.closest("article")!;
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;width:80ch";
    article.append(probe);
    const limit = probe.getBoundingClientRect().width;
    probe.remove();
    return { limit, column: article.getBoundingClientRect().width };
  });
const links = (locator: Locator) => locator.locator("a");

test.describe("the sidebars on a desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("each sidebar has a button with a name that says what it does, and aria-expanded", async ({
    page,
  }) => {
    await page.goto(PAGE);
    await expect(menuButton(page)).toBeVisible();
    await expect(menuButton(page)).toHaveAccessibleName("Hide the docs menu");
    await expect(menuButton(page)).toHaveAttribute("aria-expanded", "true");
    await expect(menuButton(page)).toHaveAttribute("aria-controls", "docs-menu");
    await expect(tocButton(page)).toBeVisible();
    await expect(tocButton(page)).toHaveAccessibleName("Hide the table of contents");
    await expect(tocButton(page)).toHaveAttribute("aria-expanded", "true");
  });

  test("hiding the docs menu takes it out of the page and the tab order, and the text takes its room", async ({
    page,
  }) => {
    await page.goto(PAGE);
    const before = await proseWidth(page);
    await menuButton(page).click();
    await expect(menu(page)).toBeHidden();
    await expect(menuButton(page)).toHaveAccessibleName("Show the docs menu");
    await expect(menuButton(page)).toHaveAttribute("aria-expanded", "false");
    for (const link of await links(menu(page)).all()) await expect(link).toBeHidden();
    await expect(menuButton(page)).toBeVisible();
    // The column moves over 200 ms, so the width is read until it has settled.
    await expect.poll(() => proseWidth(page)).toBeGreaterThan(before);
    await menuButton(page).click();
    await expect(menu(page)).toBeVisible();
    await expect(menuButton(page)).toHaveAccessibleName("Hide the docs menu");
    await expect.poll(async () => Math.round(await proseWidth(page))).toBe(Math.round(before));
  });

  test("hiding the table of contents does the same for the right side", async ({ page }) => {
    await page.goto(PAGE);
    await tocButton(page).click();
    await expect(toc(page)).toBeHidden();
    for (const link of await links(toc(page)).all()) await expect(link).toBeHidden();
    await expect(tocButton(page)).toHaveAccessibleName("Show the table of contents");
    await tocButton(page).click();
    await expect(toc(page)).toBeVisible();
  });

  test("the keyboard works: Enter hides the sidebar and the button keeps the focus", async ({
    page,
  }) => {
    await page.goto(PAGE);
    await menuButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(menu(page)).toBeHidden();
    await expect(menuButton(page)).toBeFocused();
    await page.keyboard.press("Space");
    await expect(menu(page)).toBeVisible();
    await expect(menuButton(page)).toBeFocused();
  });

  test("the choice is kept after a reload and on another page, for each sidebar", async ({
    page,
  }) => {
    await page.goto(PAGE);
    await menuButton(page).click();
    await tocButton(page).click();
    await page.reload();
    await expect(menu(page)).toBeHidden();
    await expect(toc(page)).toBeHidden();
    await expect(menuButton(page)).toHaveAccessibleName("Show the docs menu");
    await expect(tocButton(page)).toHaveAccessibleName("Show the table of contents");
    await page.goto(`${BASE}docs/getting-started/`);
    await expect(menu(page)).toBeHidden();
    await expect(toc(page)).toBeHidden();
  });

  test("hidden on both sides, the text is still at most 80 characters wide", async ({ page }) => {
    await page.goto(PAGE);
    await menuButton(page).click();
    await tocButton(page).click();
    const { limit, column } = await measure(page);
    expect(column).toBeLessThanOrEqual(limit + 1);
    expect(await proseWidth(page)).toBeGreaterThan(0);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test("with storage blocked the page works, shows both sidebars, and the choice holds for that page", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const blocked = () => {
        throw new Error("blocked");
      };
      Storage.prototype.getItem = blocked;
      Storage.prototype.setItem = blocked;
      Storage.prototype.removeItem = blocked;
    });
    await page.goto(PAGE);
    await expect(menu(page)).toBeVisible();
    await menuButton(page).click();
    await expect(menu(page)).toBeHidden();
    await page.reload();
    await expect(menu(page)).toBeVisible();
  });

  test("the detail page has a control for the docs menu, and none for a table of contents", async ({
    page,
  }) => {
    await page.goto(DETAIL);
    await expect(menuButton(page)).toBeVisible();
    await expect(tocButton(page)).toHaveCount(0);
    await menuButton(page).click();
    await expect(menu(page)).toBeHidden();
    await expect(page.getByRole("complementary", { name: "Details" })).toBeVisible();
  });

  for (const theme of ["dark", "light"]) {
    for (const hidden of [false, true]) {
      test(`axe finds nothing with the sidebars ${hidden ? "hidden" : "shown"}, in the ${theme} theme`, async ({
        page,
      }) => {
        await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
        await page.goto(PAGE);
        if (hidden) {
          await menuButton(page).click();
          await tocButton(page).click();
        }
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
          .analyze();
        expect(results.violations.map((violation) => violation.id)).toEqual([]);
      });
    }
  }
});

test.describe("the sidebars without JavaScript", () => {
  test("both sidebars are shown and no button is, as on today's layout", async ({ browser }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(PAGE);
    await expect(menu(page)).toBeVisible();
    await expect(toc(page)).toBeVisible();
    await expect(menuButton(page)).toBeHidden();
    await expect(tocButton(page)).toBeHidden();
    await context.close();
  });
});

test.describe("the sidebars on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("no button is shown, and the page does not scroll sideways", async ({ page }) => {
    await page.goto(PAGE);
    await expect(menuButton(page)).toBeHidden();
    await expect(tocButton(page)).toBeHidden();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe("the docs menu on a detail page between lg and xl", () => {
  test.use({ viewport: { width: 1024, height: 800 } });

  test("it is not shown there, so its button is not either", async ({ page }) => {
    await page.goto(DETAIL);
    await expect(menuButton(page)).toBeHidden();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});
