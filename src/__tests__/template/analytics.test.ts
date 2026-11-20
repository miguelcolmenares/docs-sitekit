import { analyticsIdProblem, parseSiteConfig } from "../../../template/src/domain";

const valid = {
  site: { name: "Demo", description: "A demo", url: "https://me.github.io" },
  hero: { title: "Demo", lede: "Lede", primary: { label: "Start", href: "/docs/" } },
};

describe("the analytics key of the config", () => {
  it("is absent when the config does not have it, so no script is written and nothing changes", () => {
    expect(parseSiteConfig(valid).analytics).toBeUndefined();
  });

  it("takes a Google Tag Manager container and a GA4 measurement ID", () => {
    expect(
      parseSiteConfig({ ...valid, analytics: { provider: "gtm", id: "GTM-ABC1234" } }).analytics,
    ).toEqual({ provider: "gtm", id: "GTM-ABC1234" });
    expect(
      parseSiteConfig({ ...valid, analytics: { provider: "ga4", id: "G-XYZ98765" } }).analytics,
    ).toEqual({ provider: "ga4", id: "G-XYZ98765" });
  });

  it("refuses a provider that is not gtm or ga4, and names the key", () => {
    expect(() =>
      parseSiteConfig({ ...valid, analytics: { provider: "matomo", id: "GTM-ABC1234" } }),
    ).toThrow(/analytics\.provider/);
  });

  it("refuses an id of the other provider, with the prefix each one needs", () => {
    expect(() =>
      parseSiteConfig({ ...valid, analytics: { provider: "gtm", id: "G-XYZ98765" } }),
    ).toThrow(/analytics\.id[\s\S]*"GTM-"/);
    expect(() =>
      parseSiteConfig({ ...valid, analytics: { provider: "ga4", id: "GTM-ABC1234" } }),
    ).toThrow(/analytics\.id[\s\S]*"G-"/);
  });

  it("refuses an id with nothing after the prefix, or with a character that is not a letter or digit", () => {
    for (const id of ["GTM-", "GTM-AB C", 'GTM-AB"', "GTM-AB<", "gtm-ABC", "GTM-ABC-1"]) {
      expect(() => parseSiteConfig({ ...valid, analytics: { provider: "gtm", id } })).toThrow(
        /analytics\.id/,
      );
    }
  });

  it("is closed: a key under analytics that is not declared is an error", () => {
    expect(() =>
      parseSiteConfig({
        ...valid,
        analytics: { provider: "gtm", id: "GTM-ABC1234", consent: true },
      }),
    ).toThrow(/consent/);
  });

  it("requires both provider and id", () => {
    expect(() => parseSiteConfig({ ...valid, analytics: { provider: "gtm" } })).toThrow(/id/);
    expect(() => parseSiteConfig({ ...valid, analytics: { id: "GTM-ABC1234" } })).toThrow(
      /provider/,
    );
  });
});

describe("analyticsIdProblem", () => {
  it("accepts an id with its own prefix", () => {
    expect(analyticsIdProblem("gtm", "GTM-ABC1234")).toBeUndefined();
    expect(analyticsIdProblem("ga4", "G-ABC1234")).toBeUndefined();
  });

  it("says which prefix the provider needs and what it got", () => {
    expect(analyticsIdProblem("ga4", "GTM-ABC1234")).toBe(
      'analytics.id for provider "ga4" must start with "G-" and continue with letters and digits, such as G-XXXXXXXXXX. Got "GTM-ABC1234".',
    );
  });
});
