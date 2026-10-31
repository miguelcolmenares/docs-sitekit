import { createRequire } from "node:module";
import { join } from "node:path";
import {
  BRANDS,
  configIcons,
  findBrand,
  iconProblem,
  parseCustomSvg,
  parseIconName,
  parseSiteConfig,
  repositoryLink,
  suggestBrands,
} from "../../../template/src/domain";
import { Icon } from "../../../template/src/presentation/components/site/Icon";

// react-dom lives in the template, which has its own dependencies. Icon is a plain function of its
// props, so it is called directly and its element is rendered to markup.
const requireFromTemplate = createRequire(
  join(__dirname, "..", "..", "..", "template", "package.json"),
);
const { renderToStaticMarkup } = requireFromTemplate("react-dom/server") as {
  renderToStaticMarkup: (element: unknown) => string;
};
const render = (props: Parameters<typeof Icon>[0]) => renderToStaticMarkup(Icon(props));

const valid = {
  site: { name: "Demo", description: "A demo", url: "https://me.github.io" },
  hero: { title: "Demo", lede: "Lede", primary: { label: "Start", href: "/docs/" } },
};
const withIcon = (icon: string) => ({
  ...valid,
  features: [{ icon, eyebrow: "E", title: "T", text: "Text" }],
});

describe("the curated brands", () => {
  it("include the eleven of the first set, each with its licence", () => {
    const slugs = BRANDS.map((brand) => brand.slug);
    for (const slug of [
      "github",
      "gitlab",
      "npm",
      "nextdotjs",
      "react",
      "typescript",
      "tailwindcss",
      "nodedotjs",
      "docker",
      "vercel",
      "astro",
    ])
      expect(slugs).toContain(slug);
    for (const brand of BRANDS) expect(brand.license).toMatch(/\S/);
  });

  it("are sorted by slug, and every path is plain path data", () => {
    const slugs = BRANDS.map((brand) => brand.slug);
    expect(slugs).toEqual([...slugs].sort());
    for (const brand of BRANDS)
      expect(brand.path).toMatch(/^[Mm][MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]+$/);
  });

  it("carry an author and an attribution wherever the licence is not CC0", () => {
    for (const brand of BRANDS.filter((entry) => entry.license !== "CC0-1.0")) {
      expect(brand.author).toMatch(/\S/);
      expect(brand.attribution).toMatch(/\S/);
    }
  });
});

describe("parseIconName", () => {
  it.each([
    ["shield-check", { kind: "lucide", name: "shield-check" }],
    ["brand:github", { kind: "brand", slug: "github" }],
    ["brand:custom/my-logo", { kind: "custom", name: "my-logo" }],
  ])("reads %s", (value, expected) => {
    expect(parseIconName(value)).toEqual(expected);
  });

  it.each([
    "Shield",
    "brand:",
    "brand:Git Hub",
    "brand:custom",
    "brand:custom/",
    "brand:custom/a/b",
    "a:b",
    "",
  ])("refuses %j", (value) => {
    expect(parseIconName(value)).toBeUndefined();
  });
});

describe("suggestBrands", () => {
  it("finds a brand by its name written without punctuation", () => {
    expect(suggestBrands("nextjs")[0]?.slug).toBe("nextdotjs");
    expect(suggestBrands("node")[0]?.slug).toBe("nodedotjs");
    expect(suggestBrands("tailwind")[0]?.slug).toBe("tailwindcss");
  });

  it("finds a brand with a typo", () => {
    expect(suggestBrands("githb")[0]?.slug).toBe("github");
    expect(suggestBrands("dokcer")[0]?.slug).toBe("docker");
  });

  it("suggests nothing for a word that is close to no brand", () => {
    expect(suggestBrands("zzzzzzzz")).toEqual([]);
  });

  it("returns at most the limit", () => {
    expect(suggestBrands("git", 1)).toHaveLength(1);
  });
});

