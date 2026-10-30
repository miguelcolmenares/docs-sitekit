import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { measureContrast } from "../support/contrast";

// The docs index of the generated site has four cards. The pages carry tags in their frontmatter (see
// verify-package): Setup on the overview and on Getting started, Guide on Getting started and on Guide,
// Reference on Guide and on Callouts, Markdown on Callouts, and two long tags on Guide to test wrapping.
const BASE = "/widget/";
const INDEX = `${BASE}docs/`;
const TOTAL = 4;
const LONG_TAG = "Averyveryveryveryveryveryveryveryveryveryverylongtagwithnospaces";
const PHONES = [
  { name: "320 wide", width: 320, height: 640 },
  { name: "360 wide", width: 360, height: 740 },
  { name: "390 wide", width: 390, height: 844 },
];

const cards = (page: Page) => page.locator("a[data-filter-item]");
const visibleTitles = (page: Page) =>
  cards(page).evaluateAll((nodes) =>
    nodes
      .filter((node) => !(node as HTMLElement).hidden)
      .map((node) => node.querySelector("h3")!.textContent),
  );
const tag = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const field = (page: Page) => page.getByRole("searchbox", { name: "Filter by text" });
const status = (page: Page) => page.getByRole("status").filter({ hasText: "shown" });
const clear = (page: Page) => page.getByRole("button", { name: "Clear filter" });
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("without JavaScript", () => {
  test("every card is there and the bar is not", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(INDEX);
    await expect(page.locator("[data-catalog-filter]")).toBeHidden();
    await expect(page.locator("[data-catalog-filter]")).toHaveAttribute("hidden", "");
    await expect(cards(page)).toHaveCount(TOTAL);
    for (const card of await cards(page).all()) await expect(card).toBeVisible();
    await context.close();
  });

  test("a catalog without tags has no bar at all", async ({ page }) => {
    await page.goto(`${BASE}tutorials/`);
    await expect(page.locator("[data-catalog-filter]")).toHaveCount(0);
    await expect(page.locator("[data-filter-item]")).toHaveCount(0);
  });
});

