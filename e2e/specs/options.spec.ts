import { expect, test } from "@playwright/test";

// What the pages "Options by topic" say a key changes, read on the generated site from verify-package.mjs:
// the repository `demo/widget`, package `@demo/widget` with the MIT license, served under `/widget/`,
// with the keys that `init` writes and none of the optional ones (`nav`, `footer`, `site.version`). The
// other values of each key were checked by building a site with that key, see the pull request.
const BASE = "/widget/";
const REPOSITORY = "https://github.com/demo/widget";

test.describe("identity and the home page", () => {
  test("the repository adds a header button, a footer link, an issues link and a closing band link", async ({
    page,
  }) => {
    await page.goto(BASE);
    await expect(page.locator("header [data-repository-button]")).toHaveAttribute(
      "href",
      REPOSITORY,
    );
    const project = page.getByRole("navigation", { name: "Project" });
    await expect(project.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", REPOSITORY);
    await expect(project.getByRole("link", { name: "Report an issue" })).toHaveAttribute(
      "href",
      `${REPOSITORY}/issues`,
    );
    await expect(page.getByRole("link", { name: "View on GitHub" }).last()).toHaveAttribute(
      "href",
      REPOSITORY,
    );
  });

  test("the license and the version of package.json are at the bottom of the footer", async ({
    page,
  }) => {
    await page.goto(BASE);
    const footer = page.locator("footer");
    await expect(footer).toContainText("MIT licensed");
    await expect(footer.getByRole("link", { name: /^v\d+\.\d+\.\d+$/ })).toHaveAttribute(
      "href",
      `${BASE}changelog/`,
    );
  });

  test("a path of the hero gets the base, and the install command is offered with a copy button", async ({
    page,
  }) => {
    await page.goto(BASE);
    const hero = page.locator("main section").first();
    await expect(hero.getByRole("link", { name: "Get started" })).toHaveAttribute(
      "href",
      /^\/widget\/docs\//,
    );
    await expect(hero.getByRole("button", { name: /^Copy command: / })).toBeVisible();
  });
});

test.describe("navigation and collections", () => {
  test("without a nav the header has one link for each collection, then the changelog", async ({
    page,
  }) => {
    await page.goto(BASE);
    const labels = await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link")
      .allTextContents();
    expect(labels).toEqual(["Docs", "Tutorials", "Examples", "Changelog"]);
  });

  test("a collection inside another one takes its pages out of the outer one", async ({ page }) => {
    await page.goto(`${BASE}docs/`);
    await expect(page.locator(`main a[href="${BASE}docs/getting-started/"]`)).toHaveCount(1);
    await expect(page.locator(`main a[href="${BASE}tutorials/first-steps/"]`)).toHaveCount(0);
    await page.goto(`${BASE}tutorials/`);
    await expect(page.locator(`main a[href="${BASE}tutorials/first-steps/"]`)).toHaveCount(1);
  });
});

test.describe("theme and search", () => {
  test("the default theme is written in the HTML, so it holds without JavaScript", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(BASE);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#09090b");
    await context.close();
  });

  test("search is on: a button, a dialog and the index file", async ({ page, request }) => {
    await page.goto(BASE);
    await expect(page.locator("[data-search-open]")).toHaveCount(1);
    await expect(page.locator("[data-search-dialog]")).toHaveCount(1);
    expect((await request.get(`${BASE}search-index.json`)).status()).toBe(200);
  });
});

test.describe("edit link and dates", () => {
  test("the link and the date are on a page of a collection, not on the home page, the 404 page or an index", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/getting-started/`);
    await expect(page.getByRole("link", { name: "Edit this page" })).toHaveCount(1);
    await expect(page.locator("article time")).toHaveCount(1);
    for (const route of [BASE, `${BASE}docs/`, `${BASE}does-not-exist/`]) {
      await page.goto(route);
      await expect(page.getByRole("link", { name: "Edit this page" }), route).toHaveCount(0);
      await expect(page.locator("time"), route).toHaveCount(0);
    }
  });

  test("the date is a time element with the day in the datetime and the month written out", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/getting-started/`);
    const time = page.locator("article time");
    const day = await time.getAttribute("datetime");
    expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await expect(time).toHaveText(/^\d{1,2} [A-Z][a-z]+ \d{4}$/);
  });
});