describe("the icon in the config", () => {
  it("accepts a lucide name, a brand that ships and a custom logo", () => {
    for (const icon of ["layers", "brand:github", "brand:custom/acme"])
      expect(parseSiteConfig(withIcon(icon)).features[0]?.icon).toBe(icon);
  });

  it("fails an unknown brand with the slug and the closest ones", () => {
    expect(() => parseSiteConfig(withIcon("brand:nextjs"))).toThrow(
      /features\.0\.icon: Unknown brand "nextjs"\. Did you mean brand:nextdotjs \(Next\.js\)/,
    );
  });

  it("lists the brands that ship when nothing is close, and points to the custom folder", () => {
    expect(() => parseSiteConfig(withIcon("brand:zzzzzzzz"))).toThrow(
      /Unknown brand "zzzzzzzz".*The brands that ship are: astro, docker.*brand:custom\/<name>/,
    );
  });

  it("explains brand:custom with no name", () => {
    expect(() => parseSiteConfig(withIcon("brand:custom"))).toThrow(/brand:custom needs the name/);
  });

  it("still refuses a value that is no icon name", () => {
    expect(() => parseSiteConfig(withIcon("Not An Icon"))).toThrow(/is not an icon name/);
  });

  it("lists the icons a config uses", () => {
    expect(configIcons(parseSiteConfig(withIcon("brand:npm")))).toEqual(["brand:npm"]);
  });

  it("has a message for every shape, none of them empty", () => {
    expect(iconProblem("brand:github")).toBeUndefined();
    expect(iconProblem("brand:custom/ok")).toBeUndefined();
    expect(iconProblem("brand:nope")).toMatch(/nope/);
  });
});

describe("repositoryLink", () => {
  it.each([
    ["https://github.com/demo/widget", "GitHub", "brand:github"],
    ["https://www.github.com/demo/widget", "GitHub", "brand:github"],
    ["https://gitlab.com/demo/widget", "GitLab", "brand:gitlab"],
    ["https://code.example.org/demo/widget", "Repository", "git-branch"],
    ["not a url", "Repository", "git-branch"],
  ])("names %s", (url, name, icon) => {
    expect(repositoryLink(url)).toEqual({ name, icon });
  });
});

