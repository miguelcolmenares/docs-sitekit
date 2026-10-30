import { expect, test } from "@playwright/test";

// The generated site from verify-package.mjs: package `@demo/widget`, served under `/widget/`, with
// the llms option on and a Markdown copy of every page.
const ORIGIN = "https://demo.github.io";
const BASE = "/widget/";

test.describe("llms.txt", () => {
  test("is served under the base, in the order of the proposal, with absolute addresses", async ({
    request,
  }) => {
    const response = await request.get(`${BASE}llms.txt`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/^text\/plain/);

    const text = await response.text();
    expect(text.split("\n")[0]).toBe("# widget");
    expect(text).toContain("> A widget that does widget things.");
    expect(text).toContain(
      `- [Getting started](${ORIGIN}${BASE}docs/getting-started/): Install the widget and use it.`,
    );

    // Sections in order, and Optional last with the examples in it.
    const docs = text.indexOf("## Docs");
    const changelog = text.indexOf("## Changelog");
    const optional = text.indexOf("## Optional");
    expect(docs).toBeGreaterThan(0);
    expect(docs).toBeLessThan(changelog);
    expect(changelog).toBeLessThan(optional);
    expect(text.slice(optional)).toContain(`(${ORIGIN}${BASE}examples/basic/)`);
    expect(text.slice(0, optional)).not.toContain("examples/basic");

    // Every address is absolute, so an assistant can fetch it without knowing where the file came from.
    expect(text).not.toMatch(/\]\(\//);
  });

  test("a page has its Markdown copy at the page URL, with links made absolute", async ({
    request,
  }) => {
    const response = await request.get(`${BASE}docs/getting-started/index.html.md`);
    expect(response.status()).toBe(200);

    const text = await response.text();
    expect(text.startsWith("# Getting started\n")).toBe(true);
    // A relative link to a page of the site, with its anchor.
    expect(text).toContain(`[the guide](${ORIGIN}${BASE}docs/guide/#advanced)`);
    // A link to a repository file that is not on the site.
    expect(text).toContain("[license](https://github.com/demo/widget/blob/HEAD/LICENSE)");
    // Inline code is not a link, so it is left as written.
    expect(text).toContain("Code stays as written: `[guide](./guide.md)`.");
  });

  test("the HTML of a page points to its Markdown copy and to llms.txt", async ({ request }) => {
    const html = await (await request.get(`${BASE}docs/getting-started/`)).text();
    expect(html).toContain(
      `<link rel="alternate" type="text/markdown" href="${ORIGIN}${BASE}docs/getting-started/index.html.md">`,
    );
    expect(html).toContain(`<link rel="describedby" href="${ORIGIN}${BASE}llms.txt">`);
  });
});
