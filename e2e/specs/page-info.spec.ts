import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { measureContrast } from "../support/contrast";

// The generated site from verify-package.mjs: the repository `demo/widget` on GitHub, branch `main`, with
// `editLink` and `lastUpdated` on as `init` writes them. Its git history has two commits: every file was
// added on 2026-01-10, and then only docs/guide.md changed, on 2026-03-15.
const BASE = "/widget/";
const REPOSITORY = "https://github.com/demo/widget";
const EDIT = `${REPOSITORY}/edit/main`;

const link = (page: Page) => page.getByRole("link", { name: "Edit this page" });
const time = (page: Page) => page.locator("article time");

const PAGES = [
  { route: `${BASE}docs/getting-started/`, file: "docs/getting-started.md", date: "2026-01-10" },
  { route: `${BASE}docs/callouts/`, file: "docs/callouts.md", date: "2026-01-10" },
  // A README at the top of a collection is its overview page.
  { route: `${BASE}docs/overview/`, file: "docs/README.md", date: "2026-01-10" },
  // A collection with its own folder inside another one.
  {
    route: `${BASE}tutorials/first-steps/`,
    file: "docs/tutorials/first-steps.md",
    date: "2026-01-10",
  },
  { route: `${BASE}examples/basic/`, file: "examples/basic/README.md", date: "2026-01-10" },
  { route: `${BASE}changelog/`, file: "CHANGELOG.md", date: "2026-01-10" },
];

test.describe("Edit this page", () => {
  for (const { route, file } of PAGES) {
    test(`${route} links to ${file} on the branch`, async ({ page }) => {
      await page.goto(route);
      await expect(link(page)).toHaveCount(1);
      await expect(link(page)).toHaveAttribute("href", `${EDIT}/${file}`);
    });
  }

  test("is a link in the page, after the content and before the previous and next links", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/getting-started/`);
    const order = await page.evaluate(() => {
      const info = document.querySelector("article a[href*='/edit/']")!;
      const prose = document.querySelector("[data-prose]")!;
      const nav = document.querySelector("nav[aria-label='Previous and next']")!;
      return {
        afterProse: Boolean(prose.compareDocumentPosition(info) & Node.DOCUMENT_POSITION_FOLLOWING),
        beforeNav: Boolean(info.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING),
      };
    });
    expect(order).toEqual({ afterProse: true, beforeNav: true });
  });

  test("is not on the home page, the 404 page or the index of a collection", async ({ page }) => {
    for (const route of [BASE, `${BASE}docs/`, `${BASE}does-not-exist/`]) {
      await page.goto(route);
      await expect(link(page), route).toHaveCount(0);
      await expect(page.locator("time"), route).toHaveCount(0);
    }
  });
});

test.describe("Last updated", () => {
  for (const { route, date } of PAGES) {
    test(`${route} shows ${date}`, async ({ page }) => {
      await page.goto(route);
      await expect(time(page)).toHaveCount(1);
      await expect(time(page)).toHaveAttribute("datetime", date);
    });
  }

  test("comes from the history of the file itself, not from the last commit of the repository", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/guide/`);
    await expect(time(page)).toHaveAttribute("datetime", "2026-03-15");
    await page.goto(`${BASE}docs/getting-started/`);
    await expect(time(page)).toHaveAttribute("datetime", "2026-01-10");
  });

  test("is a time element with a machine-readable value and a readable text", async ({ page }) => {
    await page.goto(`${BASE}docs/guide/`);
    await expect(time(page)).toHaveText("15 March 2026");
    await expect(page.locator("article").getByText("Last updated")).toBeVisible();
  });
});

const VIEWPORTS = [
  { name: "320 wide", width: 320, height: 640 },
  { name: "360 wide", width: 360, height: 740 },
  { name: "390 wide", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];

test.describe("the foot of a page", () => {
  for (const viewport of VIEWPORTS) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test("the link is a target of at least 44px, and the page does not scroll sideways", async ({
        page,
      }) => {
        await page.goto(`${BASE}docs/guide/`);
        const box = (await link(page).boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
        ).toBeLessThanOrEqual(0);
      });

      for (const theme of ["dark", "light"] as const) {
        test(`the link and the date reach WCAG AA in the ${theme} theme, also hovered and focused`, async ({
          page,
        }) => {
          await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
          await page.goto(`${BASE}docs/guide/`);
          expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
          await expect(link(page)).toBeVisible();
          await expect(time(page)).toBeVisible();

          const states: Record<string, () => Promise<void>> = {
            default: async () => {},
            hover: () => link(page).hover(),
            focus: async () => {
              await page.mouse.move(0, 0);
              await link(page).focus();
            },
          };
          for (const [name, enter] of Object.entries(states)) {
            await enter();
            await page.waitForTimeout(250); // let the color transition finish
            const { offenders, checked } = await measureContrast(page);
            expect(checked, name).toBeGreaterThan(5);
            expect(offenders, name).toEqual([]);
          }
        });
      }
    });
  }

  test("the link shows a focus ring for the keyboard", async ({ page }) => {
    await page.goto(`${BASE}docs/guide/`);
    await link(page).focus();
    await expect(link(page)).toBeFocused();
    const ring = await link(page).evaluate((node) => getComputedStyle(node).outlineStyle);
    expect(ring).not.toBe("none");
  });
});
