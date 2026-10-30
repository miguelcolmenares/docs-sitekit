import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { measureContrast } from "../support/contrast";

const BASE = "/widget/";
const ROUTES = [
  BASE,
  `${BASE}docs/`,
  `${BASE}docs/getting-started/`,
  `${BASE}docs/guide/`,
  `${BASE}docs/callouts/`,
  `${BASE}tutorials/code-blocks/`,
  `${BASE}docs/overview/`,
  `${BASE}tutorials/`,
  `${BASE}tutorials/first-steps/`,
  `${BASE}examples/`,
  `${BASE}examples/basic/`,
  `${BASE}examples/detail-card/`,
  `${BASE}changelog/`,
  `${BASE}does-not-exist/`,
];
const PHONES = [
  { name: "320 wide (reflow limit)", width: 320, height: 640 },
  { name: "360 wide (common Android)", width: 360, height: 740 },
  { name: "390 wide (iPhone)", width: 390, height: 844 },
];
const DOC = `${BASE}docs/getting-started/`;

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const phone of PHONES) {
  test.describe(phone.name, () => {
    test.use({ viewport: { width: phone.width, height: phone.height } });

    for (const route of ROUTES) {
      test(`${route} does not scroll sideways`, async ({ page }) => {
        await page.goto(route);
        expect(await overflow(page)).toBeLessThanOrEqual(0);
      });
    }

    test.describe("code boxes and tables", () => {
      test("a wide code block scrolls inside itself and not the page", async ({ page }) => {
        await page.goto(DOC);
        const pre = page.locator("pre", { hasText: "configuration" });
        const box = await pre.evaluate((node) => ({
          scrolls: node.scrollWidth > node.clientWidth,
          overflowX: getComputedStyle(node).overflowX,
          width: node.getBoundingClientRect().width,
        }));
        expect(box.scrolls).toBe(true);
        expect(["auto", "scroll"]).toContain(box.overflowX);
        expect(box.width).toBeLessThanOrEqual(phone.width);
        expect(await overflow(page)).toBeLessThanOrEqual(0);
      });

      test("it can be focused and scrolled with the keyboard", async ({ page }) => {
        await page.goto(DOC);
        const pre = page.locator("pre", { hasText: "configuration" });
        await expect(pre).toHaveAttribute("tabindex", "0");
        await pre.focus();
        await expect(pre).toBeFocused();
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        // Chrome scrolls with a short animation, so wait for it instead of reading at once.
        await expect.poll(() => pre.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
        const ring = await pre.evaluate((node) => getComputedStyle(node).outlineStyle);
        expect(ring).not.toBe("none");
      });

      test("the copy button is a real touch target and never covers the code", async ({ page }) => {
        await page.goto(DOC);
        const block = page.locator(".code-block", { hasText: "configuration" });
        const button = block.getByRole("button", { name: "Copy code" });
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        const code = (await block.locator("pre code").boundingBox())!;
        expect(box.y + box.height).toBeLessThanOrEqual(code.y + 1); // above the first line, not over it
      });

      test("code text stays readable: at least 13px, with a line height that breathes", async ({
        page,
      }) => {
        await page.goto(DOC);
        const style = await page
          .locator("pre code")
          .first()
          .evaluate((node) => {
            const s = getComputedStyle(node);
            return { size: parseFloat(s.fontSize), line: parseFloat(s.lineHeight) };
          });
        expect(style.size).toBeGreaterThanOrEqual(13);
        expect(style.line / style.size).toBeGreaterThanOrEqual(1.5);
      });

      test("a wide table scrolls inside itself and can be focused", async ({ page }) => {
        await page.goto(DOC);
        const table = page.locator("table").first();
        expect(await table.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
        await expect(table).toHaveAttribute("tabindex", "0");
        expect(await overflow(page)).toBeLessThanOrEqual(0);
      });

      test("a long inline code token wraps instead of widening the page", async ({ page }) => {
        await page.goto(DOC);
        const token = page.locator("code", { hasText: "averyvery" });
        expect((await token.boundingBox())!.width).toBeLessThanOrEqual(phone.width);
        expect(await overflow(page)).toBeLessThanOrEqual(0);
      });
    });

    test.describe("touch targets", () => {
      for (const route of [BASE, DOC, `${BASE}examples/`]) {
        test(`${route}: controls are at least 24px, and the main ones 44px`, async ({ page }) => {
          await page.goto(route);
          const small = await page.evaluate(() => {
            const out: string[] = [];
            for (const element of document.querySelectorAll<HTMLElement>(
              "a[href], button, summary, [role=button]",
            )) {
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              if (rect.width === 0 || rect.height === 0 || style.visibility === "hidden") continue;
              if (rect.width <= 1 && rect.height <= 1) continue; // sr-only
              // A link inside a sentence is exempt (WCAG 2.5.8): its parent has text of its own around it.
              if (element.matches("a")) {
                const parent = element.parentElement;
                const around = [...(parent?.childNodes ?? [])].some(
                  (child) => child !== element && child.nodeType === 3 && child.textContent?.trim(),
                );
                if (around || element.closest(".prose-site p, .prose-site li, .prose-site td"))
                  continue;
              }
              if (
                element.closest("[data-skip-link]") ||
                element.textContent?.trim() === "Skip to content"
              )
                continue;
              if (rect.width < 24 || rect.height < 24)
                out.push(
                  `${element.tagName.toLowerCase()} "${(element.textContent || element.getAttribute("aria-label") || "").trim().slice(0, 30)}" is ${Math.round(rect.width)}x${Math.round(rect.height)}`,
                );
            }
            return out;
          });
          expect(small).toEqual([]);
        });
      }

      test("the menu button and the footer links are 44px tall", async ({ page }) => {
        await page.goto(BASE);
        expect(
          (await page.getByRole("button", { name: "Open menu" }).boundingBox())!.height,
        ).toBeGreaterThanOrEqual(44);
        const heights = await page
          .locator("footer nav a")
          .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
        expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
      });

      test("links in the open menu are 44px tall", async ({ page }) => {
        await page.goto(BASE);
        await page.getByRole("button", { name: "Open menu" }).click();
        const heights = await page
          .getByRole("dialog")
          .getByRole("link")
          .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
        expect(heights.length).toBeGreaterThan(0);
        expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
      });
    });

    test("no visible text is smaller than 11px, and body copy is at least 15px", async ({
      page,
    }) => {
      await page.goto(DOC);
      const result = await page.evaluate(() => {
        const tiny: string[] = [];
        const body: string[] = [];
        for (const element of document.querySelectorAll<HTMLElement>("body *")) {
          const own = [...element.childNodes].some(
            (child) => child.nodeType === 3 && child.textContent?.trim(),
          );
          const rect = element.getBoundingClientRect();
          if (!own || rect.width <= 1 || getComputedStyle(element).visibility === "hidden")
            continue;
          const size = parseFloat(getComputedStyle(element).fontSize);
          if (size < 11) tiny.push(`${element.tagName.toLowerCase()} ${size}px`);
          if (element.matches(".prose-site p, .prose-site li") && size < 15)
            body.push(`${element.tagName.toLowerCase()} ${size}px`);
        }
        return { tiny, body };
      });
      expect(result.tiny).toEqual([]);
      expect(result.body).toEqual([]);
    });

    test("the open menu is a labelled dialog that traps focus and returns it on close", async ({
      page,
    }) => {
      await page.goto(BASE);
      const trigger = page.getByRole("button", { name: "Open menu" });
      await trigger.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAccessibleName(/menu/i);
      for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    });
  });
}

test.describe("contrast measured in the browser", () => {
  // Every route, in both themes, at the phone widths and a desktop.
  const VIEWPORTS = [
    { name: "320 wide", width: 320, height: 640 },
    { name: "360 wide", width: 360, height: 740 },
    { name: "390 wide", width: 390, height: 844 },
    { name: "desktop", width: 1440, height: 900 },
  ];
  for (const theme of ["dark", "light"] as const) {
    test.describe(`${theme} theme`, () => {
      test.beforeEach(async ({ page }) => {
        await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      });
      for (const viewport of VIEWPORTS) {
        for (const route of ROUTES) {
          test(`${route} at ${viewport.name}: every text reaches WCAG AA`, async ({ page }) => {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await page.goto(route);
            expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
            const { offenders, checked } = await measureContrast(page);
            expect(checked).toBeGreaterThan(5); // the measurement really looked at text
            expect(offenders).toEqual([]);
          });
        }

        test(`highlighted code at ${viewport.name} reaches AA`, async ({ page }) => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.goto(DOC);
          const { offenders, checked } = await measureContrast(page);
          const count = await page.locator("pre code span").count();
          expect(count).toBeGreaterThan(5);
          expect(checked).toBeGreaterThan(count / 2);
          expect(offenders.filter((offender) => offender.element.startsWith("span"))).toEqual([]);
        });

        // The menu button is hidden from md up, so the open menu only exists at the phone widths.
        if (viewport.width < 768) {
          test(`the open mobile menu at ${viewport.name} reaches AA`, async ({ page }) => {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await page.goto(BASE);
            await page.getByRole("button", { name: "Open menu" }).click();
            await expect(page.getByRole("dialog")).toBeVisible();
            const { offenders } = await measureContrast(page);
            expect(offenders).toEqual([]);
          });
        }
      }
    });
  }

  test("hover and focus states keep the contrast: a hovered card still reaches AA", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE);
    await page.locator("main a.group").first().hover();
    await page.waitForTimeout(300); // let the color transition finish
    const { offenders } = await measureContrast(page);
    expect(offenders).toEqual([]);
  });
});
