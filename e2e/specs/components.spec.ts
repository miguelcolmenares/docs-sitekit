import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PAGES } from "../../template/src/examples/catalog";
import { measureContrast } from "../support/contrast";

// The pages of the components belong to the documentation site of this project, which verify-package builds from the
// template folder and the config serves on the port after the one of the generated site.
const OWN = `http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4401) + 1}`;
const BASE = "/docs-sitekit";
const TEMPLATE = join(import.meta.dirname, "..", "..", "template");
const props = JSON.parse(
  readFileSync(join(TEMPLATE, "src", "examples", "props.json"), "utf8"),
) as Record<string, { label: string; rows: unknown[] }[]>;
const registry = JSON.parse(readFileSync(join(TEMPLATE, "registry.json"), "utf8")) as {
  components: Record<string, { requires: string[] }>;
};

test.use({ baseURL: OWN });

const url = (name: string) => `${BASE}/components/${name}/`;
const exampleText = (name: string, id: string) =>
  readFileSync(join(TEMPLATE, "src", "examples", name, `${id}.astro`), "utf8");
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
// A button has a color transition: the colors are read when it has ended, not on the way.
const settle = (page: Page) =>
  page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
const blocks = (page: Page) => page.locator("[data-example]");
const tab = (block: Locator, name: "Preview" | "Code") => block.getByRole("tab", { name });

const STORY = PAGES.find((page) => page.name === "stat-row")!;

test.describe("the index of the components", () => {
  test("links every page, and every link works", async ({ page, request }) => {
    await page.goto(`${BASE}/docs/components/`);
    for (const { name } of PAGES) {
      await expect(page.locator(`main a[href="${url(name)}"]`).first()).toBeVisible();
      expect((await request.get(url(name))).status()).toBe(200);
    }
  });

  test("has a heading for each entry that has no page, and the pages link to it", async ({
    page,
  }) => {
    const without = Object.keys(registry.components).filter(
      (name) => !PAGES.some((p) => p.name === name),
    );
    await page.goto(`${BASE}/docs/components/`);
    for (const name of without) await expect(page.locator(`main h3#${name}`)).toHaveCount(1);
  });
});

for (const spec of PAGES) {
  test.describe(`the page of ${spec.title}`, () => {
    test("has its title, a preview and the code of one example, the add command, its tables and its variants", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
      await page.goto(url(spec.name));
      // A preview of Hero or of SectionHeader as a page heading holds an h1 of its own, so the title is the one of the article.
      await expect(page.locator("article > h1")).toHaveText(spec.title);
      await expect(blocks(page)).toHaveCount(1 + spec.variants.length);
      // The command of the add section: the text is in the page before the script runs.
      await expect(
        page.locator("main code", { hasText: `npx docs-sitekit add ${spec.name}` }).first(),
      ).toBeVisible();
      // One table of props per table of the catalog, with the rows the generated file has.
      const tables = props[spec.name]!;
      for (const table of tables) {
        const region = page.getByRole("region", { name: table.label });
        await expect(region.locator("tbody tr")).toHaveCount(table.rows.length);
      }
      for (const variant of spec.variants)
        await expect(page.locator(`h3#variant-${variant.id}`)).toHaveText(variant.title);
      // Each entry that the component requires is a link to its page, or to its place in the index.
      for (const required of registry.components[spec.name]!.requires) {
        const target = PAGES.some((p) => p.name === required)
          ? url(required)
          : `${BASE}/docs/components/#${required}`;
        await expect(page.locator(`#add ~ ul a[href="${target}"]`)).toHaveCount(1);
      }
      expect(errors).toEqual([]);
    });

    test("shows the text of its example files in the code panels, and the copy button copies exactly that", async ({
      page,
      context,
    }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.goto(url(spec.name));
      const ids = ["example", ...spec.variants.map((variant) => variant.id)];
      const all = blocks(page);
      for (let at = 0; at < ids.length; at += 1) {
        const block = all.nth(at);
        await tab(block, "Code").click();
        const code = block.locator('[role="tabpanel"][aria-label="Code"] code');
        const expected = exampleText(spec.name, ids[at]!).replace(/\n$/, "");
        expect(await code.evaluate((node) => node.textContent)).toBe(expected);
        await block.getByRole("button", { name: "Copy code" }).click();
        await expect(block.locator(".code-status")).toHaveText("Copied");
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
      }
    });

    for (const width of [320, 360, 390, 1280]) {
      test(`does not scroll sideways at ${width}px, with the preview or with the code`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(url(spec.name));
        expect(await overflow(page)).toBeLessThanOrEqual(0);
        for (const block of await blocks(page).all()) await tab(block, "Code").click();
        expect(await overflow(page)).toBeLessThanOrEqual(0);
      });
    }

    for (const theme of ["dark", "light"] as const) {
      for (const width of [320, 1280]) {
        test(`all its text reaches WCAG AA in the ${theme} theme at ${width}px, in the preview, in the other theme and in the code`, async ({
          page,
        }) => {
          await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
          await page.setViewportSize({ width, height: 900 });
          await page.goto(url(spec.name));
          expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
          const preview = await measureContrast(page);
          expect(preview.checked).toBeGreaterThan(20);
          expect(preview.offenders).toEqual([]);
          for (const toggle of await page
            .getByRole("button", { name: /^Preview in the (dark|light) theme$/ })
            .all()) {
            await toggle.click();
          }
          await settle(page);
          expect((await measureContrast(page)).offenders).toEqual([]);
          for (const block of await blocks(page).all()) await tab(block, "Code").click();
          await settle(page);
          expect((await measureContrast(page)).offenders).toEqual([]);
        });
      }
    }

    test("keeps its controls at 44 px on a phone, and every control of a preview at 24 px or more", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 900 });
      await page.goto(url(spec.name));
      const high = (locator: Locator) =>
        locator.evaluateAll((nodes) =>
          nodes
            .map((node) => node.getBoundingClientRect())
            .filter((r) => r.width > 0 && r.height > 0)
            .map((r) => Math.round(r.height)),
        );
      for (const height of await high(
        page.locator("[data-example] [role=tab], [data-example] [data-example-theme]"),
      )) {
        expect(height).toBeGreaterThanOrEqual(44);
      }
      // A link inside a sentence is exempt, as in the rules of the kit: its parent holds text besides the link.
      const stage = await page
        .locator("[data-example-stage] :is(a, button, input, select, textarea)")
        .evaluateAll((nodes) =>
          nodes
            .filter(
              (node) =>
                node.tagName !== "A" ||
                node.parentElement?.textContent?.trim() === node.textContent?.trim(),
            )
            .map((node) => Math.round(node.getBoundingClientRect().height))
            .filter((height) => height > 0),
        );
      for (const height of stage) expect(height).toBeGreaterThanOrEqual(24);
      for (const block of await blocks(page).all()) await tab(block, "Code").click();
      for (const height of await high(page.locator("[data-example] .copy-code")))
        expect(height).toBeGreaterThanOrEqual(44);
    });
  });
}

