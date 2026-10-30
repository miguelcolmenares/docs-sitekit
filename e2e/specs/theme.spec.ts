import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const BASE = "/widget/";
const SWITCH = "[data-theme-switch]";

// The e2e site is built with the default `theme.default`, which is dark. The `system` checks need a site built
// with `"theme": { "default": "system" }`, so they run only when the build says so (SITEKIT_E2E_THEME=system).
const SYSTEM_SITE = process.env.SITEKIT_E2E_THEME === "system";

const themeOf = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const pageBackground = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe("the theme switch", () => {
  test("is a button named for what it will do, and the name changes with the theme", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/`);
    const switcher = page.locator(SWITCH);
    await expect(switcher).toHaveAccessibleName("Switch to light theme");
    await switcher.click();
    await expect(switcher).toHaveAccessibleName("Switch to dark theme");
    expect(await themeOf(page)).toBe("light");
  });

  test("works with the keyboard and shows a focus ring", async ({ page }) => {
    await page.goto(`${BASE}docs/`);
    const switcher = page.locator(SWITCH);
    await switcher.focus();
    await page.keyboard.press("Enter");
    await expect(switcher).toHaveAccessibleName("Switch to dark theme");
    expect(await themeOf(page)).toBe("light");
    await page.keyboard.press("Space");
    expect(await themeOf(page)).toBe("dark");
    const ring = await switcher.evaluate((node) => getComputedStyle(node).outlineStyle);
    expect(ring).not.toBe("none");
  });

  test("is a touch target of at least 44px on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE);
    const box = await page.locator(SWITCH).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("the choice survives a reload and a visit to another page", async ({ page }) => {
    await page.goto(`${BASE}docs/`);
    await page.locator(SWITCH).click();
    expect(await themeOf(page)).toBe("light");
    await page.reload();
    expect(await themeOf(page)).toBe("light");
    await page.goto(`${BASE}docs/guide/`);
    expect(await themeOf(page)).toBe("light");
    expect(await pageBackground(page)).toBe("rgb(255, 255, 255)");
  });

  test("a choice made in a blocked storage still holds on that page", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("storage blocked");
        },
      });
    });
    await page.goto(`${BASE}docs/`);
    await page.locator(SWITCH).click();
    expect(await themeOf(page)).toBe("light");
  });
});

test.describe("no flash of the other theme", () => {
  test("a saved light choice is applied before the page loads, on the first frame", async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem("theme", "light"));
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        (window as unknown as { seen: string | undefined }).seen =
          document.documentElement.dataset.theme;
      });
    });
    await page.goto(`${BASE}docs/`);
    const seen = await page.evaluate(
      () => (window as unknown as { seen: string | undefined }).seen,
    );
    expect(seen).toBe("light");
    expect(await pageBackground(page)).toBe("rgb(255, 255, 255)");
  });
});

test.describe("system default", () => {
  test.skip(
    !SYSTEM_SITE,
    'needs a site built with theme.default "system" (SITEKIT_E2E_THEME=system)',
  );

  test.use({ colorScheme: "light" });

  test("a first visit follows an operating system set to light, and a visitor's choice wins afterward", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/`);
    expect(await themeOf(page)).toBe("light");
    await page.locator(SWITCH).click();
    expect(await themeOf(page)).toBe("dark");
    await page.emulateMedia({ colorScheme: "dark" });
    expect(await themeOf(page)).toBe("dark");
    await page.reload();
    expect(await themeOf(page)).toBe("dark");
  });

  test("without a choice, a change of the operating system is followed", async ({ page }) => {
    await page.goto(`${BASE}docs/`);
    expect(await themeOf(page)).toBe("light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => themeOf(page)).toBe("dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => themeOf(page)).toBe("light");
  });
});
