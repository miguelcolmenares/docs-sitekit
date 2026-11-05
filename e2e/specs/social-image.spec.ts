import { expect, test } from "@playwright/test";

// The sites built by verify-package.mjs, each on its own port: the generated widget site (the default port), the
// kit's own site, which sets site.image (the port after it) and the widget site with `site.image` set (the port after that).
const PORT = Number(process.env.E2E_PORT ?? 4401);
const WIDGET = `http://127.0.0.1:${PORT}/widget/`;
const OWN = `http://127.0.0.1:${PORT + 1}/docs-sitekit/`;
const WITH_IMAGE = `http://127.0.0.1:${PORT + 2}/widget/`;

/** The `content` of a meta tag of the page, found by its property or name. */
function metaContent(html: string, key: string): string | undefined {
  const tag = html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`));
  return tag?.[1];
}

test.describe("the social image", () => {
  test("a site without site.image names no picture and keeps the small card", async ({
    request,
  }) => {
    const html = await (await request.get(`${WIDGET}docs/getting-started/`)).text();
    expect(metaContent(html, "twitter:card")).toBe("summary");
    expect(html).not.toContain("og:image");
    expect(html).not.toContain("twitter:image");
    // The kit draws no card, so the path is the 404 page of the site.
    expect((await request.get(`${WIDGET}og.png`)).status()).toBe(404);
  });

  test("the kit's own site names the card the docs workflow draws with social-card-action", async ({
    request,
  }) => {
    const html = await (await request.get(OWN)).text();
    const image = "https://miguelcolmenares.com/docs-sitekit/social.png";
    expect(metaContent(html, "og:image")).toBe(image);
    expect(metaContent(html, "twitter:image")).toBe(image);
    expect(metaContent(html, "twitter:card")).toBe("summary_large_image");
  });

  test("a site with site.image links that picture with a large card, and gives no size for it", async ({
    request,
  }) => {
    const html = await (await request.get(`${WITH_IMAGE}docs/getting-started/`)).text();
    const image = "https://cdn.widget.example/card.png";
    expect(metaContent(html, "og:image")).toBe(image);
    expect(metaContent(html, "twitter:image")).toBe(image);
    expect(metaContent(html, "twitter:card")).toBe("summary_large_image");
    expect(metaContent(html, "og:image:alt")).toBe("widget: A widget that does widget things.");
    expect(metaContent(html, "twitter:image:alt")).toBe(metaContent(html, "og:image:alt"));
    expect(html).not.toContain("og:image:width");
    expect(html).not.toContain("og:image:type");
  });
});
