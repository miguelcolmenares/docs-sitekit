import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { observeVitals, readVitals } from "../support/vitals";

// The home page of the documentation of this project, built with its own config (the `demo` key). It is served under
// /docs-sitekit/ on the port after the one of the generated site, as the components spec does.
const OWN = `http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4401) + 1}/docs-sitekit/`;
const SECTION_TITLE = "A Markdown file becomes a page";
const SAMPLES = 3;
const VIEWPORTS = [
  { name: "320 wide", width: 320, height: 640 },
  { name: "360 wide", width: 360, height: 740 },
  { name: "390 wide", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const section = (page: Page) =>
  page.locator("section", { has: page.getByRole("heading", { name: SECTION_TITLE, exact: true }) });

/**
 * Scroll the section to the reader, then wait until its island has loaded (Astro removes `ssr` from it). A press before
 * that does nothing, as on any page where a button waits for `client:visible`, so the tests wait for it first.
 */
async function ready(page: Page) {
  await section(page).locator("[data-st-bar]").scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => {
      const island = document.querySelector("astro-island[component-export='SourceToHtmlTabs']");
      return island !== null && !island.hasAttribute("ssr");
    },
    undefined,
    { timeout: 10_000 },
  );
}

test.describe("the Markdown sample on the home page", () => {
  test.use({ baseURL: OWN });

  test("shows the source, the preview and the HTML of a sample, and the next step", async ({
    page,
  }) => {
    await page.goto(OWN);
    const home = section(page);
    await expect(home).toHaveCount(1);
    await expect(home.getByRole("button", { name: "Heading and list" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(home.locator("[data-st-panel='source'][data-active]")).toContainText(
      "docs/getting-started.md",
    );
    await expect(home.locator("[data-st-panel='preview'][data-active]")).toContainText(
      "Run the command in an empty folder",
    );
    await expect(home.getByRole("tab", { name: "HTML" })).toHaveAttribute("aria-selected", "false");
    await expect(home.getByRole("link", { name: "Get started" })).toBeVisible();
  });

  test("the sample buttons change the source and the preview together", async ({ page }) => {
    await page.goto(OWN);
    await ready(page);
    const home = section(page);
    await home.getByRole("button", { name: "Callout and link" }).click();
    await expect(home.getByRole("button", { name: "Callout and link" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(home.locator("[data-st-panel='source'][data-active]")).toContainText("[!NOTE]");
    await expect(home.locator("[data-st-panel='preview'][data-active]")).toContainText(
      "The kit rewrites the link",
    );
    expect(await home.locator("[data-st-panel][data-active]").count()).toBe(2);
  });

  test("the HTML tab shows the HTML the sample writes, and the arrow keys move between the tabs", async ({
    page,
  }) => {
    await page.goto(OWN);
    await ready(page);
    const home = section(page);
    const preview = home.getByRole("tab", { name: "Preview" });
    await preview.focus();
    await page.keyboard.press("ArrowRight");
    const html = home.getByRole("tab", { name: "HTML" });
    await expect(html).toHaveAttribute("aria-selected", "true");
    await expect(html).toBeFocused();
    await expect(home.locator("[data-st-panel='html'][data-active]")).toContainText(
      '<h2 id="getting-started">',
    );
    await expect(home.locator("[data-st-panel='preview'][data-active]")).toHaveCount(0);
    await page.keyboard.press("Home");
    await expect(preview).toHaveAttribute("aria-selected", "true");
    await expect(preview).toBeFocused();
  });

  test("the preview is not a set of links and headings for the page: it has no link, and its headings have no role", async ({
    page,
  }) => {
    await page.goto(OWN);
    const preview = section(page).locator("[data-st-panel='preview']");
    expect(await preview.locator("a[href]").count()).toBe(0);
    expect(await preview.locator("h2, h3").count()).toBeGreaterThan(0);
    expect(
      await preview.locator("h2:not([role='presentation']), h3:not([role='presentation'])").count(),
    ).toBe(0);
    await expect(preview.locator("span.underline", { hasText: "the configuration" })).toHaveCount(
      1,
    );
  });

  test("gives every element of the page an id of its own", async ({ page }) => {
    await page.goto(OWN);
    const duplicates = await page.evaluate(() => {
      const ids = [...document.querySelectorAll("[id]")].map((node) => node.id);
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    });
    expect(duplicates).toEqual([]);
  });

  test("reads without JavaScript: every panel of every sample is shown, and no button is", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(OWN);
    const home = section(page);
    await expect(home.locator("[data-st-panel]")).toHaveCount(SAMPLES * 3);
    for (const panel of await home.locator("[data-st-panel]").all()) {
      await expect(panel).toBeVisible();
    }
    await expect(home.locator("[data-st-bar]")).toBeHidden();
    await expect(home.locator("[data-st-panel='html']").first()).toContainText("<h2");
    await context.close();
  });

  test("changing the sample or the view moves nothing on the page (CLS 0)", async ({ page }) => {
    await observeVitals(page);
    await page.goto(OWN);
    await page.waitForLoadState("networkidle");
    await ready(page);
    const home = section(page);
    const before = await home.locator(".st-stack").first().boundingBox();
    await home.getByRole("button", { name: "Code block" }).click();
    await home.getByRole("tab", { name: "HTML" }).click();
    await page.waitForTimeout(300);
    const after = await home.locator(".st-stack").first().boundingBox();
    expect(after?.height).toBe(before?.height);
    const vitals = await readVitals(page);
    // The height of the stack is compared exactly above. CI measured 0.00001 here once, a sub-pixel rounding of the
    // page and not a move of the sample, so the layout shift is held to a thousandth, far below the 0.01 of vitals.spec.ts.
    expect(vitals.cls).toBeLessThan(0.001);
  });

  test("passes axe in the section, in both themes", async ({ page }) => {
    for (const theme of ["dark", "light"]) {
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await page.goto(OWN);
      const results = await new AxeBuilder({ page }).include("main").analyze();
      expect({ theme, ids: results.violations.map((violation) => violation.id) }).toEqual({
        theme,
        ids: [],
      });
    }
  });

  for (const viewport of VIEWPORTS) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test("has no sideways scroll, and the buttons are 44 px high on a phone", async ({
        page,
      }) => {
        await page.goto(OWN);
        expect(await overflow(page)).toBeLessThanOrEqual(0);
        if (viewport.width < 768) {
          const heights = await section(page)
            .locator("[data-st-bar] button")
            .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
          for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
        }
      });

      test("keeps the light theme readable too", async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem("theme", "light"));
        await page.goto(OWN);
        expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
        expect(await overflow(page)).toBeLessThanOrEqual(0);
      });
    });
  }
});
