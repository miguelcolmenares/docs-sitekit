import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { measureContrast } from "../support/contrast";

// The page is written in markdown with a title, highlighted lines and diff lines, in the repository that
// `verify:package` generates, in the tutorials collection so the docs index keeps its four cards. These tests read the built site, the way a visitor does.
const PAGE = "/widget/tutorials/code-blocks/";
const block = (page: Page, text: string): Locator => page.locator(".code-block", { hasText: text });

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const background = (locator: Locator) =>
  locator.evaluate((node) => getComputedStyle(node).backgroundColor);

test.describe("code blocks: title, highlighted lines and diff lines", () => {
  test("a title is a caption over the block, and a block without one has no caption", async ({
    page,
  }) => {
    await page.goto(PAGE);
    const titled = block(page, "retries: 3,").first();
    await expect(titled.locator("figcaption")).toHaveText("src/config.ts");
    expect(await titled.evaluate((node) => node.tagName)).toBe("FIGURE");
    const caption = (await titled.locator("figcaption").boundingBox())!;
    const pre = (await titled.locator("pre").boundingBox())!;
    expect(caption.y + caption.height).toBeLessThanOrEqual(pre.y + 1); // above the code, not over it
    await expect(page.locator("figcaption")).toHaveCount(3);
    await expect(block(page, "const plain").locator("figcaption")).toHaveCount(0);
  });

  test("the lines named in the braces are highlighted, with a bar on the left edge, and no others", async ({
    page,
  }) => {
    await page.goto(PAGE);
    const lines = block(page, "const fifth").locator(".line");
    await expect(lines).toHaveCount(5);
    const marked = await lines.evaluateAll((nodes) =>
      nodes.map((node) => node.hasAttribute("data-highlighted")),
    );
    expect(marked).toEqual([false, true, false, true, true]);
    const [plain, highlighted] = [await background(lines.nth(0)), await background(lines.nth(1))];
    expect(highlighted).not.toBe(plain);
    const edges = await lines.evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).borderLeftColor),
    );
    expect(edges[1]).not.toBe(edges[0]);
    expect(edges[1]).toBe(edges[3]);
  });

  test("a highlight does not hide the colors of the code", async ({ page }) => {
    await page.goto(PAGE);
    const lines = block(page, "const fifth").locator(".line");
    const keyword = (index: number) =>
      lines
        .nth(index)
        .locator("span")
        .first()
        .evaluate((node) => getComputedStyle(node).color);
    expect(await keyword(1)).toBe(await keyword(0)); // `const` has one color on a plain and a highlighted line
    expect(await keyword(0)).not.toBe(
      await lines.nth(0).evaluate((node) => getComputedStyle(node).color),
    );
  });

  test("added and removed lines get a tone and a sign, from comments and in a diff block", async ({
    page,
  }) => {
    await page.goto(PAGE);
    const marked = block(page, "const removed").locator(".line");
    const tones = await marked.evaluateAll((nodes) =>
      nodes.map((node) => ({
        diff: node.getAttribute("data-diff"),
        background: getComputedStyle(node).backgroundColor,
        sign: getComputedStyle(node, "::before").content,
        signColor: getComputedStyle(node, "::before").color,
      })),
    );
    expect(tones.map((tone) => tone.diff)).toEqual([null, "remove", "add"]);
    expect(tones[1]!.sign).toBe('"-"');
    expect(tones[2]!.sign).toBe('"+"');
    expect(tones[1]!.signColor).not.toBe(tones[2]!.signColor);
    expect(new Set(tones.map((tone) => tone.background)).size).toBe(3);
    // The comment is not shown.
    await expect(
      marked.locator("xpath=ancestor::*[contains(@class,'code-block')]"),
    ).not.toContainText("[!code");

    const diff = block(page, "retries: 5").locator(".line");
    const kinds = await diff.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-diff")),
    );
    expect(kinds).toEqual([null, null, null, null, "remove", "add", null]);
    // The sign is in the text of a diff block, so the style draws no second one.
    const drawn = await diff.evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node, "::before").content),
    );
    expect(drawn.every((content) => content === "none" || content === "normal")).toBe(true);
    await expect(diff.nth(4)).toHaveText("-  retries: 3,");
    await expect(diff.nth(5)).toHaveText("+  retries: 5,");
  });

  test("a block with no meta string sits where it always did", async ({ page }) => {
    await page.goto(PAGE);
    const plain = block(page, "const plain");
    await expect(plain.locator(".line[data-highlighted], .line[data-diff]")).toHaveCount(0);
    // The first character of the code is 1px of border and 1.1rem of padding from the left edge, as before.
    const offset = await plain.evaluate(
      (node) =>
        node.querySelector(".line span")!.getBoundingClientRect().left -
        node.getBoundingClientRect().left,
    );
    expect(Math.abs(offset - 18.6)).toBeLessThan(1);
    // A blank line keeps its height.
    const heights = await plain
      .locator(".line")
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(heights[1]).toBeGreaterThan(10);
    expect(heights[1]).toBeCloseTo(heights[0]!, 0);
  });

  test("the markup of the page has no serious or critical axe violation", async ({ page }) => {
    await page.goto(PAGE);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(
      serious.map((violation) => `${violation.id}: ${violation.nodes[0]?.target.join(" ")}`),
    ).toEqual([]);
  });
});

