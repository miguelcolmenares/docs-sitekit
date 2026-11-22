import { expect, test, type Page } from "@playwright/test";

const origin = `http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4401) + 4}`;
const links = ["Guides", "Examples", "Patterns", "Reference", "Changes"];
test.use({ baseURL: origin });

for (const width of [320, 390])
  for (const fontSize of [16, 32])
    for (const javaScriptEnabled of [true, false]) {
      test(`native fragments stay visible at ${width}px, ${fontSize}px text, JavaScript ${javaScriptEnabled}`, async ({
        browser,
      }) => {
        const context = await browser.newContext({
          javaScriptEnabled,
          viewport: { width, height: 900 },
        });
        try {
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          const route = origin + "/widget/docs/guide/";
          // Default-size cases also exercise a cold direct fragment URL before any deferred module runs.
          await page.goto(route + (fontSize === 16 ? "#advanced" : ""));
          await page.evaluate((size) => {
            document.documentElement.style.fontSize = `${size}px`;
          }, fontSize);
          if (javaScriptEnabled) await settledFonts(page);
          // Same-document URL navigation uses the browser's native fragment placement, without a scripted scroll.
          if (fontSize === 32) await page.goto(route + "#advanced");
          const boxes = await page.evaluate(() => {
            const header = document.querySelector<HTMLElement>("[data-site-header]")!;
            const target = document.getElementById("advanced")!;
            const head = header.getBoundingClientRect();
            const heading = target.getBoundingClientRect();
            const point = document.elementFromPoint(heading.left + 5, heading.top + 5);
            return {
              headerBottom: Math.max(0, head.bottom),
              targetTop: heading.top,
              targetBottom: heading.bottom,
              viewportHeight: innerHeight,
              covered: header.contains(point),
              position: getComputedStyle(header).position,
            };
          });
          expect(boxes.targetTop).toBeGreaterThanOrEqual(boxes.headerBottom);
          expect(boxes.targetBottom).toBeLessThanOrEqual(boxes.viewportHeight);
          expect(boxes.covered).toBe(false);
          if (!javaScriptEnabled) expect(boxes.position).toBe("static");
          expect(errors).toEqual([]);
        } finally {
          await context.close();
        }
      });
    }