test.describe("the tabs", () => {
  const first = (page: Page) => blocks(page).first();

  test("are a tab list with aria-selected, a roving tabindex and panels that belong to them", async ({
    page,
  }) => {
    await page.goto(url(STORY.name));
    const block = first(page);
    await expect(block.getByRole("tablist")).toHaveCount(1);
    await expect(tab(block, "Preview")).toHaveAttribute("aria-selected", "true");
    await expect(tab(block, "Code")).toHaveAttribute("aria-selected", "false");
    await expect(tab(block, "Preview")).toHaveAttribute("tabindex", "0");
    await expect(tab(block, "Code")).toHaveAttribute("tabindex", "-1");
    for (const name of ["Preview", "Code"] as const) {
      const controls = await tab(block, name).getAttribute("aria-controls");
      await expect(page.locator(`#${controls}`)).toHaveAttribute("role", "tabpanel");
    }
    await expect(block.getByRole("tabpanel", { name: "Preview" })).toBeVisible();
    await expect(block.getByRole("tabpanel", { name: "Code" })).toBeHidden();
  });

  test("move with the arrow keys, Home and End, and select as they go", async ({ page }) => {
    await page.goto(url(STORY.name));
    const block = first(page);
    await tab(block, "Preview").focus();
    await page.keyboard.press("ArrowRight");
    await expect(tab(block, "Code")).toBeFocused();
    await expect(tab(block, "Code")).toHaveAttribute("aria-selected", "true");
    await expect(block.getByRole("tabpanel", { name: "Code" })).toBeVisible();
    await expect(block.getByRole("tabpanel", { name: "Preview" })).toBeHidden();
    await page.keyboard.press("ArrowRight");
    await expect(tab(block, "Preview")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tab(block, "Code")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(tab(block, "Preview")).toBeFocused();
    await page.keyboard.press("End");
    await expect(tab(block, "Code")).toBeFocused();
    await expect(tab(block, "Code")).toHaveAttribute("tabindex", "0");
    await expect(tab(block, "Preview")).toHaveAttribute("tabindex", "-1");
  });

  test("show both panels one after the other without JavaScript, with no tab bar", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${OWN}${url(STORY.name)}`);
    const block = first(page);
    await expect(block.locator("[data-example-bar]")).toBeHidden();
    await expect(block.getByRole("tabpanel", { name: "Preview" })).toBeVisible();
    await expect(block.getByRole("tabpanel", { name: "Code" })).toBeVisible();
    const preview = await block.getByRole("tabpanel", { name: "Preview" }).boundingBox();
    const code = await block.getByRole("tabpanel", { name: "Code" }).boundingBox();
    expect(code!.y).toBeGreaterThan(preview!.y + preview!.height - 1);
    await context.close();
  });

  test("keep the focus ring of the site", async ({ page }) => {
    await page.goto(url(STORY.name));
    await tab(first(page), "Preview").focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    const ring = await tab(first(page), "Preview").evaluate((node) => {
      const style = getComputedStyle(node);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(ring.style).not.toBe("none");
    expect(ring.width).toBeGreaterThanOrEqual(2);
  });
});

test.describe("the switch to the other theme", () => {
  for (const theme of ["dark", "light"] as const) {
    const other = theme === "dark" ? "light" : "dark";
    test(`shows the preview in the ${other} theme on a ${theme} page, and back`, async ({
      page,
    }) => {
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await page.goto(url(STORY.name));
      const block = blocks(page).first();
      const stage = block.locator("[data-example-stage]");
      const toggle = block.getByRole("button", { name: `Preview in the ${other} theme` });
      const background = () => stage.evaluate((node) => getComputedStyle(node).backgroundColor);
      const same = await background();
      await expect(stage).not.toHaveAttribute("data-preview-theme");
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await expect(stage).toHaveAttribute("data-preview-theme", other);
      const shown = await background();
      expect(shown).not.toBe(same);
      // A light card is light, a dark one dark: the background is read from the tokens of the theme.
      const lightness = (css: string) =>
        css
          .match(/\d+/g)!
          .slice(0, 3)
          .map(Number)
          .reduce((a, b) => a + b, 0);
      expect(lightness(shown) > lightness(same)).toBe(other === "light");
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
      await toggle.click();
      await expect(stage).not.toHaveAttribute("data-preview-theme");
      expect(await background()).toBe(same);
    });
  }

  test("follows the switch of the header while it is on, and is only there for the preview", async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await page.goto(url(STORY.name));
    const block = blocks(page).first();
    const stage = block.locator("[data-example-stage]");
    await block.getByRole("button", { name: "Preview in the light theme" }).click();
    await expect(stage).toHaveAttribute("data-preview-theme", "light");
    await page.locator("header [data-theme-switch]").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(stage).toHaveAttribute("data-preview-theme", "dark");
    await expect(block.getByRole("button", { name: "Preview in the dark theme" })).toBeVisible();
    await tab(block, "Code").click();
    await expect(block.getByRole("button", { name: /Preview in the/ })).toBeHidden();
  });
});

test.describe("the examples", () => {
  test("a long line of code scrolls inside its block, not the page, with the tab bar in place", async ({
    page,
  }) => {
    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url("site-footer"));
      const block = blocks(page).first();
      await tab(block, "Code").click();
      const pre = block.locator("pre");
      const box = await pre.evaluate((node) => ({
        scrolls: node.scrollWidth > node.clientWidth,
        right: node.getBoundingClientRect().right,
        tabindex: node.getAttribute("tabindex"),
      }));
      expect(box.scrolls).toBe(true);
      expect(box.right).toBeLessThanOrEqual(width);
      expect(box.tabindex).toBe("0");
      await expect(block.getByRole("tablist")).toBeVisible();
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    }
  });

  test("the live filter of its preview works, and the side card collapses on a phone", async ({
    page,
  }) => {
    await page.goto(url("catalog-filter"));
    const block = blocks(page).first();
    await block.getByRole("button", { name: "Design" }).click();
    await expect(block.getByRole("status")).toHaveText("1 of 3 shown.");
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(url("side-card"));
    const toggle = page.getByRole("button", { name: "All details" }).first();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  test("the command box of a preview copies its command", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(url("command-box"));
    await blocks(page)
      .first()
      .getByRole("button", { name: "Copy command: npx docs-sitekit add stat-row" })
      .click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "npx docs-sitekit add stat-row",
    );
  });

  test("a page makes no request to another host", async ({ page }) => {
    const outside: string[] = [];
    page.on("request", (request) => {
      if (!request.url().startsWith(OWN) && !request.url().startsWith("data:"))
        outside.push(request.url());
    });
    for (const name of ["button", "hero", "command-box", "catalog-filter"]) {
      await page.goto(url(name));
      await page.waitForLoadState("networkidle");
    }
    expect(outside).toEqual([]);
  });

  test("passes the serious and critical rules of axe on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    for (const name of ["button", "stat-row", "reference-table", "catalog-filter", "item-card"]) {
      await page.goto(url(name));
      const results = await new AxeBuilder({ page }).include("main").analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect({ name, ids: serious.map((violation) => violation.id) }).toEqual({ name, ids: [] });
    }
  });
});
