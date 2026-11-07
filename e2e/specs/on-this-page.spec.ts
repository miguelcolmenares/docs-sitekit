import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { measureContrast } from "../support/contrast";

// The kit's own site is built by verify-package on the port after the one of the widget site. Its page on the
// options of navigation has several sections, so "On this page" has more than one link to move between.
const OWN = `http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4401) + 1}/docs-sitekit/`;
const PAGE = `${OWN}docs/options-navigation/`;
const SECTION = "The sidebars of a docs page";
const SECTION_ID = "the-sidebars-of-a-docs-page";

const toc = (page: Page) => page.getByRole("navigation", { name: "On this page" });
const current = (page: Page) => toc(page).locator('a[aria-current="location"]');
const currentText = async (page: Page) =>
  (await current(page).count()) === 0 ? null : current(page).textContent();

/** The heading that is current at this scroll position, by the rule of the page, read from the page itself. */
const expectedText = (page: Page) =>
  page.evaluate(() => {
    const line = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) + 1;
    const headings = [...document.querySelectorAll<HTMLElement>("h2[id], h3[id]")].filter(
      (heading) => document.querySelector(`[aria-label="On this page"] a[href="#${heading.id}"]`),
    );
    const bottom = document.documentElement.scrollHeight - innerHeight - scrollY <= 2;
    if (bottom) return headings.at(-1)?.textContent?.trim() ?? null;
    let found: string | null = null;
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= line) found = heading.textContent?.trim() ?? null;
    }
    return found;
  });

test.describe("On this page on a desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("marks one link, the section on screen, and moves it while the reader scrolls", async ({
    page,
  }) => {
    await page.goto(PAGE);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(1500);
    for (const top of [0, 700, 1400, 2100, 99999]) {
      await page.evaluate((y) => window.scrollTo(0, y), top);
      await expect.poll(() => currentText(page)).toBe(await expectedText(page));
      expect(await current(page).count()).toBeLessThanOrEqual(1);
    }
  });

  test("a click marks its link at once, and the page goes to the section", async ({ page }) => {
    await page.goto(PAGE);
    const link = toc(page).getByRole("link", { name: SECTION });
    await link.click();
    await expect(link).toHaveAttribute("aria-current", "location");
    await expect
      .poll(() =>
        page.evaluate(
          (id) => Math.round(document.getElementById(id)!.getBoundingClientRect().top),
          SECTION_ID,
        ),
      )
      .toBeLessThanOrEqual(90);
    await expect(current(page)).toHaveCount(1);
  });

  test("a hash in the address marks the right link on the first view", async ({ page }) => {
    await page.goto(`${PAGE}#${SECTION_ID}`);
    await expect(toc(page).getByRole("link", { name: SECTION })).toHaveAttribute(
      "aria-current",
      "location",
    );
    await expect(current(page)).toHaveCount(1);
  });

  test("the current link has a line on its left as well as its color", async ({ page }) => {
    await page.goto(PAGE);
    await toc(page).getByRole("link", { name: SECTION }).click();
    const active = toc(page).getByRole("link", { name: SECTION });
    await expect(active).toHaveAttribute("aria-current", "location");
    expect(await active.evaluate((node) => getComputedStyle(node).borderLeftWidth)).toBe("2px");
    expect(await active.evaluate((node) => getComputedStyle(node).borderLeftColor)).not.toMatch(
      /rgba\(0, 0, 0, 0\)|transparent/,
    );
    const other = toc(page).getByRole("link").first();
    await expect(other).not.toHaveAttribute("aria-current", "location");
    expect(await other.evaluate((node) => getComputedStyle(node).borderLeftColor)).toMatch(
      /rgba\(0, 0, 0, 0\)|transparent/,
    );
  });

  test("the last section is current at the end of the page, even when it cannot reach the line", async ({
    page,
  }) => {
    await page.goto(PAGE);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = await toc(page).getByRole("link").last().textContent();
    await expect.poll(() => currentText(page)).toBe(last);
  });

  test("the list keeps the current link in view when it is taller than the screen", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 330 } });
    const page = await context.newPage();
    await page.goto(PAGE);
    const list = toc(page);
    expect(await list.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(current(page)).toHaveCount(1);
    // The list is scrolled inside its own box, and the current link is in that box. A pixel of rounding is allowed.
    await expect
      .poll(async () => {
        const box = await list.evaluate((node) => node.getBoundingClientRect().toJSON());
        const link = await current(page).evaluate((node) => node.getBoundingClientRect().toJSON());
        return link.top >= box.top - 1 && link.bottom <= box.bottom + 1;
      })
      .toBe(true);
    expect(await list.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    await context.close();
  });

  for (const theme of ["dark", "light"]) {
    test(`the current link keeps AA contrast, and axe finds nothing, in the ${theme} theme`, async ({
      page,
    }) => {
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await page.goto(`${PAGE}#${SECTION_ID}`);
      await expect(current(page)).toHaveCount(1);
      const { offenders, checked } = await measureContrast(page);
      expect(checked).toBeGreaterThan(10);
      expect(offenders).toEqual([]);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
        .analyze();
      expect(results.violations.map((violation) => violation.id)).toEqual([]);
    });
  }
});

test.describe("On this page with the motion reduced", () => {
  test.use({ reducedMotion: "reduce", viewport: { width: 1440, height: 330 } });

  test("the list moves to the current link without a smooth scroll", async ({ page }) => {
    // Every call of scrollTo on an element is recorded with its behavior, so the test reads what the page asked for.
    await page.addInitScript(() => {
      const behaviors: string[] = [];
      Object.defineProperty(window, "listBehaviors", { value: behaviors });
      const scrollTo = Element.prototype.scrollTo;
      Element.prototype.scrollTo = function (this: Element, ...args: unknown[]) {
        const options = args[0];
        if (typeof options === "object" && options !== null && "behavior" in options) {
          behaviors.push(String((options as { behavior: unknown }).behavior));
        }
        return (scrollTo as (...rest: unknown[]) => void).apply(this, args);
      } as typeof scrollTo;
    });
    await page.goto(PAGE);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(current(page)).toHaveCount(1);
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { listBehaviors: string[] }).listBehaviors.length,
        ),
      )
      .toBeGreaterThan(0);
    const behaviors = await page.evaluate(
      () => (window as unknown as { listBehaviors: string[] }).listBehaviors,
    );
    expect(behaviors.every((behavior) => behavior === "auto")).toBe(true);
  });
});