test.describe("code blocks: the copy button", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });
  const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

  test("is a button with a name, reached with the keyboard, that shows a focus ring", async ({
    page,
  }) => {
    await page.goto(PAGE);
    const button = block(page, "const plain").getByRole("button", { name: "Copy code" });
    await expect(button).toBeVisible();
    await button.focus();
    await expect(button).toBeFocused();
    const ring = await button.evaluate((node) => {
      const style = getComputedStyle(node);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(ring.style).not.toBe("none");
    expect(ring.width).toBeGreaterThanOrEqual(2);
  });

  test("copies exactly the code, with the special characters as written, and says Copied politely", async ({
    page,
  }) => {
    await page.goto(PAGE);
    const plain = block(page, "const plain");
    const status = plain.locator(".code-status");
    await expect(status).toHaveAttribute("role", "status");
    await expect(status).toHaveAttribute("aria-live", "polite");
    await expect(status).toHaveText("");
    const button = plain.getByRole("button", { name: "Copy code" });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(status).toHaveText("Copied");
    await expect(button).toHaveText("Copied");
    expect(await clipboard(page)).toBe('const plain = 1;\n\nconst text = "<b>&amp;</b>";');
    // The message goes away, and the button says Copy again.
    await expect(status).toHaveText("", { timeout: 4000 });
    await expect(button).toHaveText("Copy");
  });

  test("leaves the marker comments and the drawn signs out of what it copies", async ({ page }) => {
    await page.goto(PAGE);
    await block(page, "const removed").getByRole("button", { name: "Copy code" }).click();
    expect(await clipboard(page)).toBe("const kept = 1;\nconst removed = 2;\nconst added = 3;");
  });

  test("copies a diff block as written, with its plus and minus", async ({ page }) => {
    await page.goto(PAGE);
    await block(page, "retries: 5").getByRole("button", { name: "Copy code" }).click();
    expect(await clipboard(page)).toBe(
      [
        "--- a/src/config.ts",
        "+++ b/src/config.ts",
        "@@ -1,3 +1,3 @@",
        " export const config = {",
        "-  retries: 3,",
        "+  retries: 5,",
        " };",
      ].join("\n"),
    );
  });

  test("copies the code of the block it belongs to and not another", async ({ page }) => {
    await page.goto(PAGE);
    await block(page, "const fifth").getByRole("button", { name: "Copy code" }).click();
    expect(await clipboard(page)).toBe(
      "const first = 1;\nconst second = 2;\nconst third = 3;\nconst fourth = 4;\nconst fifth = 5;",
    );
  });

  test("makes no request to another host", async ({ page }) => {
    const hosts = new Set<string>();
    page.on("request", (request) => hosts.add(new URL(request.url()).host));
    await page.goto(PAGE);
    await block(page, "const plain").getByRole("button", { name: "Copy code" }).click();
    await page.waitForLoadState("networkidle");
    expect([...hosts]).toEqual([new URL(page.url()).host]);
  });

  test("the script is small and ships in the page, with no file of its own", async ({
    request,
  }) => {
    const response = await request.get(PAGE);
    const html = await response.text();
    const script = [...html.matchAll(/<script type="module">([^<]*)<\/script>/g)]
      .map((match) => match[1]!)
      .find((code) => code.includes("clipboard"));
    expect(script).toBeDefined();
    expect(Buffer.byteLength(script!)).toBeLessThan(1024);
    expect(html).not.toMatch(/<script[^>]*src="[^"]*copyCode/);
    // Say the size in the test report, so the number is easy to find.
    test
      .info()
      .annotations.push({ type: "script bytes", description: String(Buffer.byteLength(script!)) });
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("the code and the title read, and the button is hidden", async ({ page }) => {
      await page.goto(PAGE);
      await expect(page.locator("figcaption").first()).toBeVisible();
      await expect(block(page, "const plain").locator("pre")).toBeVisible();
      await expect(page.locator(".copy-code").first()).toBeHidden();
      await expect(page.locator(".copy-code")).toHaveCount(7);
      // The tones are in the style, not in a script.
      const background = await page
        .locator('.line[data-diff="add"]')
        .first()
        .evaluate((node) => getComputedStyle(node).backgroundColor);
      expect(background).not.toBe("rgba(0, 0, 0, 0)");
    });
  });
});

