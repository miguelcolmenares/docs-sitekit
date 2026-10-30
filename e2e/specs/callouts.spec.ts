import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { measureContrast } from "../support/contrast";

// The page is written in markdown with `> [!NOTE]` and its four siblings, in the repository that
// `verify:package` generates. These tests read the built site, the way a visitor does.
const PAGE = "/widget/docs/callouts/";
const KINDS = [
  ["note", "Note"],
  ["tip", "Tip"],
  ["important", "Important"],
  ["warning", "Warning"],
  ["caution", "Caution"],
] as const;

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("callouts written in markdown", () => {
  test("each of the five markers is an aside with a note role, a hidden icon and a visible label", async ({
    page,
  }) => {
    await page.goto(PAGE);
    for (const [kind, label] of KINDS) {
      const callout = page.locator(`aside.callout[data-callout="${kind}"]`).first();
      await expect(callout).toHaveAttribute("role", "note");
      await expect(callout.locator("svg.callout-icon")).toHaveAttribute("aria-hidden", "true");
      await expect(callout.locator(".callout-label")).toBeVisible();
      await expect(callout.locator(".callout-label")).toHaveText(label);
    }
    // The marker line is gone: the text of the callout starts after the label.
    const texts = await page.locator("aside.callout").allTextContents();
    expect(texts.filter((text) => text.includes("[!"))).toEqual([]);
  });

  test("a callout is a note and not an alert: nothing on the page has an alert role", async ({
    page,
  }) => {
    await page.goto(PAGE);
    // The status region of a copy button, in a code block inside a callout, is polite and empty until a copy.
    await expect(
      page.locator('.prose-site [role="alert"], .prose-site [aria-live]:not(.code-status)'),
    ).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("note").first()).toBeVisible();
  });

  test("the kinds differ by label and icon, and by color too", async ({ page }) => {
    await page.goto(PAGE);
    const drawn = new Set<string>();
    const colors = new Set<string>();
    for (const [kind] of KINDS) {
      const callout = page.locator(`aside.callout[data-callout="${kind}"]`).first();
      drawn.add(await callout.locator("svg").innerHTML());
      colors.add(
        await callout.locator(".callout-label").evaluate((n) => getComputedStyle(n).color),
      );
    }
    expect(drawn.size).toBe(5);
    expect(colors.size).toBe(5);
  });

  test("a callout holds paragraphs, lists, code and links, and one inside a list item works", async ({
    page,
  }) => {
    await page.goto(PAGE);
    const note = page.locator('aside.callout[data-callout="note"]').first();
    await expect(note.getByRole("link", { name: "link to the guide" })).toHaveAttribute(
      "href",
      "/widget/docs/guide/",
    );
    await expect(note.locator("code")).toHaveText("inline code");
    await expect(page.locator('aside.callout[data-callout="tip"] ul li')).toHaveText([
      "first item",
      "second item",
    ]);
    await expect(page.locator('aside.callout[data-callout="warning"] pre')).toBeVisible();
    await expect(page.locator('li aside.callout[data-callout="note"]')).toContainText(
      "Inside the list.",
    );
  });

  test("a plain blockquote, an unknown marker and a marker in code are left as written", async ({
    page,
  }) => {
    await page.goto(PAGE);
    await expect(page.locator("aside.callout")).toHaveCount(6); // five kinds, and one in a list item
    const quotes = page.locator(".prose-site > blockquote");
    await expect(quotes).toHaveCount(2);
    await expect(quotes.first()).toHaveText("A plain quote, not a callout.");
    await expect(quotes.nth(1)).toContainText("[!NOTES]");
    await expect(page.locator("pre").filter({ hasText: "In a code block." })).toContainText(
      "[!NOTE]",
    );
    await expect(page.locator(".prose-site p code", { hasText: "[!TIP]" })).toBeVisible();
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("the callouts are in the HTML, with their icon and label", async ({ page }) => {
      await page.goto(PAGE);
      await expect(page.locator("aside.callout")).toHaveCount(6);
      await expect(page.locator("aside.callout svg.callout-icon path").first()).toBeAttached();
      await expect(page.getByText("Caution", { exact: true })).toBeVisible();
      // The icon has a size without any script: the page style gives it one.
      const size = await page
        .locator("aside.callout svg.callout-icon")
        .first()
        .evaluate((node) => node.getBoundingClientRect().width);
      expect(size).toBe(16);
    });
  });

  test("the markup of the page has no serious or critical axe violation", async ({ page }) => {
    await page.goto(PAGE);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious.map((violation) => violation.id)).toEqual([]);
  });

  for (const width of [320, 360, 390]) {
    test(`a long code line in a callout does not scroll the page at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(PAGE);
      const pre = page.locator('aside.callout[data-callout="warning"] pre');
      const box = await pre.evaluate((node) => ({
        scrolls: node.scrollWidth > node.clientWidth,
        width: node.getBoundingClientRect().width,
      }));
      expect(box.scrolls).toBe(true); // the line really is wider than the box
      expect(box.width).toBeLessThanOrEqual(width);
      await expect(pre).toHaveAttribute("tabindex", "0");
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      const edge = await page
        .locator("aside.callout")
        .evaluateAll((nodes) => Math.max(...nodes.map((n) => n.getBoundingClientRect().right)));
      expect(edge).toBeLessThanOrEqual(width);
    });
  }

  for (const theme of ["dark", "light"] as const) {
    for (const width of [320, 390, 1440]) {
      test(`text in all five tones reaches WCAG AA in the ${theme} theme at ${width}px`, async ({
        page,
      }) => {
        await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(PAGE);
        expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
        const { offenders, checked } = await measureContrast(page);
        expect(checked).toBeGreaterThan(20);
        expect(offenders).toEqual([]);
      });
    }

    test(`the colored edge of every tone is visible against the page in the ${theme} theme`, async ({
      page,
    }) => {
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await page.goto(PAGE);
      const edges = await page.locator("aside.callout").evaluateAll((nodes) =>
        nodes.map((node) => {
          const style = getComputedStyle(node);
          return { color: style.borderLeftColor, width: parseFloat(style.borderLeftWidth) };
        }),
      );
      for (const edge of edges) expect(edge.width).toBeGreaterThanOrEqual(3);
      expect(new Set(edges.map((edge) => edge.color)).size).toBe(5);
    });
  }
});
