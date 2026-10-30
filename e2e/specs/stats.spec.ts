import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const BASE = "/widget/";
// The generated site is configured with four stats, one of them with a value of 48 digits (see verify-package).
const STATS = 4;
const LONG_VALUE = "9".repeat(48);

const VIEWPORTS = [
  { name: "320 wide", width: 320, height: 640, columns: 1 },
  { name: "360 wide", width: 360, height: 740, columns: 1 },
  { name: "390 wide", width: 390, height: 844, columns: 1 },
  { name: "tablet", width: 700, height: 900, columns: 2 },
  { name: "desktop", width: 1440, height: 900, columns: STATS },
];

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Left and top of every stat card, to count the columns the grid really has. */
const cards = (page: Page) =>
  page.locator("dl > div").evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { left: Math.round(box.left), top: Math.round(box.top), right: box.right };
    }),
  );

test.describe("the stat row on the home page", () => {
  test("is a description list: every value is read with its label", async ({ page }) => {
    await page.goto(BASE);
    const list = page.locator("dl");
    await expect(list).toHaveCount(1);
    await expect(list.locator("dt")).toHaveCount(STATS);
    await expect(list.locator("dd").first()).toHaveText("1.2k");
    await expect(list.locator("dt").first()).toHaveText("Downloads");
    // The note is a second description of the same term.
    await expect(list.locator("div").first().locator("dd")).toHaveText(["1.2k", "Last 30 days"]);
    // Nothing but a term and its descriptions is inside a group.
    expect(await list.locator("div > *:not(dt):not(dd)").count()).toBe(0);
  });

  test("the value is the large text, in the mono face", async ({ page }) => {
    await page.goto(BASE);
    const { value, label, family } = await page.evaluate(() => {
      const group = document.querySelector("dl > div")!;
      const dd = getComputedStyle(group.querySelector("dd")!);
      return {
        value: parseFloat(dd.fontSize),
        label: parseFloat(getComputedStyle(group.querySelector("dt")!).fontSize),
        family: dd.fontFamily,
      };
    });
    expect(value).toBeGreaterThanOrEqual(28);
    expect(value).toBeGreaterThan(label * 2);
    expect(family).toMatch(/mono/i);
  });

  test("shows the same text without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(BASE);
    await expect(page.locator("dl dt")).toHaveCount(STATS);
    await context.close();
  });

  for (const viewport of VIEWPORTS) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test(`has ${viewport.columns} column(s), no sideways scroll, and stays inside the page`, async ({
        page,
      }) => {
        await page.goto(BASE);
        expect(await overflow(page)).toBeLessThanOrEqual(0);
        const boxes = await cards(page);
        expect(boxes).toHaveLength(STATS);
        expect(new Set(boxes.map((box) => box.left)).size).toBe(viewport.columns);
        for (const box of boxes) expect(box.right).toBeLessThanOrEqual(viewport.width);
      });

      test("a long value wraps inside its card instead of widening it", async ({ page }) => {
        await page.goto(BASE);
        const long = page.locator("dd", { hasText: LONG_VALUE });
        const { dd, card, lineHeight } = await long.evaluate((node) => {
          const style = getComputedStyle(node);
          return {
            dd: node.getBoundingClientRect(),
            card: node.parentElement!.getBoundingClientRect(),
            lineHeight: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2,
          };
        });
        expect(dd.right).toBeLessThanOrEqual(card.right);
        expect(await long.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
        // 48 digits in a 28px mono face are wider than any card here, so the value takes several lines.
        expect(dd.height).toBeGreaterThan(lineHeight * 1.5);
      });
    });
  }

  test("every label, value and note stays inside its card at 320 px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(BASE);
    const outside = await page.locator("dl > div").evaluateAll((groups) =>
      groups.flatMap((group) => {
        const card = group.getBoundingClientRect();
        return [...group.children]
          .filter((child) => {
            const box = child.getBoundingClientRect();
            return (
              box.left < card.left - 1 || box.right > card.right + 1 || box.bottom > card.bottom + 1
            );
          })
          .map((child) => child.textContent);
      }),
    );
    expect(outside).toEqual([]);
  });

  test("keeps the same text and layout in the light theme", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("theme", "light"));
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(BASE);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
    await expect(page.locator("dl dt")).toHaveCount(STATS);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});
