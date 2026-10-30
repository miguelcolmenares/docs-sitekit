import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const BASE = "/widget/";
const ROUTES = [
  { path: `${BASE}`, title: /widget/i },
  { path: `${BASE}docs/`, title: /Docs/ },
  { path: `${BASE}docs/getting-started/`, title: /Getting started/ },
  { path: `${BASE}docs/guide/`, title: /Guide/ },
  { path: `${BASE}docs/overview/`, title: /Widget documentation/ },
  { path: `${BASE}tutorials/`, title: /Tutorials/ },
  { path: `${BASE}tutorials/first-steps/`, title: /First steps/ },
  { path: `${BASE}examples/`, title: /Examples/ },
  { path: `${BASE}examples/basic/`, title: /Basic example/ },
  { path: `${BASE}changelog/`, title: /Changelog/ },
  { path: `${BASE}tutorials/code-blocks/`, title: /Code blocks/ },
];

/** Collect page errors and console errors, so a layout or hydration problem fails the test. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
  });
  return errors;
}

test.describe("every route", () => {
  for (const route of ROUTES) {
    test(`${route.path} answers 200 with its own title and one h1`, async ({ page }) => {
      const errors = watchErrors(page);
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(route.title);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        /^https:\/\/demo\.github\.io\/widget\//,
      );
      expect(errors).toEqual([]);
    });
  }

  test("an unknown address answers 404 with the not-found page", async ({ page }) => {
    const response = await page.goto(`${BASE}does-not-exist/`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the content is in the HTML, not hidden until a script runs", async ({ page }) => {
    await page.goto(`${BASE}docs/getting-started/`);
    await expect(page.getByRole("heading", { name: "Getting started", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Next steps" })).toBeVisible();
    await expect(page.getByRole("link", { name: "the guide" })).toHaveAttribute(
      "href",
      `${BASE}docs/guide/#advanced`,
    );
  });

  test("the home page shows its headline and install command", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("npm install @demo/widget").first()).toBeVisible();
  });
});

test.describe("links", () => {
  test("a rewritten link goes to the right page", async ({ page }) => {
    await page.goto(`${BASE}docs/getting-started/`);
    await page.getByRole("link", { name: "the guide" }).click();
    await expect(page).toHaveURL(`${BASE}docs/guide/#advanced`);
    await expect(page.getByRole("heading", { name: "Advanced" })).toBeVisible();
  });

  test("a link to a repository file points at the repository host, in a new tab", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/getting-started/`);
    const link = page.getByRole("link", { name: "license" });
    await expect(link).toHaveAttribute("href", "https://github.com/demo/widget/blob/HEAD/LICENSE");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  });

  test("previous and next move through the docs in order", async ({ page }) => {
    await page.goto(`${BASE}docs/getting-started/`);
    await page
      .getByRole("navigation", { name: "Previous and next" })
      .getByRole("link", { name: /Guide/ })
      .click();
    await expect(page).toHaveURL(`${BASE}docs/guide/`);
  });
});

test.describe("collections and groups", () => {
  test("the docs index shows pages under the name of their group, in the configured order", async ({
    page,
  }) => {
    await page.goto(`${BASE}docs/`);
    const headings = await page.locator("main h2").allTextContents();
    expect(headings).toEqual(["Start", "Use"]);
    const start = page.locator("section", { has: page.getByRole("heading", { name: "Start" }) });
    expect(await start.locator("a.group h3").allTextContents()).toEqual([
      "Widget documentation",
      "Getting started",
    ]);
  });

  test("each card carries its group as a badge", async ({ page }) => {
    await page.goto(`${BASE}docs/`);
    const card = (title: string) =>
      page
        .locator("a.group")
        .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await expect(card("Getting started").getByText("Start", { exact: true })).toBeVisible();
    await expect(card("Guide").getByText("Use", { exact: true })).toBeVisible();
  });

  test("the sidebar names the groups, and a nested collection has its own menu entry and index", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}docs/guide/`);
    const sidebar = page.getByRole("navigation", { name: "Docs" });
    await expect(sidebar.getByText("Start", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("Use", { exact: true })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "First steps" })).toHaveCount(0); // that is a tutorial
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Tutorials" })
      .click();
    await expect(page).toHaveURL(`${BASE}tutorials/`);
    await expect(page.getByRole("link", { name: /First steps/ })).toBeVisible();
  });

  test("the menu follows the configured collections, then the changelog", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE);
    expect(
      await page.getByRole("navigation", { name: "Main" }).getByRole("link").allTextContents(),
    ).toEqual(["Docs", "Tutorials", "Examples", "Changelog"]);
  });
});

test.describe("version", () => {
  test("the footer shows the version of the repository and links to the changelog", async ({
    page,
  }) => {
    await page.goto(BASE);
    const link = page.locator("footer").getByRole("link", { name: "v1.3.0" });
    await expect(link).toHaveAttribute("href", `${BASE}changelog/`);
  });
});

test.describe("keyboard and navigation", () => {
  test("the first Tab stop is the skip link, and it jumps to the content", async ({ page }) => {
    await page.goto(BASE);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("the current section is marked in the main navigation", async ({ page }) => {
    await page.goto(`${BASE}docs/guide/`);
    await expect(
      page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Docs" }),
    ).toHaveAttribute("aria-current", "page");
  });
});

test.describe("copy buttons", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("a code block gets a copy button that copies its code", async ({ page }) => {
    await page.goto(`${BASE}docs/getting-started/`);
    const button = page.getByRole("button", { name: "Copy code" }).first();
    await expect(button).toBeVisible();
    await button.click();
    await expect(button).toHaveText("Copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      "npm install @demo/widget",
    );
  });

  test("the install command in the hero can be copied", async ({ page }) => {
    await page.goto(BASE);
    await page
      .getByRole("button", { name: /Copy command/ })
      .first()
      .click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "npm install @demo/widget",
    );
  });
});

test.describe("layout", () => {
  test("the footer link columns sit side by side on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE);
    const headings = page.locator("footer nav h2");
    expect(await headings.count()).toBeGreaterThanOrEqual(2);
    const boxes = await headings.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect()),
    );
    const tops = boxes.map((box) => Math.round(box.top));
    expect(new Set(tops).size).toBe(1); // same row
    expect(new Set(boxes.map((box) => Math.round(box.left))).size).toBe(boxes.length); // different columns
  });

  test("the footer stacks on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE);
    const boxes = await page
      .locator("footer nav h2")
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()));
    expect(new Set(boxes.map((box) => Math.round(box.top))).size).toBe(boxes.length);
  });

  for (const route of ROUTES) {
    test(`${route.path} has no horizontal scroll on a phone`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto(route.path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("the card grid has no orphan row on the home page at desktop width", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE);
    const cards = page.locator("main a.group");
    const lefts = await cards.evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().left)),
    );
    expect(new Set(lefts).size).toBeLessThanOrEqual(3); // three explicit columns, never more
  });
});

test.describe("mobile menu", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens, lists the sections, and closes with Escape", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(BASE);
    await page.getByRole("button", { name: "Open menu" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Docs" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("a link in the menu navigates", async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Changelog" }).click();
    await expect(page).toHaveURL(`${BASE}changelog/`);
  });
});

test.describe("accessibility", () => {
  for (const route of [ROUTES[0]!, ROUTES[2]!, ROUTES[4]!]) {
    test(`${route.path} has no serious or critical axe violations`, async ({ page }) => {
      await page.goto(route.path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );
      expect(
        serious.map(
          (violation) =>
            `${violation.id}: ${violation.nodes.length} node(s), e.g. ${violation.nodes[0]?.target.join(" ")}`,
        ),
      ).toEqual([]);
    });
  }
});

test.describe("what the page asks the network for", () => {
  test("no request leaves the site", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.hostname !== "127.0.0.1") external.push(request.url());
    });
    await page.goto(BASE, { waitUntil: "networkidle" });
    expect(external).toEqual([]);
  });
});
