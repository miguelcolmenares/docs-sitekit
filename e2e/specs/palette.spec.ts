import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { measureContrast } from "../support/contrast";

// The color palette of the design tokens page of this project, built by verify-package from the template folder.
// The values it shows are read from design/tokens.json, so the expected colors are read from the same file here.
const OWN = `http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4401) + 1}`;
const PAGE = "/docs-sitekit/docs/design-tokens/";
const TEMPLATE = join(import.meta.dirname, "..", "..", "template");
const tokens = JSON.parse(readFileSync(join(TEMPLATE, "design", "tokens.json"), "utf8")) as {
  color: Record<string, string>;
  themes: { light: { color: Record<string, string> } };
};

const PALETTE = "[data-color-palette]";
const chips = (page: Page) => page.locator(`${PALETTE} .palette-chip`);
const copyButton = (page: Page, label: string) =>
  page.getByRole("button", { name: label, exact: true });
const status = (page: Page) => page.locator(`${PALETTE} .palette-status`);

/** The value of a token, in the order the page shows them: each token's dark value, then its light value. */
const expectedChips = Object.keys(tokens.color).flatMap((name) => [
  tokens.color[name]!,
  tokens.themes.light.color[name]!,
]);
const rgb = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
};

test.use({ baseURL: OWN });

test.describe("the color palette on the design tokens page", () => {
  test("shows every color token of both sets, with the color of the file", async ({ page }) => {
    await page.goto(`${OWN}${PAGE}`);
    await expect(chips(page)).toHaveCount(expectedChips.length);
    const drawn = await chips(page).evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).backgroundColor),
    );
    expect(drawn).toEqual(expectedChips.map(rgb));
    const names = await page.locator(`${PALETTE} .palette-name code`).allTextContents();
    expect(names).toEqual(Object.keys(tokens.color));
  });

  test("loads its script only on a page that has a palette", async ({ page }) => {
    const requested: string[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/palette-copy.js")) requested.push(request.url());
    });
    await page.goto(`${OWN}${PAGE}`);
    await expect(chips(page).first()).toBeVisible();
    expect(requested).toEqual([`${OWN}/docs-sitekit/palette-copy.js`]);
    requested.length = 0;
    await page.goto(`${OWN}/docs-sitekit/docs/callouts/`);
    await page.waitForLoadState("networkidle");
    expect(requested).toEqual([]);
  });

  test("names every value with its token and its set, and shows the hex code", async ({ page }) => {
    await page.goto(`${OWN}${PAGE}`);
    const names = Object.keys(tokens.color);
    for (const name of names) {
      const dark = tokens.color[name]!;
      const light = tokens.themes.light.color[name]!;
      await expect(copyButton(page, `Copy ${dark}, ${name}, dark`)).toHaveCount(1);
      await expect(copyButton(page, `Copy ${light}, ${name}, light`)).toHaveCount(1);
    }
    await expect(page.locator(`${PALETTE} .palette-value code`).first()).toHaveText(
      tokens.color[names[0]!]!,
    );
  });

  test("the copy buttons are hidden and the swatches still show without JavaScript", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${OWN}${PAGE}`);
    await expect(chips(page)).toHaveCount(expectedChips.length);
    await expect(chips(page).first()).toBeVisible();
    await expect(page.locator(`${PALETTE} .palette-copy`).first()).toBeHidden();
    await context.close();
  });

  test.describe("copying", () => {
    test.use({ permissions: ["clipboard-read", "clipboard-write"] });

    test("a click puts the value on the clipboard, says Copied and announces the value", async ({
      page,
    }) => {
      await page.goto(`${OWN}${PAGE}`);
      const name = "accent";
      const dark = tokens.color[name]!;
      const button = copyButton(page, `Copy ${dark}, ${name}, dark`);
      await button.click();
      await expect(button).toHaveText("Copied");
      await expect(status(page)).toHaveText(`Copied ${dark}, ${name}, dark`);
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(dark);
    });

    test("works with the keyboard", async ({ page }) => {
      await page.goto(`${OWN}${PAGE}`);
      const name = "success";
      const light = tokens.themes.light.color[name]!;
      const button = copyButton(page, `Copy ${light}, ${name}, light`);
      await button.focus();
      await page.keyboard.press("Enter");
      await expect(status(page)).toHaveText(`Copied ${light}, ${name}, light`);
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(light);
    });
  });

  test("the copy buttons are 44px targets on a phone, and the page does not scroll sideways at 320px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(`${OWN}${PAGE}`);
    await page.locator(`${PALETTE} .palette-copy`).first().scrollIntoViewIfNeeded();
    const buttons = page.locator(`${PALETTE} .palette-copy`);
    const count = await buttons.count();
    expect(count).toBe(expectedChips.length);
    for (let index = 0; index < count; index += 1) {
      const box = (await buttons.nth(index).boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  for (const [label, width] of [
    ["320px", 320],
    ["desktop", 1280],
  ] as const) {
    for (const theme of ["dark", "light"] as const) {
      test(`passes axe and the contrast check in the ${theme} theme at ${label}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${OWN}${PAGE}`);
        if (theme === "light") await page.locator("header [data-theme-switch]").click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await page.evaluate(() =>
          Promise.all(document.getAnimations().map((animation) => animation.finished)),
        );
        const results = await new AxeBuilder({ page }).include(PALETTE).analyze();
        expect(results.violations.map((violation) => violation.id)).toEqual([]);
        const { offenders } = await measureContrast(page);
        expect(offenders.filter((offender) => offender.text.length > 0)).toEqual([]);
      });
    }
  }
});