describe("Icon with a brand", () => {
  it("is an inline SVG filled with currentColor, and nothing else", () => {
    const html = render({ name: "brand:github" });
    expect(html).toMatch(/^<svg\b/);
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain(`d="${findBrand("github")!.path}"`);
    expect(html).toContain('viewBox="0 0 24 24"');
  });

  it("is hidden from assistive technology when the text next to it names the brand", () => {
    const html = render({ name: "brand:github" });
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("role=");
    expect(html).not.toContain("<title>");
  });

  it("has a name, and a title a browser shows, when it stands alone", () => {
    const html = render({ name: "brand:github", label: "GitHub repository" });
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="GitHub repository"');
    expect(html).toContain("<title>GitHub repository</title>");
    expect(html).not.toContain("aria-hidden");
  });

  it("takes its size and class from the caller, like a lucide icon", () => {
    const html = render({ name: "brand:npm", className: "size-5 text-brand", size: 16 });
    expect(html).toContain('class="size-5 text-brand"');
    expect(html).toContain('width="16"');
  });

  it("asks nothing from any host: no link, no image, no style and no address but the SVG namespace", () => {
    for (const brand of BRANDS) {
      const html = render({ name: `brand:${brand.slug}`, label: brand.title });
      expect(html).not.toMatch(/\b(href|src|srcset|style)=|url\(|<image|<use|<script|<style/i);
      expect([...html.matchAll(/https?:\/\/[^"'\s]+/g)].map((match) => match[0])).toEqual([
        "http://www.w3.org/2000/svg",
      ]);
    }
  });

  it("shows a plain circle for a brand it does not know, as it does for a lucide name", () => {
    const html = render({ name: "brand:nope" });
    expect(html).toContain("<circle");
    expect(html).toContain('aria-hidden="true"');
  });

  it("still draws a lucide icon, hidden unless it is named", () => {
    expect(render({ name: "shield-check" })).toContain('aria-hidden="true"');
    expect(render({ name: "shield-check", label: "Safe" })).toContain('role="img"');
  });
});

describe("Icon with a custom logo", () => {
  const glyph = parseCustomSvg(
    '<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/><path d="M2 2h6v6H2z" fill-rule="evenodd"/></svg>',
    "brands/acme.svg",
  );

  it("draws the paths of the glyph the site passes in", () => {
    const html = render({ name: "brand:custom/acme", brands: { "brand:custom/acme": glyph } });
    expect(html).toContain('viewBox="0 0 10 10"');
    expect(html.match(/<path\b/g)).toHaveLength(2);
    expect(html).toContain('fill-rule="evenodd"');
    expect(html).toContain('fill="currentColor"');
  });

  it("shows a circle when the site passed nothing for it", () => {
    expect(render({ name: "brand:custom/acme" })).toContain("<circle");
  });
});

describe("parseCustomSvg", () => {
  const svg = (inner: string, attributes = 'viewBox="0 0 24 24"') =>
    `<svg ${attributes}>${inner}</svg>`;

  it("keeps the view box and the path data, and drops the rest of a real-world file", () => {
    const glyph = parseCustomSvg(
      `<?xml version="1.0"?><!-- made by hand --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0, 0 24  24" width="48"><title>Acme</title><g><path d="M1 1L5 5Z"/></g></svg>`,
      "brands/acme.svg",
    );
    expect(glyph).toEqual({ viewBox: "0 0 24 24", paths: [{ d: "M1 1L5 5Z" }] });
  });

  it("takes out a comment that the removal of another one closed up", () => {
    const glyph = parseCustomSvg(
      svg('<!<!-- one -->-- <script>alert(1)</script> --><path d="M0 0L5 5Z"/>'),
      "brands/acme.svg",
    );
    expect(glyph).toEqual({ viewBox: "0 0 24 24", paths: [{ d: "M0 0L5 5Z" }] });
  });

  it.each([
    [
      "a shape that is not a path",
      svg('<rect width="4" height="4"/>'),
      /uses <rect>.*convert other shapes to paths/,
    ],
    ["a script", svg('<path d="M0 0"/><script>alert(1)</script>'), /uses <script>/],
    ["an external image", svg('<image href="https://example.com/a.png"/>'), /uses <image>/],
    ["a style element", svg('<style>path{fill:red}</style><path d="M0 0"/>'), /uses <style>/],
    ["a transform", svg('<path d="M0 0" transform="scale(2)"/>'), /uses a transform/],
    ["a stroke", svg('<path d="M0 0L5 5" stroke="black"/>'), /outline-only/],
    ["no fill", svg('<path d="M0 0L5 5" fill="none"/>'), /outline-only/],
    ["path data with a quote in it", svg('<path d="M0 0&quot;onload=x"/>'), /valid path data/],
    ["no path data", svg("<path/>"), /valid path data/],
    ["no path", svg("<g/>"), /has no <path>/],
    ["no view box", '<svg><path d="M0 0"/></svg>', /needs a viewBox/],
    [
      "a view box that is not four numbers",
      svg('<path d="M0 0"/>', 'viewBox="0 0 24"'),
      /needs a viewBox/,
    ],
    ["a file that is not an SVG", "<html></html>", /not an SVG/],
    ["a file that is too large", svg(`<path d="${"M0 0 ".repeat(5000)}"/>`), /larger than 20 KB/],
  ])("refuses %s, and names the file", (_name, source, message) => {
    expect(() => parseCustomSvg(source, "brands/acme.svg")).toThrow(message);
    expect(() => parseCustomSvg(source, "brands/acme.svg")).toThrow(/^brands\/acme\.svg: /);
  });
});
