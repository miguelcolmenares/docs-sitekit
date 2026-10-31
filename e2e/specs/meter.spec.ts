import { expect, test } from "@playwright/test";
import { measureContrast } from "../support/contrast";

// The contrast meter decides whether the whole site passes, so it is tested on its own against
// pages whose answer is known. A meter that always says "fine" would make every other test worthless.
const page$ = (body: string) =>
  `<!doctype html><html><body style="margin:0;background:#000">${body}</body></html>`;

test.describe("the contrast meter", () => {
  test("flags pale text on a dark background and reports the ratio", async ({ page }) => {
    await page.setContent(page$('<p style="color:#555;font-size:16px">too pale</p>'));
    const { offenders, checked } = await measureContrast(page);
    expect(checked).toBe(1);
    expect(offenders).toHaveLength(1);
    expect(offenders[0]).toMatchObject({ required: 4.5 });
    expect(offenders[0]!.ratio).toBeGreaterThan(2);
    expect(offenders[0]!.ratio).toBeLessThan(3);
  });

  test("accepts text that is clearly readable", async ({ page }) => {
    await page.setContent(page$('<p style="color:#ededf0;font-size:16px">fine</p>'));
    const { offenders, checked } = await measureContrast(page);
    expect(checked).toBe(1);
    expect(offenders).toEqual([]);
  });

  test("counts opacity inherited from an ancestor", async ({ page }) => {
    await page.setContent(page$('<div style="opacity:.2"><p style="color:#fff">faded</p></div>'));
    expect((await measureContrast(page)).offenders).toHaveLength(1);
  });

  test("stacks translucent backgrounds instead of reading only the nearest one", async ({
    page,
  }) => {
    await page.setContent(
      page$(
        '<div style="background:#fff"><p style="background:rgba(0,0,0,.1);color:#fff">white on light grey</p></div>',
      ),
    );
    expect((await measureContrast(page)).offenders).toHaveLength(1);
  });

  test("applies the lower 3:1 bar to large text only", async ({ page }) => {
    // #666 on black is about 3.7:1: enough for large text, not for body text.
    await page.setContent(
      page$(
        '<p id="big" style="color:#666;font-size:24px">large</p><p id="small" style="color:#666;font-size:16px">small</p>',
      ),
    );
    const { offenders } = await measureContrast(page);
    expect(offenders.map((offender) => offender.text)).toEqual(["small"]);
  });

  test("applies the 3:1 bar to bold text from 18.66px", async ({ page }) => {
    await page.setContent(
      page$(
        '<p style="color:#666;font-size:19px;font-weight:700">bold</p><p style="color:#666;font-size:19px;font-weight:400">regular</p>',
      ),
    );
    expect((await measureContrast(page)).offenders.map((offender) => offender.text)).toEqual([
      "regular",
    ]);
  });

  test("does not guess over a gradient: it reports the text as uncertain", async ({ page }) => {
    await page.setContent(
      page$(
        '<div style="background-image:linear-gradient(#fff,#000)"><p style="color:#555">over a gradient</p></div>',
      ),
    );
    const { offenders, uncertain } = await measureContrast(page);
    expect(offenders).toEqual([]);
    expect(uncertain.join()).toMatch(/over a gradient/);
  });

  test("ignores text that is hidden or visually hidden", async ({ page }) => {
    await page.setContent(
      page$(
        '<p style="display:none;color:#222">gone</p><span style="position:absolute;width:1px;height:1px;overflow:hidden;color:#222">sr only</span>',
      ),
    );
    expect((await measureContrast(page)).checked).toBe(0);
  });

  test("leaves out the text of a disabled control, and still measures an enabled one", async ({
    page,
  }) => {
    await page.setContent(
      page$(
        '<button disabled style="color:#555;background:#000;font-size:16px">off</button><button style="color:#555;background:#000;font-size:16px">on</button>',
      ),
    );
    const { offenders, checked } = await measureContrast(page);
    expect(checked).toBe(1);
    expect(offenders.map((offender) => offender.text)).toEqual(["on"]);
  });

  test("understands modern color syntax", async ({ page }) => {
    await page.setContent(page$('<p style="color:color-mix(in srgb, #fff 20%, #000)">mixed</p>'));
    expect((await measureContrast(page)).offenders).toHaveLength(1);
  });
});
