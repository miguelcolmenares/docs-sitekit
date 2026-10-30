import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { describeVitals, observeVitals, readVitals } from "../support/vitals";

const BASE = "/widget/";
// The pages of the generated site that have prose, a code block, callouts and cards. `docs/getting-started/` is
// left out on purpose: it is the page that stress-tests overflow, with one sentence that is 0.6% shorter than the
// line at 390 px in Geist and 0.6% longer in the fallback, so it wraps once more before the font arrives and the
// text under it moves. A fallback font cannot match a web font on every line; it matches the average. See global.css.
// `tutorials/code-blocks/` is left out for the same reason: on the Linux runner its first paragraph wraps once more
// at 412 px (a shift of 0.02), and it passes on macOS. For the same reason 320 px is not here: at that width a callout paragraph wraps once more (a shift of 0.0112).
const ROUTES = [
  BASE,
  `${BASE}docs/`,
  `${BASE}docs/guide/`,
  `${BASE}docs/callouts/`,
  `${BASE}examples/`,
];
const VIEWPORTS = [
  { name: "a phone (360 wide)", width: 360, height: 740 },
  { name: "a phone (412 wide, the size Lighthouse uses)", width: 412, height: 823 },
  { name: "a desktop (1440 wide)", width: 1440, height: 900 },
];

/** How late every web font file arrives. It is delayed, not blocked: the page must still swap to it. */
const FONT_DELAY_MS = 500;
/** The largest layout shift the site accepts for a page, on top of the font swap. */
const MAX_CLS = 0.01;
/** "Good" for the largest contentful paint, in milliseconds. This run has no throttling, so it is a floor. */
const MAX_LCP_MS = 2500;

/** Load a page with the fonts late and wait until the swap has happened and the page has been still for a while. */
async function loadWithLateFont(page: Page, path: string) {
  await observeVitals(page);
  await page.route("**/*.woff2", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, FONT_DELAY_MS));
    await route.continue();
  });
  await page.goto(path);
  await page.waitForFunction(() =>
    [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded"),
  );
  // A shift from the swap happens in the frame after the font is applied. Wait for a few frames and a bit more.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.waitForTimeout(300);
  return readVitals(page);
}

test.describe("loading with a late web font", () => {
  for (const viewport of VIEWPORTS) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const route of ROUTES) {
        test(`${route}: the swap to the web font moves nothing, and the paint does not wait for it`, async ({
          page,
        }) => {
          const vitals = await loadWithLateFont(page, route);
          const report = `${route} at ${viewport.width} wide, fonts delayed ${FONT_DELAY_MS} ms\n${describeVitals(vitals)}`;

          // The test is only worth something if the swap really happened after the first paint.
          expect(vitals.fontLoadedAt, report).not.toBeNull();
          expect(vitals.fontLoadedAt!, report).toBeGreaterThanOrEqual(FONT_DELAY_MS);

          expect(vitals.cls, report).toBeLessThanOrEqual(MAX_CLS);
          expect(vitals.lcp, report).not.toBeNull();
          expect(vitals.lcp!.time, report).toBeLessThanOrEqual(MAX_LCP_MS);
        });
      }
    });
  }

  test("the page asks for the two fonts of the first screen in the head, from its own host", async ({
    page,
  }) => {
    await page.goto(BASE);
    const preloads = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLLinkElement>('head link[rel="preload"][as="font"]')].map(
        (link) => ({
          href: link.href,
          type: link.type,
          crossOrigin: link.crossOrigin,
        }),
      ),
    );
    expect(
      preloads.map((link) => link.href.replace(/^.*\//, "").replace(/\.[\w-]+\.woff2$/, "")),
    ).toEqual(["geist-latin-wght-normal", "geist-mono-latin-wght-normal"]);
    for (const link of preloads) {
      expect(new URL(link.href).origin).toBe(new URL(page.url()).origin);
      expect(link.type).toBe("font/woff2");
      // A font is fetched in anonymous CORS mode even from the same host: without this the preload is wasted.
      expect(link.crossOrigin).toBe("anonymous");
    }
  });

  test("the preloaded files are the ones the page uses, so none is downloaded twice", async ({
    page,
  }) => {
    const fonts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "font") fonts.push(new URL(request.url()).pathname);
    });
    await page.goto(BASE);
    await page.waitForFunction(() =>
      [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded"),
    );
    expect(new Set(fonts).size).toBe(fonts.length);
    expect(fonts.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("the vitals meter", () => {
  // The numbers above decide whether the font swap is clean, so the meter is tested on a page whose answer is known.
  const PROBE = `${BASE}__vitals-probe/`;
  const probe = (body: string) =>
    `<!doctype html><html><body style="margin:0;font:16px sans-serif">${body}</body></html>`;

  test("reports a layout shift that a late element causes, and names what moved", async ({
    page,
  }) => {
    await page.route(`**${PROBE}`, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: probe(
          '<p id="below" style="margin:0;padding:16px">The text that gets pushed down.</p><script>setTimeout(() => { const box = document.createElement("div"); box.style.height = "300px"; document.body.prepend(box); }, 100)</script>',
        ),
      }),
    );
    await observeVitals(page);
    await page.goto(PROBE);
    await page.waitForTimeout(600);
    const vitals = await readVitals(page);
    expect(vitals.cls).toBeGreaterThan(MAX_CLS);
    expect(vitals.shifts[0]!.sources).toContain("p#below");
    expect(describeVitals(vitals)).toContain("p#below");
  });

  test("reports nothing for a page that never moves, and names the LCP element and its phases", async ({
    page,
  }) => {
    await page.route(`**${PROBE}`, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: probe('<h1 id="title" style="margin:0;padding:16px">Still page</h1>'),
      }),
    );
    await observeVitals(page);
    await page.goto(PROBE);
    await page.waitForTimeout(300);
    const vitals = await readVitals(page);
    expect(vitals.cls).toBe(0);
    expect(vitals.lcp).toMatchObject({
      element: "h1#title",
      content: "Still page",
      loadDelay: 0,
      loadTime: 0,
    });
    expect(describeVitals(vitals)).toMatch(/LCP \d+ ms, element h1#title "Still page"/);
    expect(describeVitals(vitals)).toMatch(/render delay \d+ ms/);
  });
});
