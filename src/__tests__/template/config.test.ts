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

describe("parseSiteConfig llms", () => {
  const collections = [{ id: "docs", label: "Docs", dir: "../docs" }];

  it("is off when the key is missing, and sets no optional collections or Markdown pages", () => {
    expect(parseSiteConfig(valid).llms).toEqual({
      enabled: false,
      optional: [],
      markdownPages: false,
    });
  });

  it("accepts the three fields", () => {
    const config = parseSiteConfig({
      ...valid,
      collections,
      llms: { enabled: true, optional: ["docs"], markdownPages: true },
    });
    expect(config.llms).toEqual({ enabled: true, optional: ["docs"], markdownPages: true });
  });

  it("accepts changelog as an optional collection, since it is a collection of every site", () => {
    expect(
      parseSiteConfig({ ...valid, llms: { enabled: true, optional: ["changelog"] } }).llms.optional,
    ).toEqual(["changelog"]);
  });

  it("names the key and the id of an optional collection the site does not have", () => {
    expect(() =>
      parseSiteConfig({ ...valid, collections, llms: { enabled: true, optional: ["tutorials"] } }),
    ).toThrow(/llms\.optional[\s\S]*"tutorials"/);
  });

  it("rejects an unknown key inside llms", () => {
    expect(() => parseSiteConfig({ ...valid, llms: { enabled: true, extra: 1 } })).toThrow(/extra/);
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

describe("parseSiteConfig stats", () => {
  const stat = (n: number) => ({ value: String(n), label: `Label ${n}` });
  const stats = (count: number) => Array.from({ length: count }, (_, index) => stat(index + 1));

  it("has no stats when the key is missing, so existing sites do not change", () => {
    expect(parseSiteConfig(valid).stats).toEqual([]);
  });

  it.each([2, 3, 4, 5])("accepts %i stats, with an optional note", (count) => {
    const input = stats(count);
    input[0] = { ...input[0]!, note: "A note" } as (typeof input)[number];
    expect(parseSiteConfig({ ...valid, stats: input }).stats).toEqual(input);
  });

  it.each([1, 6])("rejects %i stats and says how many are allowed", (count) => {
    expect(() => parseSiteConfig({ ...valid, stats: stats(count) })).toThrow(
      /stats: stats takes two to five items, or none/,
    );
  });

  it("names the key when a stat has no label or an empty value", () => {
    expect(() =>
      parseSiteConfig({ ...valid, stats: [{ value: "1" }, { value: "", label: "x" }] }),
    ).toThrow(/stats\.0\.label[\s\S]*stats\.1\.value/);
  });

  it("rejects a key under a stat that is not declared", () => {
    expect(() =>
      parseSiteConfig({
        ...valid,
        stats: [
          { value: "1", label: "a", color: "red" },
          { value: "2", label: "b" },
        ],
      }),
    ).toThrow(/color/);
  });
});
