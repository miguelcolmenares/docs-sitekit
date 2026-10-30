import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const BASE = "/widget/";
// The generated site is configured with a GitHub repository, one feature with `brand:github` and one with
// `brand:custom/mark` (a square drawn by site/brands/mark.svg), see verify-package.
const CUSTOM_PATH = "M3 3h18v18H3z";

const PHONES = [
  { name: "320 wide", width: 320, height: 640 },
  { name: "360 wide", width: 360, height: 740 },
  { name: "390 wide", width: 390, height: 844 },
];

const ROUTES = [BASE, `${BASE}docs/`, `${BASE}docs/getting-started/`, `${BASE}changelog/`];

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** What an inline logo must be: filled with the text color, hidden from assistive technology, no image. */
async function describeLogo(page: Page, selector: string) {
  return page.locator(selector).evaluate((anchor) => {
    const svg = anchor.querySelector("svg")!;
    const box = svg.getBoundingClientRect();
    return {
      ariaHidden: svg.getAttribute("aria-hidden"),
      fillAttribute: svg.getAttribute("fill"),
      fill: getComputedStyle(svg).fill,
      color: getComputedStyle(anchor).color,
      width: box.width,
      height: box.height,
      paths: svg.querySelectorAll("path").length,
      images: anchor.querySelectorAll("img, image, use").length,
      text: (anchor.textContent ?? "").trim(),
    };
  });
}

test.describe("brand logos on the desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the repository button in the header has the GitHub logo next to its name", async ({
    page,
  }) => {
    await page.goto(BASE);
    const button = page.locator("header [data-repository-button]");
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("href", /github\.com\/demo\/widget/);
    await expect(button).toHaveAttribute("target", "_blank");
    await expect(button).toHaveAttribute("rel", /noopener/);
    const logo = await describeLogo(page, "header [data-repository-button]");
    // The name is next to the logo, so the logo is decoration.
    expect(logo.text).toBe("GitHub");
    expect(logo.ariaHidden).toBe("true");
    expect(logo.paths).toBe(1);
    expect(logo.images).toBe(0);
    // Drawn with currentColor: the shape takes the color of the text next to it, which the contrast spec measures.
    expect(logo.fillAttribute).toBe("currentColor");
    expect(logo.fill).toBe(logo.color);
    expect(logo.width).toBeGreaterThanOrEqual(16);
    expect(logo.height).toBeGreaterThanOrEqual(16);
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

  test("the logo takes the hover color of its button", async ({ page }) => {
    await page.goto(BASE);
    const button = page.locator("header [data-repository-button]");
    const before = await describeLogo(page, "header [data-repository-button]");
    await button.hover();
    await expect
      .poll(async () => (await describeLogo(page, "header [data-repository-button]")).color)
      .not.toBe(before.color);
    const after = await describeLogo(page, "header [data-repository-button]");
    expect(after.fill).toBe(after.color);
  });

  test("the footer repository link has the logo too", async ({ page }) => {
    await page.goto(BASE);
    const link = page.locator("footer nav a", { hasText: "GitHub" });
    // The other svg of the link is the arrow of an external link, which is not filled.
    const logo = link.locator('svg[fill="currentColor"]');
    await expect(logo).toHaveCount(1);
    await expect(logo).toHaveAttribute("aria-hidden", "true");
  });

  test("a feature with brand:github draws the logo inline", async ({ page }) => {
    await page.goto(BASE);
    const card = page.locator("article", { hasText: "On GitHub" });
    const svg = card.locator("svg");
    await expect(svg).toHaveCount(1);
    await expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    await expect(svg).toHaveAttribute("fill", "currentColor");
    await expect(svg).toHaveAttribute("aria-hidden", "true");
    await expect(svg.locator("path")).toHaveCount(1);
  });

  test("brand:custom/mark draws the file of the site's brands folder, and only its path", async ({
    page,
  }) => {
    await page.goto(BASE);
    const svg = page.locator("article", { hasText: "Our own mark" }).locator("svg");
    await expect(svg).toHaveCount(1);
    await expect(svg.locator("path")).toHaveAttribute("d", CUSTOM_PATH);
    await expect(svg).toHaveAttribute("fill", "currentColor");
    await expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  test("the logos are in the HTML that the server sends, so they show without JavaScript", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(BASE);
    await expect(page.locator("header [data-repository-button] svg")).toBeVisible();
    await expect(page.locator("article", { hasText: "Our own mark" }).locator("svg")).toBeVisible();
    await context.close();
  });
});

test.describe("no request for a logo goes to another host", () => {
  test("every route loads from the site's own origin only, and the markup names no logo host", async ({
    page,
    baseURL,
  }) => {
    const origin = new URL(baseURL!).origin;
    const foreign: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith(origin) && !url.startsWith("data:") && !url.startsWith("blob:"))
        foreign.push(url);
    });
    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: "networkidle" });
      const html = await page.content();
      expect(html).not.toMatch(
        /cdn\.simpleicons|simpleicons\.org\/icons|cdn\.jsdelivr|unpkg\.com|api\.iconify|raw\.githubusercontent/i,
      );
      // A logo is inline, never an image fetched at run time.
      expect(await page.locator("header img, footer img, main img").count()).toBe(0);
    }
    expect(foreign).toEqual([]);
  });
});

for (const phone of PHONES) {
  test.describe(`brand logos at ${phone.name}`, () => {
    test.use({ viewport: { width: phone.width, height: phone.height } });

    for (const route of ROUTES) {
      test(`${route} does not scroll sideways with the logos`, async ({ page }) => {
        await page.goto(route);
        expect(await overflow(page)).toBeLessThanOrEqual(0);
      });
    }

    test("the repository button is in the open menu, with a 44px target", async ({ page }) => {
      await page.goto(BASE);
      // The bar has no room for it on a phone, so it is hidden there and the menu carries it.
      await expect(page.locator("header > div > div [data-repository-button]")).toBeHidden();
      await page.getByRole("button", { name: "Open menu" }).click();
      const button = page.getByRole("dialog").locator("[data-repository-button]");
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute("href", /github\.com\/demo\/widget/);
      const box = (await button.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      await expect(button.locator("svg")).toHaveAttribute("aria-hidden", "true");
      await expect(button).toContainText("GitHub");
    });

    test("the footer repository link is a 44px target", async ({ page }) => {
      await page.goto(BASE);
      const link = page.locator("footer nav a", { hasText: "GitHub" });
      const box = (await link.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      await expect(link.locator('svg[fill="currentColor"]')).toBeVisible();
    });
  });
}
