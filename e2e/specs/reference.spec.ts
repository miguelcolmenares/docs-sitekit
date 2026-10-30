import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { measureContrast } from "../support/contrast";

// verify-package adds a page to the generated site, as an owner would, that shows ReferenceTable with
// five rows. One name is very long on purpose: it must stay on one line inside the scrolling region.
const PAGE = "/widget/reference/";
const ROWS = 5;
const LONG_NAME = "averyveryveryveryveryverylongkeynamethatmustnotwidenthepage";

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const region = (page: Page) => page.getByRole("region", { name: "Keys of the search group" });

test.describe("the reference table", () => {
  test("is a labelled region around a real table with column and row headers", async ({ page }) => {
    await page.goto(PAGE);
    await expect(region(page)).toHaveCount(1);
    await expect(region(page).locator("table caption")).toHaveText("Keys of the search group");
    await expect(region(page).locator('thead th[scope="col"]')).toHaveText([
      "Key",
      "Type",
      "Default",
      "Allowed values",
      "Description",
    ]);
    await expect(region(page).locator('tbody th[scope="row"] code')).toHaveCount(ROWS);
    // A row with no default or no allowed values shows a dash, never an empty cell.
    const empty = await region(page)
      .locator("td")
      .evaluateAll((cells) => cells.filter((cell) => !cell.textContent?.trim()).length);
    expect(empty).toBe(0);
  });

  test("can be focused from the HTML, so it works without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(PAGE);
    await expect(region(page)).toHaveAttribute("tabindex", "0");
    await context.close();
  });

  test("passes the serious and critical rules of axe, scrollable region included", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(PAGE);
    const results = await new AxeBuilder({ page }).include("[role=region]").analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious.map((violation) => violation.id)).toEqual([]);
  });

  for (const width of [320, 360, 390]) {
    test.describe(`${width} wide`, () => {
      test.use({ viewport: { width, height: 800 } });

      test("scrolls inside its own wrapper and never widens the page", async ({ page }) => {
        await page.goto(PAGE);
        const box = await region(page).evaluate((node) => ({
          scrolls: node.scrollWidth > node.clientWidth,
          width: node.getBoundingClientRect().width,
          right: node.getBoundingClientRect().right,
        }));
        expect(box.scrolls).toBe(true); // the table really is wider than the screen
        expect(box.right).toBeLessThanOrEqual(width);
        expect(await overflow(page)).toBeLessThanOrEqual(0);
      });

      test("a keyboard user can reach it with Tab and scroll it with the arrow keys", async ({
        page,
      }) => {
        await page.goto(PAGE);
        const focused = () =>
          page.evaluate(() => document.activeElement?.getAttribute("role") === "region");
        for (let step = 0; step < 40 && !(await focused()); step += 1) {
          await page.keyboard.press("Tab");
        }
        expect(await focused()).toBe(true);
        const ring = await region(page).evaluate((node) => {
          const style = getComputedStyle(node);
          return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
        });
        expect(ring.style).not.toBe("none");
        expect(ring.width).toBeGreaterThanOrEqual(2);
        expect(await region(page).evaluate((node) => node.scrollLeft)).toBe(0);
        await page.keyboard.press("ArrowRight");
        await expect
          .poll(() => region(page).evaluate((node) => node.scrollLeft))
          .toBeGreaterThan(0);
      });

      test("keeps a long name on one line inside the region", async ({ page }) => {
        await page.goto(PAGE);
        const name = region(page).locator("code", { hasText: LONG_NAME });
        const { lines, lineHeight } = await name.evaluate((node) => {
          const style = getComputedStyle(node);
          return {
            lines: node.getClientRects().length,
            lineHeight: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2,
          };
        });
        expect(lines).toBe(1);
        expect((await name.boundingBox())!.height).toBeLessThan(lineHeight * 1.5);
        expect(await overflow(page)).toBeLessThanOrEqual(0);
      });
    });
  }

  test("on a desktop screen the short names fit and the page does not scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PAGE);
    const box = await region(page).evaluate((node) => node.getBoundingClientRect());
    expect(box.right).toBeLessThanOrEqual(1440);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    // The column of names is the widest one: a short name is not cut or wrapped.
    const short = region(page).locator("code", { hasText: "search.enabled" });
    expect(await short.evaluate((node) => node.getClientRects().length)).toBe(1);
  });

  for (const theme of ["dark", "light"] as const) {
    for (const width of [320, 1440]) {
      test(`all of its text reaches WCAG AA in the ${theme} theme at ${width}px`, async ({
        page,
      }) => {
        await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(PAGE);
        expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
        const { offenders, checked } = await measureContrast(page);
        expect(checked).toBeGreaterThan(20);
        expect(offenders).toEqual([]);
      });
    }
  }
});