test.describe("code blocks on a phone", () => {
  for (const width of [320, 360, 390]) {
    test(`a long line scrolls inside the block at ${width}px, with the title bar and the button in place`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(PAGE);
      const long = block(page, "documentation");
      const pre = long.locator("pre");
      const wide = await pre.evaluate((node) => ({
        scrolls: node.scrollWidth > node.clientWidth,
        box: node.getBoundingClientRect().width,
      }));
      expect(wide.scrolls).toBe(true); // the line really is wider than the block
      expect(wide.box).toBeLessThanOrEqual(width);
      await expect(pre).toHaveAttribute("tabindex", "0");
      expect(await overflow(page)).toBeLessThanOrEqual(0);

      const button = long.getByRole("button", { name: "Copy code" });
      const caption = long.locator("figcaption");
      const before = (await button.boundingBox())!;
      expect(before.width).toBeGreaterThanOrEqual(44);
      expect(before.height).toBeGreaterThanOrEqual(44);
      expect(before.x + before.width).toBeLessThanOrEqual(width);
      const bar = (await caption.boundingBox())!;
      expect(bar.x + bar.width).toBeLessThanOrEqual(width);
      // The button is on the title bar and does not cover the title.
      expect(before.y).toBeGreaterThanOrEqual(bar.y);
      expect(before.y + before.height).toBeLessThanOrEqual(bar.y + bar.height + 1);

      // Scroll the code all the way: the title bar and the button do not move.
      await pre.evaluate((node) => (node.scrollLeft = node.scrollWidth));
      const after = (await button.boundingBox())!;
      expect(after.x).toBe(before.x);
      expect(after.y).toBe(before.y);
      expect((await caption.boundingBox())!.x).toBe(bar.x);
      expect(await overflow(page)).toBeLessThanOrEqual(0);

      // The highlighted line fills the width of what scrolls: its tone reaches the end of the long line.
      const reach = await long.locator(".line[data-highlighted]").evaluate((node) => ({
        line: node.getBoundingClientRect().width,
        scroll: node.closest("pre")!.scrollWidth,
      }));
      expect(reach.line).toBeGreaterThanOrEqual(reach.scroll - 1);
    });
  }

  test("the button of a block with no title sits above the first line on a phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(PAGE);
    const plain = block(page, "const plain");
    const button = (await plain.getByRole("button", { name: "Copy code" }).boundingBox())!;
    const code = (await plain.locator("pre code").boundingBox())!;
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.y + button.height).toBeLessThanOrEqual(code.y + 1);
  });
});

test.describe("code blocks: contrast", () => {
  for (const theme of ["dark", "light"] as const) {
    for (const width of [320, 390, 1440]) {
      test(`text, highlighted lines and diff lines reach WCAG AA in the ${theme} theme at ${width}px`, async ({
        page,
      }) => {
        await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(PAGE);
        expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
        // The page has all three kinds of line, so the meter reads the code over each tone.
        await expect(page.locator(".line[data-highlighted]").first()).toBeAttached();
        await expect(page.locator('.line[data-diff="add"]').first()).toBeAttached();
        await expect(page.locator('.line[data-diff="remove"]').first()).toBeAttached();
        const { offenders, checked } = await measureContrast(page);
        expect(checked).toBeGreaterThan(60);
        expect(offenders).toEqual([]);
      });
    }

    test(`the tones of a highlight, an added line and a removed line differ from the block in the ${theme} theme`, async ({
      page,
    }) => {
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await page.goto(PAGE);
      const grounds = await page.evaluate(() => {
        const color = (selector: string) =>
          getComputedStyle(document.querySelector(selector)!).backgroundColor;
        return [
          color(".code-block .line:not([data-highlighted]):not([data-diff])"),
          color(".line[data-highlighted]:not([data-diff])"),
          color('.line[data-diff="add"]:not([data-highlighted])'),
          color('.line[data-diff="remove"]'),
        ];
      });
      expect(new Set(grounds).size).toBe(4);
    });
  }
});
