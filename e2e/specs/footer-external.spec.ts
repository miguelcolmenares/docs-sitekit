import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

// The site of footer-icons.spec.ts, built with the footer links of verify-package (step 5d). "Marketplace" is a web
// address with `external: true`, so it opens in a new tab. "Status" is a path of the site, and "Status page" is a web
// address, and neither has the flag, so both open in the same tab.
const NAV = `http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4401) + 2}`;
const BASE = "/widget/";
const ARROW = "svg.lucide-arrow-up-right";

test.use({ baseURL: NAV });

const footerLink = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Project" }).getByRole("link", { name, exact: true });

/** The arrow that marks an external link, which is inside the link. */
const arrowOf = (link: Locator) => link.locator(ARROW);

test.describe("the external flag of a footer link", () => {
  test("an external link opens in a new tab, and its arrow is hidden from assistive technology", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/guide/`);
    const link = footerLink(page, "Marketplace");
    await expect(link).toHaveAttribute("href", "https://marketplace.widget.example/widget");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(arrowOf(link)).toHaveCount(1);
    await expect(arrowOf(link)).toHaveAttribute("aria-hidden", "true");
    // The arrow adds no words: the name of the link is its label.
    await expect(link).toHaveAccessibleName("Marketplace");
  });

  test("a path of the site, without the flag, opens in the same tab and has no arrow", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/guide/`);
    const link = footerLink(page, "Status");
    await expect(link).toHaveAttribute("href", `${BASE}changelog/`);
    expect(await link.getAttribute("target")).toBeNull();
    expect(await link.getAttribute("rel")).toBeNull();
    await expect(arrowOf(link)).toHaveCount(0);
  });

  test("a web address without the flag still opens in the same tab: the flag is not a default", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/guide/`);
    const link = footerLink(page, "Status page");
    await expect(link).toHaveAttribute("href", "https://status.widget.example");
    expect(await link.getAttribute("target")).toBeNull();
    await expect(arrowOf(link)).toHaveCount(0);
  });

  test("the page has no serious or critical axe violation", async ({ page }) => {
    await page.goto(`${BASE}docs/guide/`);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious.map((violation) => violation.id)).toEqual([]);
  });
});

test.describe("the external footer link on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the link keeps the 44 px target, and the page does not scroll sideways", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/guide/`);
    const link = footerLink(page, "Marketplace");
    await link.scrollIntoViewIfNeeded();
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});
