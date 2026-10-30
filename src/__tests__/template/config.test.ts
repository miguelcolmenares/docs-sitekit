import { kebab, parseSiteConfig } from "../../../template/src/domain";

const valid = {
  site: { name: "Demo", description: "A demo", url: "https://me.github.io" },
  hero: { title: "Demo", lede: "Lede", primary: { label: "Start", href: "/docs/" } },
};

describe("parseSiteConfig theme", () => {
  it("starts dark when the config has no theme key, so existing sites do not change", () => {
    expect(parseSiteConfig(valid).theme.default).toBe("dark");
  });

  it.each(["dark", "light", "system"])("accepts %s as the default theme", (value) => {
    expect(parseSiteConfig({ ...valid, theme: { default: value } }).theme.default).toBe(value);
  });

  it("names the key when the default theme is not one of the three", () => {
    expect(() => parseSiteConfig({ ...valid, theme: { default: "sepia" } })).toThrow(
      /theme\.default/,
    );
  });

  it("rejects a key under theme that is not declared", () => {
    expect(() => parseSiteConfig({ ...valid, theme: { default: "light", accent: "red" } })).toThrow(
      /accent/,
    );
  });
});

describe("parseSiteConfig", () => {
  it("accepts a minimal config and fills the defaults", () => {
    const config = parseSiteConfig(valid);
    expect(config.site.base).toBe("/");
    expect(config.sources.changelog).toBe("../CHANGELOG.md");
    expect(config.collections).toEqual([]);
    expect(config.deploy.target).toBe("github-pages");
    expect(config.features).toEqual([]);
  });

  it("rejects a key that is not declared, at any depth", () => {
    expect(() => parseSiteConfig({ ...valid, extra: 1 })).toThrow(/extra/);
    expect(() => parseSiteConfig({ ...valid, site: { ...valid.site, secret: "x" } })).toThrow(
      /secret/,
    );
  });

  it("requires a base path that starts and ends with a slash", () => {
    expect(() => parseSiteConfig({ ...valid, site: { ...valid.site, base: "/docs" } })).toThrow(
      /base/,
    );
    expect(
      parseSiteConfig({ ...valid, site: { ...valid.site, base: "/recaptcha/" } }).site.base,
    ).toBe("/recaptcha/");
  });

  it("lists every problem with its path", () => {
    expect(() => parseSiteConfig({ site: {}, hero: {} })).toThrow(/site\.name[\s\S]*hero\.title/);
  });

  it("rejects an icon name that is not kebab-case", () => {
    const features = [{ icon: "Shield Check", eyebrow: "e", title: "t", text: "x" }];
    expect(() => parseSiteConfig({ ...valid, features })).toThrow(/icon/);
  });
});

describe("parseSiteConfig collections", () => {
  const collection = { id: "docs", label: "Docs", dir: "../docs" };
  const withCollections = (collections: unknown) => ({ ...valid, collections });

  it("accepts collections, and defaults a group tone to neutral", () => {
    const config = parseSiteConfig(
      withCollections([{ ...collection, groups: [{ name: "Start", items: ["a"] }] }]),
    );
    expect(config.collections[0]!.groups[0]!.tone).toBe("neutral");
  });

  it("rejects a tone that the design system does not have", () => {
    expect(() =>
      parseSiteConfig(
        withCollections([{ ...collection, groups: [{ name: "x", tone: "violet", items: ["a"] }] }]),
      ),
    ).toThrow(/tone/);
  });

  it("rejects an id that is already a route", () => {
    expect(() => parseSiteConfig(withCollections([{ ...collection, id: "changelog" }]))).toThrow(
      /reserved/,
    );
    expect(() => parseSiteConfig(withCollections([{ ...collection, id: "gallery" }]))).toThrow(
      /reserved/,
    );
  });

  it("rejects two collections with the same id", () => {
    expect(() => parseSiteConfig(withCollections([collection, collection]))).toThrow(
      /Two collections have the id "docs"/,
    );
  });

  it("rejects an id that is not a route segment", () => {
    expect(() => parseSiteConfig(withCollections([{ ...collection, id: "My Docs" }]))).toThrow(
      /id/,
    );
  });

  it("rejects a group with no items, and a key that is not declared", () => {
    expect(() =>
      parseSiteConfig(withCollections([{ ...collection, groups: [{ name: "x", items: [] }] }])),
    ).toThrow();
    expect(() => parseSiteConfig(withCollections([{ ...collection, extra: true }]))).toThrow(
      /extra/,
    );
  });
});

describe("kebab", () => {
  it("makes a slug from a file name", () => {
    expect(kebab("Getting Started.md")).toBe("getting-started");
    expect(kebab("designTokens.mdx")).toBe("design-tokens");
  });
});

describe("parseSiteConfig search", () => {
  it("turns search on when the key is absent", () => {
    expect(parseSiteConfig(valid).search).toEqual({ enabled: true });
  });

  it("accepts search off, and rejects a key that is not declared under it", () => {
    expect(parseSiteConfig({ ...valid, search: { enabled: false } }).search.enabled).toBe(false);
    expect(() => parseSiteConfig({ ...valid, search: { enabled: true, fuzzy: true } })).toThrow(
      /fuzzy/,
    );
    expect(() => parseSiteConfig({ ...valid, search: { enabled: "yes" } })).toThrow(/enabled/);
  });
});
