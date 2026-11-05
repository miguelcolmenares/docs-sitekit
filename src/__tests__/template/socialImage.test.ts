import {
  parseSiteConfig,
  socialImageAlt,
  socialImageProblem,
  socialImageUrl,
} from "../../../template/src/domain";

const ORIGIN = "https://user.github.io";

describe("socialImageUrl", () => {
  it.each([
    ["/social.png", "/widget/social.png"],
    ["social.png", "/widget/social.png"],
    ["/widget/social.png", "/widget/social.png"],
  ])("gives the path %s the base, so it is %s", (image, expected) => {
    const absolute = `https://user.github.io${expected}`;
    expect(socialImageUrl(ORIGIN, "/widget/", image)).toBe(absolute);
  });

  it("keeps a full https address as it is", () => {
    expect(socialImageUrl(ORIGIN, "/widget/", "https://cdn.example.org/card.png")).toBe(
      "https://cdn.example.org/card.png",
    );
  });

  it("does not add the base to a path at the root of a site served from the root", () => {
    expect(socialImageUrl(ORIGIN, "/", "/social.png")).toBe("https://user.github.io/social.png");
  });
});

describe("socialImageProblem", () => {
  it.each(["/social.png", "social.png", "/images/card-1200.png", "https://cdn.example.org/a.png"])(
    "accepts %s",
    (value) => {
      expect(socialImageProblem(value)).toBeUndefined();
    },
  );

  it.each([
    ["/my card.png", "a space"],
    ["http://cdn.example.org/a.png", "https"],
    ["javascript:alert(1)", "https"],
    ["//cdn.example.org/a.png", "protocol-relative"],
    ["/images/", "not a file"],
    ["/", "not a file"],
    ["/../secret.png", "leaves the site"],
    ["images/../../card.png", "leaves the site"],
  ])("refuses %s, and says why (%s)", (value) => {
    expect(socialImageProblem(value)).toEqual(expect.stringMatching(/\S/));
  });

  it("is checked by the config schema, with the key in the message", () => {
    const config = {
      site: { name: "Demo", description: "A demo", url: "https://me.github.io", image: "/a b.png" },
      hero: { title: "Demo", lede: "Lede", primary: { label: "Start", href: "/docs/" } },
    };
    expect(() => parseSiteConfig(config)).toThrow(/site\.image/);
    expect(() =>
      parseSiteConfig({ ...config, site: { ...config.site, image: "/social.png" } }),
    ).not.toThrow();
  });
});

describe("socialImageAlt", () => {
  it("is the name and the description when the site sets no alt text", () => {
    expect(socialImageAlt({ name: "Acme", description: "Background jobs." })).toBe(
      "Acme: Background jobs.",
    );
  });

  it("is the alt text of the site when it has one, trimmed", () => {
    expect(socialImageAlt({ name: "Acme", description: "Jobs.", imageAlt: "  Acme logo  " })).toBe(
      "Acme logo",
    );
  });
});