test("the first parser-complete frame selects the fitted layout before deferred scripts run", async ({
  page,
}) => {
  const standard = `http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4401)}`;
  let releaseScripts!: () => void;
  const scriptsHeld = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  await page.route("**/*.js", async (route) => {
    await scriptsHeld;
    await route.continue();
  });
  await page.addInitScript(() => {
    const capture = () => {
      // Firefox can invoke rAF while a parsed classic script is still waiting for render-blocking CSS.
      if (document.readyState === "loading") return requestAnimationFrame(capture);
      const header = document.querySelector("[data-site-header]");
      const actions = header?.querySelector("[data-header-actions]");
      if (!header || !actions) return requestAnimationFrame(capture);
      (
        window as unknown as { firstHeaderFrame: { wide: boolean; width: number } }
      ).firstHeaderFrame = {
        wide: header.hasAttribute("data-nav-wide"),
        width: actions.getBoundingClientRect().width,
      };
    };
    requestAnimationFrame(capture);
  });
  try {
    await page.goto(standard + "/widget/docs/", { waitUntil: "commit" });
    await page.waitForFunction(() =>
      Boolean((window as unknown as { firstHeaderFrame?: unknown }).firstHeaderFrame),
    );
    const initial = await page.evaluate(
      () =>
        (window as unknown as { firstHeaderFrame: { wide: boolean; width: number } })
          .firstHeaderFrame,
    );
    expect(initial.width).toBeGreaterThan(0);
    expect(initial.wide).toBe(true);
  } finally {
    releaseScripts();
  }
  await page.waitForLoadState("load");
  await expect(page.locator("[data-site-header]")).toHaveAttribute("data-nav-wide", "");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

async function settledFonts(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

for (const width of [320, 782, 1440]) {
  test(`without JavaScript the same navigation remains reachable at ${width}px`, async ({
    browser,
    browserName,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width, height: 900 },
    });
    try {
      const page = await context.newPage();
      await page.goto(origin + "/widget/");
      const nav = page.getByRole("navigation", { name: "Main", exact: true });
      await expect(nav).toBeVisible();
      await expect(page.getByRole("button", { name: "Open menu", exact: true })).toHaveCount(0);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      const header = page.locator("[data-site-header]");
      for (const name of [...links, "GitHub", "Get started"]) {
        const link = header.getByRole("link", { name, exact: true });
        await expect(link).toBeVisible();
        for (
          let step = 0;
          step < 20 && !(await link.evaluate((element) => element === document.activeElement));
          step++
        ) {
          // macOS Safari reserves plain Tab for controls; Option+Tab includes native links.
          await page.keyboard.press(
            browserName === "webkit" && process.platform === "darwin" ? "Alt+Tab" : "Tab",
          );
        }
        await expect(link).toBeFocused();
      }
      await nav.getByRole("link", { name: "Reference", exact: true }).press("Enter");
      await expect(page).toHaveURL(origin + "/widget/reference/");
    } finally {
      await context.close();
    }
  });
}

for (const width of [320, 390, 782, 1024, 1440]) {
  test(`the packed header fits ${width}px and preserves every destination`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/widget/");
    await settledFonts(page);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    const trigger = page.getByRole("button", { name: "Open menu", exact: true });
    if (await trigger.isVisible()) {
      await trigger.focus();
      await page.keyboard.press("Enter");
      const menu = page.getByRole("dialog", { name: "Menu", exact: true });
      await expect(menu).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Main", exact: true })).toHaveCount(0);
      for (const label of links)
        await expect(menu.getByRole("link", { name: label, exact: true })).toBeVisible();
      await expect(menu.getByRole("link", { name: "GitHub", exact: true })).toBeVisible();
      await expect(menu.getByRole("link", { name: "Get started", exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await expect(trigger).toBeFocused();
      await trigger.press("Enter");
      await menu.getByRole("link", { name: "Reference", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(origin + "/widget/reference/");
    } else {
      const nav = page.getByRole("navigation", { name: "Main", exact: true });
      for (const label of links)
        await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
      for (const target of await page
        .locator("[data-site-header] nav a, [data-header-wide-action]")
        .all()) {
        expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await nav.getByRole("link", { name: "Reference", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(origin + "/widget/reference/");
    }
  });
}

test("resize preserves an open collapsed menu, then transfers focus to the inline destination", async ({
  page,
}) => {
  const standard = `http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4401)}`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(standard + "/widget/");
  await settledFonts(page);
  const nav = page.getByRole("navigation", { name: "Main", exact: true });
  const link = nav.getByRole("link").first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  await link.focus();
  await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page.getByRole("button", { name: "Open menu", exact: true });
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  const menu = page.getByRole("dialog", { name: "Menu", exact: true });
  const destination = menu.locator(`a[href="${href}"]`).first();
  await destination.focus();
  await page.setViewportSize({ width: 782, height: 844 });
  await expect(menu).toBeVisible();
  await expect(destination).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(menu).toBeHidden();
  await expect(link).toBeFocused();
});

test("larger fonts and changed labels remeasure the row without a resize or observer loop", async ({
  page,
}) => {
  const standard = `http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4401)}`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(standard + "/widget/");
  await settledFonts(page);
  const header = page.locator("[data-site-header]");
  await expect(header).toHaveAttribute("data-nav-wide", "");
  await page.evaluate(() => document.documentElement.style.setProperty("font-size", "32px"));
  await expect(header).not.toHaveAttribute("data-nav-wide");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.evaluate(() => document.documentElement.style.removeProperty("font-size"));
  await expect(header).toHaveAttribute("data-nav-wide", "");
  await page.evaluate(() => {
    const name = document.querySelector<HTMLElement>("[data-header-brand] span")!;
    name.textContent =
      "A Practical Atlas for Independent Research and Detailed Technical Reference";
  });
  await expect(header).not.toHaveAttribute("data-nav-wide");
  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await expect(page.locator("[data-header-brand]")).toHaveText(
    "A Practical Atlas for Independent Research and Detailed Technical Reference",
  );
  await settledFonts(page);
  const changes = await header.evaluate(async (element) => {
    let count = 0;
    const observer = new MutationObserver((records) => {
      count += records.length;
    });
    observer.observe(element, {
      attributes: true,
      attributeFilter: ["data-nav-wide", "data-nav-measuring"],
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    observer.disconnect();
    return count;
  });
  expect(changes).toBe(0);
});

test("a font that finishes loading can collapse an already fitted inline row", async ({ page }) => {
  const standard = `http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4401)}`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(standard + "/widget/");
  await settledFonts(page);
  const header = page.locator("[data-site-header]");
  await expect(header).toHaveAttribute("data-nav-wide", "");
  const status = await page.evaluate(async () => {
    const source = performance
      .getEntriesByType("resource")
      .find((entry) => /geist-latin-wght-normal.*\.woff2/.test(entry.name));
    if (!source) throw new Error("The bundled header font was not loaded");
    const url = new URL(source.name);
    url.searchParams.set("navigation-font-metrics", "1");
    const descriptors: FontFaceDescriptors & { sizeAdjust: string } = { sizeAdjust: "200%" };
    const font = new FontFace("Navigation Font Metrics", `url("${url}")`, descriptors);
    document.fonts.add(font);
    document.querySelector<HTMLElement>("[data-site-header]")!.style.fontFamily =
      '"Navigation Font Metrics", sans-serif';
    await font.load();
    return font.status;
  });
  expect(status).toBe("loaded");
  await expect(header).not.toHaveAttribute("data-nav-wide");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test("a 320px header keeps every control within the page at twice the text size", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/widget/");
  await page.evaluate(() => document.documentElement.style.setProperty("font-size", "32px"));
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  for (const name of ["Search", "Open menu"])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  const trigger = page.getByRole("button", { name: "Open menu", exact: true });
  await trigger.focus();
  await trigger.press("Enter");
  const menu = page.getByRole("dialog", { name: "Menu", exact: true });
  await expect(menu).toBeVisible();
  for (const label of links)
    await expect(menu.getByRole("link", { name: label, exact: true })).toBeVisible();
});
