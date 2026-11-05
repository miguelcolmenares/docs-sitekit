import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { measureContrast } from "../support/contrast";

// The detail page of the generated site is examples/detail-card (see verify-package). Its card has five rows,
// three links (one more is left out on purpose), three tags, a 64 character checksum and a long address.
const BASE = "/widget/";
const PAGE = `${BASE}examples/detail-card/`;
const ROWS = 5;
const VISIBLE_ROWS = 3;
const CHECKSUM = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
const PHONES = [
  { name: "320 wide", width: 320, height: 640 },
  { name: "360 wide", width: 360, height: 740 },
  { name: "390 wide", width: 390, height: 844 },
];

const card = (page: Page) => page.getByRole("complementary", { name: "Details" });
const toggle = (page: Page) => card(page).getByRole("button", { name: "All details" });
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const boxOf = (locator: Locator) =>
  locator.evaluate((node) => node.getBoundingClientRect().toJSON());
/** The terms of the card that a visitor can see now. */
const visibleTerms = (page: Page) =>
  card(page)
    .locator("dt")
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => node.getBoundingClientRect().height > 0)
        .map((node) => node.textContent),
    );

test.describe("the markup of the card", () => {
  test("is a description list: each value is read with its label", async ({ page }) => {
    await page.goto(PAGE);
    const list = card(page).locator("dl");
    await expect(list).toHaveCount(1);
    await expect(list.locator("dt")).toHaveText([
      "Version",
      "License",
      "Runtime",
      "Checksum",
      "Download",
    ]);
    await expect(list.locator("div").first().locator("dd")).toHaveText("1.2.0");
    // Nothing but a term and its description is inside a group.
    expect(await list.locator("div > *:not(dt):not(dd)").count()).toBe(0);
  });

  test("has real links, and leaves out the one to a missing file", async ({ page }) => {
    await page.goto(PAGE);
    const links = card(page).getByRole("list", { name: "Links" }).getByRole("link");
    await expect(links).toHaveText(["Repository", "Guide", "License file"]);
    expect(
      await links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href"))),
    ).toEqual([
      "https://github.com/demo/widget",
      `${BASE}docs/guide/`,
      "https://github.com/demo/widget/blob/HEAD/LICENSE",
    ]);
    expect(await card(page).locator("a[href*='nope']").count()).toBe(0);
  });

  test("lists the tags", async ({ page }) => {
    await page.goto(PAGE);
    const tags = card(page).getByRole("list", { name: "Tags" }).getByRole("listitem");
    await expect(tags).toHaveCount(3);
    await expect(tags.first()).toHaveText("Plugin");
  });

  test("a page without a card has none, and keeps its table of contents", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}docs/guide/`);
    await expect(card(page)).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible();
  });

  test("a page that only has tags has no card either", async ({ page }) => {
    await page.goto(`${BASE}docs/overview/`);
    await expect(card(page)).toHaveCount(0);
  });

  test("shows the whole card, and no button, without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 320, height: 640 },
    });
    const page = await context.newPage();
    await page.goto(PAGE);
    await expect(card(page).locator("dt")).toHaveCount(ROWS);
    expect(await visibleTerms(page)).toHaveLength(ROWS);
    await expect(card(page).getByRole("link")).toHaveCount(3);
    await expect(card(page).locator("[data-side-card-toggle]")).toBeHidden();
    await context.close();
  });
});

test.describe("on a desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the card is beside the text, on the right, and shows everything", async ({ page }) => {
    await page.goto(PAGE);
    const cardBox = await boxOf(card(page));
    const prose = await boxOf(page.locator("[data-prose]"));
    expect(cardBox.left).toBeGreaterThanOrEqual(prose.right);
    // It starts at the height of the title block, not below the text.
    expect(cardBox.top).toBeLessThan(prose.top);
    expect(await visibleTerms(page)).toHaveLength(ROWS);
    await expect(card(page).getByRole("link")).toHaveCount(3);
    await expect(toggle(page)).toBeHidden();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test("the card takes the place of the table of contents", async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByRole("navigation", { name: "On this page" })).toHaveCount(0);
  });

  test("the card stays in view while the text scrolls, and goes back with it", async ({ page }) => {
    await page.goto(PAGE);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(height).toBeGreaterThan(2000);
    const before = await boxOf(card(page));
    await page.evaluate(() => window.scrollTo(0, 1200));
    const during = await boxOf(card(page));
    // top-24 is 96 px: the card sits below the header while the page has moved by 1200 px.
    expect(during.top).toBeGreaterThanOrEqual(60);
    expect(during.top).toBeLessThanOrEqual(120);
    expect(during.bottom).toBeLessThan(900);
    expect(before.top).toBeGreaterThan(during.top - 1200 + 1);
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(Math.round((await boxOf(card(page))).top)).toBe(Math.round(before.top));
  });

  test("the card and the text are side by side at the lg width too", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto(PAGE);
    const cardBox = await boxOf(card(page));
    const prose = await boxOf(page.locator("[data-prose]"));
    expect(cardBox.left).toBeGreaterThanOrEqual(prose.right);
    expect(prose.width).toBeGreaterThan(400);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});

for (const phone of PHONES) {
  test.describe(phone.name, () => {
    test.use({ viewport: { width: phone.width, height: phone.height } });

    test("the card is under the title and above the text, with no sideways scroll", async ({
      page,
    }) => {
      await page.goto(PAGE);
      const title = await boxOf(page.getByRole("heading", { level: 1 }));
      const cardBox = await boxOf(card(page));
      const prose = await boxOf(page.locator("[data-prose]"));
      expect(cardBox.top).toBeGreaterThanOrEqual(title.bottom);
      expect(cardBox.bottom).toBeLessThanOrEqual(prose.top);
      expect(cardBox.left).toBeGreaterThanOrEqual(0);
      expect(cardBox.right).toBeLessThanOrEqual(phone.width);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    });

    test("starts with its first rows, and the button says it is collapsed", async ({ page }) => {
      await page.goto(PAGE);
      expect(await visibleTerms(page)).toEqual(["Version", "License", "Runtime"]);
      expect(await visibleTerms(page)).toHaveLength(VISIBLE_ROWS);
      // A link that is hidden is out of the accessibility tree, so it is found by its tag, not its role.
      await expect(card(page).getByRole("link")).toHaveCount(0);
      await expect(card(page).locator("a")).toHaveCount(3);
      for (const link of await card(page).locator("a").all()) await expect(link).toBeHidden();
      await expect(toggle(page)).toBeVisible();
      await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    });

    test("the button is a 44 px target", async ({ page }) => {
      await page.goto(PAGE);
      const box = await boxOf(toggle(page));
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    });

    test("a click expands the rest and a second click collapses it", async ({ page }) => {
      await page.goto(PAGE);
      await toggle(page).click();
      await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
      expect(await visibleTerms(page)).toHaveLength(ROWS);
      for (const link of await card(page).getByRole("link").all()) await expect(link).toBeVisible();
      await expect(card(page).getByRole("list", { name: "Tags" })).toBeVisible();
      await toggle(page).click();
      await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
      expect(await visibleTerms(page)).toHaveLength(VISIBLE_ROWS);
    });

    test("the keyboard works: Tab reaches the button, Enter expands, Space collapses", async ({
      page,
    }) => {
      await page.goto(PAGE);
      await toggle(page).focus();
      await expect(toggle(page)).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Space");
      await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
      // The next stop in the tab order is the first thing after the card, not a hidden link.
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() =>
        document.activeElement?.closest("[data-side-card]"),
      );
      expect(focused).toBeNull();
    });

    test("expanded, nothing is wider than the card: the checksum and the address wrap", async ({
      page,
    }) => {
      await page.goto(PAGE);
      await toggle(page).click();
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      const checksum = card(page).locator("dd", { hasText: CHECKSUM });
      const { dd, box, lineHeight, fits } = await checksum.evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          dd: node.getBoundingClientRect(),
          box: node.closest("[data-side-card]")!.getBoundingClientRect(),
          lineHeight: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5,
          fits: node.scrollWidth <= node.clientWidth,
        };
      });
      expect(dd.right).toBeLessThanOrEqual(box.right);
      expect(fits).toBe(true);
      // 64 characters in a card this narrow take more than one line.
      expect(dd.height).toBeGreaterThan(lineHeight * 1.5);
      const outside = await card(page).evaluate((root) => {
        const edge = root.getBoundingClientRect();
        return [...root.querySelectorAll("dt, dd, a, li")]
          .filter((node) => {
            const rect = node.getBoundingClientRect();
            return rect.width > 0 && (rect.left < edge.left - 1 || rect.right > edge.right + 1);
          })
          .map((node) => node.textContent);
      });
      expect(outside).toEqual([]);
    });

    test("every link is a 44 px target", async ({ page }) => {
      await page.goto(PAGE);
      await toggle(page).click();
      for (const link of await card(page).getByRole("link").all()) {
        expect((await boxOf(link)).height).toBeGreaterThanOrEqual(44);
      }
    });

    for (const theme of ["dark", "light"]) {
      test(`keeps AA contrast and the layout in the ${theme} theme, collapsed and expanded`, async ({
        page,
      }) => {
        await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
        await page.goto(PAGE);
        expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
        for (const expanded of [false, true]) {
          if (expanded) await toggle(page).click();
          const { offenders, checked } = await measureContrast(page);
          expect(checked).toBeGreaterThan(10);
          expect(offenders).toEqual([]);
          expect(await overflow(page)).toBeLessThanOrEqual(0);
        }
      });
    }
  });
}

test("the card and its links have AA contrast on a desktop, in both themes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const theme of ["dark", "light"]) {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    await page.goto(PAGE);
    const { offenders } = await measureContrast(page);
    expect(offenders).toEqual([]);
  }
});
