import { expect, test } from "@playwright/test";

// The sites built by verify-package.mjs, each on its own port: the generated widget site (the default port), the
// kit's own site (the port after it) and the widget site with `site.image` set (the port after that).
const PORT = Number(process.env.E2E_PORT ?? 4401);
const WIDGET = `http://127.0.0.1:${PORT}/widget/`;
const OWN = `http://127.0.0.1:${PORT + 1}/docs-sitekit/`;
const WITH_IMAGE = `http://127.0.0.1:${PORT + 2}/widget/`;

/** The `content` of a meta tag of the page, found by its property or name. */
function metaContent(html: string, key: string): string | undefined {
  const tag = html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`));
  return tag?.[1];
}

/** The width and height of a PNG, read from its IHDR chunk. */
function pngSize(bytes: Buffer): { width: number; height: number } {
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test.describe("the social card", () => {
  test("a page of a generated site links to a 1200 by 630 card, and the card answers as a PNG", async ({
    request,
  }) => {
    const html = await (await request.get(`${WIDGET}docs/getting-started/`)).text();
    const image = "https://demo.github.io/widget/og.png";
    expect(metaContent(html, "og:image")).toBe(image);
    expect(metaContent(html, "og:image:width")).toBe("1200");
    expect(metaContent(html, "og:image:height")).toBe("630");
    expect(metaContent(html, "og:image:type")).toBe("image/png");
    expect(metaContent(html, "og:image:alt")).toBe("widget: A widget that does widget things.");
    expect(metaContent(html, "twitter:card")).toBe("summary_large_image");
    expect(metaContent(html, "twitter:image")).toBe(image);
    expect(metaContent(html, "twitter:image:alt")).toBe(metaContent(html, "og:image:alt"));

    // The address is absolute on the public origin, so the file is checked at the path it is served from.
    const response = await request.get(`${WIDGET}og.png`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    const bytes = await response.body();
    expect(
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe(true);
    expect(pngSize(bytes)).toEqual({ width: 1200, height: 630 });
  });

  test("the kit's own site links to its card at its own address", async ({ request }) => {
    const html = await (await request.get(`${OWN}`)).text();
    expect(metaContent(html, "og:image")).toBe("https://miguelcolmenares.com/docs-sitekit/og.png");
    expect(metaContent(html, "twitter:card")).toBe("summary_large_image");
    const response = await request.get(`${OWN}og.png`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  });

  test("a site with site.image links that picture, gives no size for it, and draws no card", async ({
    request,
  }) => {
    const html = await (await request.get(`${WITH_IMAGE}docs/getting-started/`)).text();
    expect(metaContent(html, "og:image")).toBe("https://cdn.widget.example/card.png");
    expect(metaContent(html, "twitter:image")).toBe("https://cdn.widget.example/card.png");
    expect(metaContent(html, "twitter:card")).toBe("summary_large_image");
    expect(html).not.toContain("og:image:width");
    expect(html).not.toContain("og:image:type");

    // No card is written, so the path is the 404 page of the site.
    expect((await request.get(`${WITH_IMAGE}og.png`)).status()).toBe(404);
  });
});
