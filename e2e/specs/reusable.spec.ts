import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// The page is written with `{{ package }}`, `{{ version }}` and two `<!-- include: ... -->` comments, in the
// repository that `verify:package` generates. `package` comes from `vars` in the config and `version` from the
// package.json of the repository, which the footer shows too. The tests read the built site, as a visitor does.
const BASE = "/widget/";
const PAGE = `${BASE}tutorials/reusable-content/`;

/** The version the footer shows, without the leading v. The page must show the same one. */
async function footerVersion(page: Page): Promise<string> {
  const link = page.locator(`footer a[href="${BASE}changelog/"]`).filter({ hasText: /^v\d/ });
  return ((await link.first().textContent()) ?? "").trim().replace(/^v/, "");
}

test.describe("variables and snippets", () => {
  test("a variable is replaced in the title, the heading, the prose and the link text", async ({
    page,
  }) => {
    await page.goto(PAGE);
    const version = await footerVersion(page);
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);

    await expect(page).toHaveTitle(
      new RegExp(`Using @demo/widget ${version.replace(/\./g, "\\.")}`),
    );
    await expect(page.locator("h1")).toHaveText(`Using @demo/widget ${version}`);
    await expect(
      page.getByRole("heading", { level: 2, name: "Install @demo/widget" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "the @demo/widget guide" })).toHaveAttribute(
      "href",
      `${BASE}docs/guide/`,
    );
    // The first paragraph is a snippet that has both variables, and it is the description of the page.
    const sentence = `@demo/widget ${version} needs Node 22 or newer.`;
    await expect(page.locator(".prose-site").getByText(sentence)).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", sentence);
  });

  test("a variable in a code span and in a code block is left as written", async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator(".prose-site p code")).toHaveText("{{ version }}");
    const block = page.locator(".prose-site pre");
    await expect(block).toContainText("Version {{ version }}");
    // The include comment in the block is shown, not run.
    await expect(block).toContainText("<!-- include: requirements.md -->");
  });

  test("a snippet in a list item stays in the item, as a nested list", async ({ page }) => {
    await page.goto(PAGE);
    const item = page.locator(".prose-site > ul > li");
    await expect(item).toHaveCount(1);
    await expect(item.locator(":scope > ol > li")).toHaveText([
      "Install the package.",
      "Run the build.",
    ]);
  });

  test("an include comment leaves nothing on the page, outside the code block that shows it", async ({
    page,
  }) => {
    await page.goto(PAGE);
    const html = await page
      .locator(".prose-site > p, .prose-site > ul, .prose-site > h2")
      .evaluateAll((nodes) => nodes.map((node) => node.outerHTML).join(""));
    expect(html).not.toContain("include");
    expect(html).not.toContain("<!--");
  });

  test("the search index has the replaced text, and finds the page by it", async ({ page }) => {
    await page.goto(PAGE);
    const version = await footerVersion(page);
    const response = await page.request.get(`${BASE}search-index.json`);
    const index = (await response.json()) as {
      pages: { url: string; title: string; text: string }[];
    };
    const entry = index.pages.find((candidate) => candidate.url === PAGE)!;
    expect(entry.title).toBe(`Using @demo/widget ${version}`);
    expect(entry.text).toContain(`@demo/widget ${version} needs Node 22 or newer.`);
    expect(entry.text).toContain("Install the package.");
    expect(entry.text).not.toContain("{{ package }}");
  });

  test("llms.txt and the Markdown copy of the page have the replaced text", async ({ page }) => {
    await page.goto(PAGE);
    const version = await footerVersion(page);
    const llms = await (await page.request.get(`${BASE}llms.txt`)).text();
    expect(llms).toContain(
      `[Using @demo/widget ${version}](https://demo.github.io${PAGE}): @demo/widget ${version} needs Node 22 or newer.`,
    );
    const copy = await (await page.request.get(`${PAGE}index.html.md`)).text();
    expect(copy.startsWith(`# Using @demo/widget ${version}\n`)).toBe(true);
    expect(copy).toContain(`@demo/widget ${version} needs Node 22 or newer.`);
    expect(copy).toContain("`{{ version }}`");
  });

  test("a page that uses neither feature is the same as before, and the snippets are not pages", async ({
    page,
  }) => {
    const plain = await page.goto(`${BASE}docs/guide/`);
    expect(plain?.status()).toBe(200);
    await expect(page.locator(".prose-site")).toContainText("The longer guide.");
    for (const snippet of ["requirements", "steps"]) {
      const response = await page.request.get(`${BASE}tutorials/${snippet}/`);
      expect(response.status()).toBe(404);
    }
  });

  test("the page has no horizontal scroll at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(PAGE);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
