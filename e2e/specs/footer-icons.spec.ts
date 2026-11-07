import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

// The site built with `footer.links` that have an icon, the same build as nav-base.spec.ts (see the step 5d of
// verify-package). Two of its links have an icon: "Changelog feed" a lucide icon, "Our mark" a logo of the site's own
// brands folder (brands/mark.svg). "Status" has none.
const NAV = `http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4401) + 2}`;
const BASE = "/widget/";
const MARK_PATH = "M3 3h18v18H3z";

test.use({ baseURL: NAV });

const footerLink = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Project" }).getByRole("link", { name, exact: true });

/** Tag of the first child of a link, which is where the icon goes when the link has one. */
const firstChild = (link: Locator) =>
  link.evaluate((anchor) => anchor.firstElementChild?.tagName.toLowerCase() ?? null);

test.describe("icons on the links of the footer", () => {
  test("a lucide icon is drawn before the label, and is hidden from assistive technology", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/guide/`);
    const link = footerLink(page, "Changelog feed");
    await expect(link).toHaveAttribute("href", `${BASE}changelog/`);
    expect(await firstChild(link)).toBe("svg");
    const icon = link.locator("svg").first();
    await expect(icon).toHaveClass(/lucide-rss/);
    await expect(icon).toHaveAttribute("aria-hidden", "true");
    // The label is the name of the link, so the icon adds no words.
    await expect(link).toHaveAccessibleName("Changelog feed");
  });

  test("a logo of the brands folder is drawn in the text color, and is the file's path", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/guide/`);
    const link = footerLink(page, "Our mark");
    expect(await firstChild(link)).toBe("svg");
    const svg = link.locator("svg").first();
    await expect(svg).toHaveAttribute("fill", "currentColor");
    await expect(svg).toHaveAttribute("aria-hidden", "true");
    await expect(svg.locator("path")).toHaveAttribute("d", MARK_PATH);
    await expect(link).toHaveAccessibleName("Our mark");
  });

  test("a link without an icon has no icon, as before", async ({ page }) => {
    await page.goto(`${BASE}docs/guide/`);
    const link = footerLink(page, "Status");
    await expect(link).toBeVisible();
    await expect(link.locator("svg")).toHaveCount(0);
    expect(await firstChild(link)).toBeNull();
  });

  test("the logos are in the HTML that the server sends, so they show without JavaScript", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${BASE}docs/guide/`);
    await expect(footerLink(page, "Our mark").locator("svg")).toBeVisible();
    await expect(footerLink(page, "Changelog feed").locator("svg")).toBeVisible();
    await context.close();
  });
});

test.describe("the footer links with icons on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the links keep the 44 px target, and the page does not scroll sideways", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/guide/`);
    for (const name of ["Changelog feed", "Our mark"]) {
      const link = footerLink(page, name);
      await link.scrollIntoViewIfNeeded();
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});
