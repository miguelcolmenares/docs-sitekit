import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page, Request } from "@playwright/test";
import { measureContrast } from "../support/contrast";

const BASE = "/widget/";
const GUIDE_ADVANCED = `${BASE}docs/guide/#advanced`;
const PHONES = [
  { name: "320 wide (reflow limit)", width: 320, height: 640 },
  { name: "360 wide (common Android)", width: 360, height: 740 },
  { name: "390 wide (iPhone)", width: 390, height: 844 },
];

const dialog = (page: Page) => page.locator("[data-search-dialog][open]");
const input = (page: Page) => page.getByRole("combobox", { name: "Search the docs" });
const trigger = (page: Page) => page.getByRole("button", { name: "Search", exact: true });

/** Open search from the header button, which is the way a reader who does not know the shortcut opens it. */
async function openSearch(page: Page) {
  await trigger(page).click();
  await expect(dialog(page)).toBeVisible();
  await expect(input(page)).toBeFocused();
}

/** Every request that is for the search code or the index, so the test can count them. */
function searchRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request: Request) => {
    if (/search-index\.json|searchDialog/.test(request.url())) seen.push(request.url());
  });
  return seen;
}

test.describe("shortcuts", () => {
  test("Control or Command with K opens the dialog with the focus in the input", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/getting-started/`);
    await page.keyboard.press("ControlOrMeta+k");
    await expect(dialog(page)).toBeVisible();
    await expect(input(page)).toBeFocused();
  });

  test("the slash opens the dialog, but a slash typed into the input is only text", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/getting-started/`);
    await page.keyboard.press("/");
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.type("npm/install");
    await expect(input(page)).toHaveValue("npm/install");
  });

  test("the slash is ignored in another field", async ({ page }) => {
    await page.goto(`${BASE}docs/getting-started/`);
    await page.evaluate(() => {
      const field = document.createElement("input");
      field.id = "other-field";
      document.body.append(field);
      field.focus();
    });
    await page.keyboard.press("/");
    await expect(page.locator("[data-search-dialog][open]")).toHaveCount(0);
  });

  test("the header shows the shortcut for the platform, and the button is named Search", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/getting-started/`);
    await expect(trigger(page)).toBeVisible();
    await expect(page.locator("[data-search-key]")).toHaveText(/^(⌘K|Ctrl K)$/);
  });
});

test.describe("searching", () => {
  test("typing returns the page that has the words", async ({ page }) => {
    await page.goto(`${BASE}docs/`);
    await openSearch(page);
    await page.keyboard.type("npm install");
    await expect(page.getByRole("option", { name: /Getting started/ }).first()).toBeVisible();
    await expect(page.locator("[data-search-status]")).toHaveText(/result/);
  });

  test("the results are grouped by collection, with the first one selected", async ({ page }) => {
    await page.goto(`${BASE}docs/`);
    await openSearch(page);
    await page.keyboard.type("use");
    const groups = await page
      .locator('[role="group"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-labelledby")));
    expect(groups.length).toBeGreaterThan(0);
    const first = page.locator("[role=option]").first();
    await expect(first).toHaveAttribute("aria-selected", "true");
    await expect(input(page)).toHaveAttribute(
      "aria-activedescendant",
      (await first.getAttribute("id")) ?? "",
    );
  });

  test("Enter opens the section that matched", async ({ page }) => {
    await page.goto(`${BASE}docs/`);
    await openSearch(page);
    await page.keyboard.type("Advanced use");
    await expect(page.getByRole("option").first()).toContainText("Advanced");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(GUIDE_ADVANCED);
    await expect(page.getByRole("heading", { name: "Advanced", level: 2 })).toBeInViewport();
  });

  test("the arrows, Home and End move through the results", async ({ page }) => {
    await page.goto(`${BASE}docs/`);
    await openSearch(page);
    await page.keyboard.type("widget");
    const options = page.locator("[role=option]");
    const count = await options.count();
    expect(count).toBeGreaterThan(1);
    const active = () => input(page).getAttribute("aria-activedescendant");
    await page.keyboard.press("ArrowDown");
    expect(await active()).toBe(await options.nth(1).getAttribute("id"));
    await page.keyboard.press("End");
    expect(await active()).toBe(await options.nth(count - 1).getAttribute("id"));
    await page.keyboard.press("Home");
    expect(await active()).toBe(await options.nth(0).getAttribute("id"));
  });

  test("an empty query asks for words, and a query with no result repeats the text", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/`);
    await openSearch(page);
    await expect(page.locator("[data-search-status]")).toHaveText("Type to search the docs.");
    await page.keyboard.type("zzqxv");
    await expect(page.locator("[data-search-status]")).toHaveText('No results for "zzqxv".');
    await expect(page.locator("[role=option]")).toHaveCount(0);
  });

  test("the matches are marked, by a mark element", async ({ page }) => {
    await page.goto(`${BASE}docs/`);
    await openSearch(page);
    await page.keyboard.type("widget");
    await expect(page.locator("[role=option] mark").first()).toHaveText(/widget/i);
  });
});