test.describe("the bar", () => {
  test("shows a labelled field, one toggle button per tag and a polite status line", async ({
    page,
  }) => {
    await page.goto(INDEX);
    await expect(field(page)).toBeVisible();
    await expect(page.getByRole("group", { name: "Filter by tag" })).toBeVisible();
    for (const name of ["Setup", "Guide", "Reference", "Markdown"]) {
      await expect(tag(page, name)).toHaveAttribute("aria-pressed", "false");
    }
    const line = status(page);
    await expect(line).toHaveText(`${TOTAL} of ${TOTAL} shown.`);
    await expect(line).toHaveAttribute("aria-live", "polite");
    await expect(clear(page)).toBeHidden();
  });

  test("a tag narrows the cards, hides the group with none left, and a second tag narrows more", async ({
    page,
  }) => {
    await page.goto(INDEX);
    await tag(page, "Setup").click();
    await expect(tag(page, "Setup")).toHaveAttribute("aria-pressed", "true");
    await expect(status(page)).toHaveText(`2 of ${TOTAL} shown.`);
    expect((await visibleTitles(page)).sort()).toEqual(["Getting started", "Widget documentation"]);
    // A card that does not match has the hidden attribute, and is not rendered.
    await expect(cards(page).filter({ hasText: "Callouts" })).toHaveAttribute("hidden", "");
    await expect(cards(page).filter({ hasText: "Callouts" })).toBeHidden();
    // The "Use" group has Guide and Callouts, so it goes with its heading.
    await expect(page.getByRole("heading", { name: "Use", exact: true })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Start", exact: true })).toBeVisible();

    await tag(page, "Guide").click();
    await expect(status(page)).toHaveText(`1 of ${TOTAL} shown.`);
    expect(await visibleTitles(page)).toEqual(["Getting started"]);

    await tag(page, "Setup").click();
    await expect(tag(page, "Setup")).toHaveAttribute("aria-pressed", "false");
    expect((await visibleTitles(page)).sort()).toEqual(["Getting started", "Guide"]);
  });

  test("the field narrows by words in the title, description or tags, in any order", async ({
    page,
  }) => {
    await page.goto(INDEX);
    await field(page).fill("callout");
    expect(await visibleTitles(page)).toEqual(["Callouts"]);
    await expect(status(page)).toHaveText(`1 of ${TOTAL} shown.`);
    await field(page).fill("markdown NOTES");
    expect(await visibleTitles(page)).toEqual(["Callouts"]);
    await field(page).fill("");
    await expect(status(page)).toHaveText(`${TOTAL} of ${TOTAL} shown.`);
  });

  test("a state with no match says so and offers to clear it", async ({ page }) => {
    await page.goto(INDEX);
    await field(page).fill("nothing like this");
    await expect(status(page)).toHaveText(`Nothing matches this filter. 0 of ${TOTAL} shown.`);
    expect(await visibleTitles(page)).toEqual([]);
    await expect(clear(page)).toBeVisible();
    await clear(page).click();
    await expect(status(page)).toHaveText(`${TOTAL} of ${TOTAL} shown.`);
    await expect(field(page)).toHaveValue("");
    await expect(field(page)).toBeFocused();
    await expect(clear(page)).toBeHidden();
    expect(new URL(page.url()).search).toBe("");
  });
});

test.describe("the address", () => {
  test("holds the tags and the text", async ({ page }) => {
    await page.goto(INDEX);
    await tag(page, "Reference").click();
    expect(new URL(page.url()).search).toBe("?tag=reference");
    await field(page).fill("markdown");
    await expect(status(page)).toHaveText(`1 of ${TOTAL} shown.`);
    expect(new URL(page.url()).search).toBe("?tag=reference&q=markdown");
  });

  test("loading an address shows the filtered view, with the controls in the same state", async ({
    page,
  }) => {
    await page.goto(`${INDEX}?tag=reference&q=markdown`);
    expect(await visibleTitles(page)).toEqual(["Callouts"]);
    await expect(tag(page, "Reference")).toHaveAttribute("aria-pressed", "true");
    await expect(tag(page, "Setup")).toHaveAttribute("aria-pressed", "false");
    await expect(field(page)).toHaveValue("markdown");
    await expect(status(page)).toHaveText(`1 of ${TOTAL} shown.`);
    await expect(clear(page)).toBeVisible();
  });

  test("a tag that no card has narrows to nothing, and clear is the way out", async ({ page }) => {
    await page.goto(`${INDEX}?tag=nope`);
    expect(await visibleTitles(page)).toEqual([]);
    await expect(status(page)).toContainText("Nothing matches");
    await clear(page).click();
    expect(await visibleTitles(page)).toHaveLength(TOTAL);
  });

  test("the back button undoes a tag, and forward does it again", async ({ page }) => {
    await page.goto(INDEX);
    await tag(page, "Setup").click();
    await tag(page, "Guide").click();
    await expect(status(page)).toHaveText(`1 of ${TOTAL} shown.`);
    await page.goBack();
    await expect(status(page)).toHaveText(`2 of ${TOTAL} shown.`);
    expect(new URL(page.url()).search).toBe("?tag=setup");
    await expect(tag(page, "Guide")).toHaveAttribute("aria-pressed", "false");
    await page.goBack();
    await expect(status(page)).toHaveText(`${TOTAL} of ${TOTAL} shown.`);
    await expect(tag(page, "Setup")).toHaveAttribute("aria-pressed", "false");
    await page.goForward();
    await expect(tag(page, "Setup")).toHaveAttribute("aria-pressed", "true");
  });

  test("typing does not add a history entry per letter", async ({ page }) => {
    await page.goto(INDEX);
    await field(page).pressSequentially("guide");
    await expect(status(page)).toContainText("shown");
    await page.goBack();
    expect(new URL(page.url()).pathname).not.toBe(INDEX);
  });
});

test.describe("keyboard and touch", () => {
  test("tag buttons work with the keyboard and show a focus ring", async ({ page }) => {
    await page.goto(INDEX);
    await field(page).focus();
    await page.keyboard.press("Tab");
    const first = page.locator("[data-filter-tag]").first();
    await expect(first).toBeFocused();
    const ring = await first.evaluate((node) => {
      const style = getComputedStyle(node);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(ring.style).not.toBe("none");
    expect(ring.width).toBeGreaterThanOrEqual(2);
    await page.keyboard.press("Space");
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("aria-pressed", "false");
  });

  for (const phone of PHONES) {
    test.describe(phone.name, () => {
      test.use({ viewport: { width: phone.width, height: phone.height } });

      test("every control is at least 44 px, and nothing scrolls sideways", async ({ page }) => {
        await page.goto(`${INDEX}?q=zzz`);
        const controls = page.locator(
          "[data-filter-tag], [data-filter-clear], [data-filter-input]",
        );
        const boxes = await controls.evaluateAll((nodes) =>
          nodes.map((node) => {
            const box = node.getBoundingClientRect();
            return { name: node.textContent || node.id, width: box.width, height: box.height };
          }),
        );
        expect(boxes.length).toBeGreaterThanOrEqual(6);
        for (const box of boxes) {
          expect(box.height, box.name).toBeGreaterThanOrEqual(44);
          expect(box.width, box.name).toBeGreaterThanOrEqual(44);
        }
        expect(await overflow(page)).toBeLessThanOrEqual(0);
      });

      test("a tag of many words and a tag with no spaces stay inside the page", async ({
        page,
      }) => {
        await page.goto(INDEX);
        const long = tag(page, LONG_TAG);
        await expect(long).toBeVisible();
        const box = (await long.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(phone.width);
        await long.click();
        expect(await visibleTitles(page)).toEqual(["Guide"]);
        expect(await overflow(page)).toBeLessThanOrEqual(0);
      });
    });
  }
});

test.describe("no layout shift", () => {
  test("showing the bar moves nothing, and filtering does not move the bar", async ({ page }) => {
    // Layout shifts caused by the bar or the cards, from the first byte of the page.
    await page.addInitScript(() => {
      const shifts: { value: number }[] = [];
      (window as unknown as { __shifts: typeof shifts }).__shifts = shifts;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as {
          value: number;
          hadRecentInput: boolean;
          sources?: { node: Node | null }[];
        }[]) {
          const touched = (entry.sources ?? []).some((source) => {
            const element =
              source.node instanceof Element ? source.node : source.node?.parentElement;
            return element?.closest(
              "[data-catalog-filter], [data-filter-group], a[data-filter-item]",
            );
          });
          if (touched && !entry.hadRecentInput) shifts.push({ value: entry.value });
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(INDEX);
    await expect(status(page)).toHaveText(`${TOTAL} of ${TOTAL} shown.`);
    await page.waitForTimeout(500);
    const shifts = await page.evaluate(
      () => (window as unknown as { __shifts: { value: number }[] }).__shifts,
    );
    expect(shifts.reduce((sum, shift) => sum + shift.value, 0)).toBeLessThan(0.001);

    const before = await field(page).boundingBox();
    await tag(page, "Setup").click();
    await expect(status(page)).toHaveText(`2 of ${TOTAL} shown.`);
    const after = await field(page).boundingBox();
    expect(after!.y).toBe(before!.y);
  });
});

test.describe("contrast and accessibility", () => {
  for (const theme of ["dark", "light"] as const) {
    test.describe(`${theme} theme`, () => {
      test.beforeEach(async ({ page }) => {
        await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
        // No transition, so the colors measured are the end colors of each state.
        await page.emulateMedia({ reducedMotion: "reduce" });
      });

      test("every state of the bar passes AA: default, hover, pressed, pressed and hovered, focus", async ({
        page,
      }) => {
        await page.goto(`${INDEX}?tag=guide&q=zzz`);
        expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
        const states: Record<string, () => Promise<void>> = {
          "default and pressed": async () => {},
          "hover on a button that is not pressed": () => tag(page, "Setup").hover(),
          "hover on a pressed button": () => tag(page, "Guide").hover(),
          "hover on clear": () => clear(page).hover(),
          focus: async () => {
            await page.mouse.move(0, 0);
            await tag(page, "Reference").focus();
            await page.keyboard.press("Shift+Tab");
            await page.keyboard.press("Tab");
          },
        };
        for (const [name, enter] of Object.entries(states)) {
          await enter();
          const { offenders, checked } = await measureContrast(page);
          expect(checked, name).toBeGreaterThan(5);
          expect(offenders, name).toEqual([]);
        }
      });

      test("axe finds no serious problem in the bar", async ({ page }) => {
        await page.goto(`${INDEX}?tag=guide`);
        const results = await new AxeBuilder({ page })
          .include("[data-catalog-filter]")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(
          results.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`),
        ).toEqual([]);
      });
    });
  }
});
