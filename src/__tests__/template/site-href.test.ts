import { withSiteBase } from "../../../template/src/domain";

describe("withSiteBase", () => {
  it.each([
    ["/docs/getting-started/", "/acme/docs/getting-started/"],
    ["/", "/acme/"],
    ["/changelog/#v1", "/acme/changelog/#v1"],
    ["/search/?q=base", "/acme/search/?q=base"],
    ["/acmeish/", "/acme/acmeish/"],
    ["/acme-docs/", "/acme/acme-docs/"],
  ])("adds the base to the path %s", (href, expected) => {
    expect(withSiteBase(href, "/acme/")).toBe(expected);
  });

  it.each([
    "https://blog.acme.example",
    "http://acme.example/a",
    "mailto:team@acme.example",
    "tel:+571234567",
    "//cdn.acme.example/a.js",
    "#install",
    "docs/start/",
    "./start/",
    "../start/",
    "?tag=ui",
    "",
  ])("leaves %s as written", (href) => {
    expect(withSiteBase(href, "/acme/")).toBe(href);
  });

  it.each([
    "/acme/docs/getting-started/",
    "/acme/",
    "/acme",
    "/acme?tag=ui",
    "/acme#top",
    "/acme/#top",
  ])("leaves %s as written, because it already starts with the base", (href) => {
    expect(withSiteBase(href, "/acme/")).toBe(href);
  });

  it("is idempotent, so a link written with the base and a link written without it end the same", () => {
    const once = withSiteBase("/docs/start/", "/acme/");
    expect(withSiteBase(once, "/acme/")).toBe(once);
    expect(withSiteBase("/acme/docs/start/", "/acme/")).toBe(once);
  });

  it("handles a base with several segments", () => {
    expect(withSiteBase("/docs/start/", "/org/site/")).toBe("/org/site/docs/start/");
    expect(withSiteBase("/org/site/docs/start/", "/org/site/")).toBe("/org/site/docs/start/");
    expect(withSiteBase("/org/", "/org/site/")).toBe("/org/site/org/");
  });

  it("changes nothing on a site served from the root", () => {
    for (const href of ["/docs/start/", "/", "https://acme.example", "#top", "mailto:a@b.dev"]) {
      expect(withSiteBase(href, "/")).toBe(href);
    }
  });

  it("takes a path that starts with the base by accident as complete, and the base twice reaches the other page", () => {
    // The base is /docs/. A link written /docs/api/ is the page /docs/api/ of the site, not the page /api/ of the
    // collection that lives at /docs/docs/api/.
    expect(withSiteBase("/docs/api/", "/docs/")).toBe("/docs/api/");
    expect(withSiteBase("/docs/docs/api/", "/docs/")).toBe("/docs/docs/api/");
    expect(withSiteBase("/changelog/", "/docs/")).toBe("/docs/changelog/");
  });
});