test.describe("closing", () => {
  test("Escape closes the dialog and returns the focus to the button that opened it", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/getting-started/`);
    await openSearch(page);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
  });

  test("a click on the close button closes it", async ({ page }) => {
    await page.goto(`${BASE}docs/getting-started/`);
    await openSearch(page);
    await page.getByRole("button", { name: "Close search" }).click();
    await expect(dialog(page)).toHaveCount(0);
  });
});

for (const phone of PHONES) {
  test.describe(`${phone.name}`, () => {
    test.use({ viewport: { width: phone.width, height: phone.height }, hasTouch: true });

    test("the search button is a 44 px touch target and shows no text", async ({ page }) => {
      await page.goto(`${BASE}docs/getting-started/`);
      const box = await trigger(page).boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      await expect(trigger(page).locator("span")).toBeHidden();
    });

    test("the dialog fills the screen, and the page does not scroll sideways behind it", async ({
      page,
    }) => {
      await page.goto(`${BASE}docs/getting-started/`);
      await trigger(page).tap();
      await expect(dialog(page)).toBeVisible();
      const box = await dialog(page).boundingBox();
      expect(box!.width).toBeCloseTo(phone.width, 0);
      expect(box!.height).toBeCloseTo(phone.height, 0);
      await page.keyboard.type("install");
      await expect(page.locator("[data-search-status]")).toHaveText(/result/);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test("each result row is at least 44 px high", async ({ page }) => {
      await page.goto(`${BASE}docs/getting-started/`);
      await trigger(page).tap();
      await expect(dialog(page)).toBeVisible();
      await page.keyboard.type("widget");
      await expect(page.locator("[data-search-status]")).toHaveText(/result/);
      const heights = await page
        .locator("[role=option]")
        .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
      expect(heights.length).toBeGreaterThan(0);
      for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
    });
  });
}

test.describe("loading", () => {
  test("a page load without search downloads no search code and no index", async ({ page }) => {
    const seen = searchRequests(page);
    await page.goto(`${BASE}docs/getting-started/`, { waitUntil: "networkidle" });
    expect(seen).toEqual([]);
  });

  test("the first open downloads the code and the index, once", async ({ page }) => {
    const seen = searchRequests(page);
    await page.goto(`${BASE}docs/getting-started/`, { waitUntil: "networkidle" });
    await openSearch(page);
    await page.keyboard.type("widget");
    await expect(page.locator("[data-search-status]")).toHaveText(/result/);
    await page.keyboard.press("Escape");
    await openSearch(page);
    await page.keyboard.type("install");
    await expect(page.locator("[data-search-status]")).toHaveText(/result/);
    expect(seen.filter((url) => url.endsWith("search-index.json"))).toHaveLength(1);
    expect(seen.filter((url) => url.includes("searchDialog"))).toHaveLength(1);
  });

  test("the first focus of the button loads the code, and the index waits for the open", async ({
    page,
  }) => {
    const seen = searchRequests(page);
    await page.goto(`${BASE}docs/getting-started/`, { waitUntil: "networkidle" });
    await trigger(page).focus();
    await expect.poll(() => seen.some((url) => url.includes("searchDialog"))).toBe(true);
    expect(seen.some((url) => url.endsWith("search-index.json"))).toBe(false);
    await trigger(page).click();
    await expect.poll(() => seen.some((url) => url.endsWith("search-index.json"))).toBe(true);
  });

  test("no request for search leaves the site", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).hostname !== "127.0.0.1") external.push(request.url());
    });
    await page.goto(`${BASE}docs/getting-started/`);
    await openSearch(page);
    await page.keyboard.type("widget");
    await expect(page.locator("[data-search-status]")).toHaveText(/result/);
    expect(external).toEqual([]);
  });
});

test.describe("accessibility", () => {
  test("the open dialog has no serious or critical axe violations", async ({ page }) => {
    await page.goto(`${BASE}docs/getting-started/`);
    await openSearch(page);
    await page.keyboard.type("widget");
    await expect(page.locator("[data-search-status]")).toHaveText(/result/);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(
      serious.map(
        (violation) =>
          `${violation.id}: ${violation.nodes.length} node(s), e.g. ${violation.nodes[0]?.target.join(" ")}`,
      ),
    ).toEqual([]);
  });

  for (const theme of ["dark", "light"] as const) {
    test(`the marks, the selected result and the key hint reach AA contrast in the ${theme} theme`, async ({
      page,
    }) => {
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await page.goto(`${BASE}docs/getting-started/`);
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
      await openSearch(page);
      await page.keyboard.type("widget");
      await expect(page.locator("[role=option] mark").first()).toBeVisible();
      await expect(dialog(page)).toContainText("Esc");
      const { offenders, checked } = await measureContrast(page);
      expect(checked).toBeGreaterThan(5);
      expect(offenders).toEqual([]);
    });
  }

  test("the input is a combobox that names the list it controls", async ({ page }) => {
    await page.goto(`${BASE}docs/getting-started/`);
    await openSearch(page);
    await expect(input(page)).toHaveAttribute("aria-controls", "search-results");
    await expect(input(page)).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.type("widget");
    await expect(input(page)).toHaveAttribute("aria-expanded", "true");
  });
});
