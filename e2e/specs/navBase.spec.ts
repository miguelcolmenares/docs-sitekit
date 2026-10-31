import { expect, test } from "@playwright/test";

// The same generated site as the other specs, built a second time with a `nav` and `footer.links`, served under
// `/widget/` on the port after the one of the project site (see the step 5d of verify-package). The config:
//   nav: Guide /docs/getting-started/, Written with the base /widget/tutorials/, Blog (a web address),
//        Contact (mailto:), Top (#main)
//   footer.links: Status /changelog/, Footer with the base /widget/examples/, Status page (a web address),
//        Footer contact (mailto:)
const NAV = `http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4401) + 2}`;
const BASE = "/widget/";

test.use({ baseURL: NAV });

const NAV_LINKS: [string, string][] = [
  ["Guide", `${BASE}docs/getting-started/`],
  ["Written with the base", `${BASE}tutorials/`],
  ["Blog", "https://blog.widget.example"],
  ["Contact", "mailto:team@widget.example"],
  ["Top", "#main"],
];

const FOOTER_LINKS: [string, string][] = [
  ["Status", `${BASE}changelog/`],
  ["Footer with the base", `${BASE}examples/`],
  ["Status page", "https://status.widget.example"],
  ["Footer contact", "mailto:status@widget.example"],
];

test.describe("the base on the links of nav and footer.links", () => {
  test("the header adds the base to a path, and leaves the other links as written", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/guide/`);
    const header = page.getByRole("navigation", { name: "Main" });
    for (const [label, href] of NAV_LINKS) {
      await expect(header.getByRole("link", { name: label, exact: true })).toHaveAttribute(
        "href",
        href,
      );
    }
  });

  test("the menu of a phone has the same links", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(`${BASE}docs/guide/`);
    await page.locator("[data-mobile-menu-open]").click();
    const menu = page.getByRole("navigation", { name: "Mobile" });
    for (const [label, href] of NAV_LINKS) {
      await expect(menu.getByRole("link", { name: label, exact: true })).toHaveAttribute(
        "href",
        href,
      );
    }
  });

  test("the footer adds the base to a path of footer.links, and leaves the other links as written", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/guide/`);
    const project = page.getByRole("navigation", { name: "Project" });
    for (const [label, href] of FOOTER_LINKS) {
      await expect(project.getByRole("link", { name: label, exact: true })).toHaveAttribute(
        "href",
        href,
      );
    }
  });

  test("the links with a path go to a page of the site, with the base written once", async ({
    page,
    request,
  }) => {
    await page.goto(BASE);
    const paths = [...NAV_LINKS, ...FOOTER_LINKS]
      .map(([, href]) => href)
      .filter((href) => href.startsWith(BASE));
    expect(paths).toHaveLength(4);
    for (const path of paths) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Guide", exact: true })
      .click();
    await expect(page).toHaveURL(`${NAV}${BASE}docs/getting-started/`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Getting started");
  });

  test("a link whose path is the current page is marked as current", async ({ page }) => {
    await page.goto(`${BASE}docs/getting-started/`);
    await expect(
      page
        .getByRole("navigation", { name: "Main" })
        .getByRole("link", { name: "Guide", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });
});
