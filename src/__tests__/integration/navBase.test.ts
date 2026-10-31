import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withSiteBase } from "../../../template/src/domain";
import { loadSiteConfig } from "../../../template/src/infrastructure";

let site: string;

/** A site folder whose config has a base, a nav and footer links, read by the real config loader. */
function writeSite(base: string, nav: unknown[], footerLinks: unknown[]) {
  writeFileSync(
    join(site, "sitekit.config.json"),
    JSON.stringify({
      site: { name: "Demo", description: "d", url: "https://me.github.io", base },
      hero: { title: "Demo", lede: "l", primary: { label: "Go", href: "/docs/" } },
      collections: [{ id: "docs", label: "Docs", dir: "../docs" }],
      nav,
      footer: { links: footerLinks },
    }),
  );
}

beforeEach(() => {
  const repo = mkdtempSync(join(tmpdir(), "sitekit-nav-base-"));
  site = join(repo, "site");
  mkdirSync(site);
});

afterEach(() => rmSync(join(site, ".."), { recursive: true, force: true }));

const LINKS = [
  { label: "Guide", href: "/docs/start/" },
  { label: "Already based", href: "/acme/docs/start/" },
  { label: "Blog", href: "https://blog.acme.example" },
  { label: "Mail", href: "mailto:team@acme.example" },
  { label: "Top", href: "#top" },
];

describe("the base on the links of the config, read from a real sitekit.config.json", () => {
  it("adds the base to a path of the site in nav and in footer.links, and leaves the other links alone", () => {
    writeSite("/acme/", LINKS, LINKS);
    const config = loadSiteConfig(site);
    const expected = [
      "/acme/docs/start/",
      "/acme/docs/start/",
      "https://blog.acme.example",
      "mailto:team@acme.example",
      "#top",
    ];
    expect(config.nav.map((link) => withSiteBase(link.href, config.site.base))).toEqual(expected);
    expect(config.footer.links.map((link) => withSiteBase(link.href, config.site.base))).toEqual(
      expected,
    );
  });

  it("changes nothing on a site with the root as its base", () => {
    writeSite("/", LINKS, LINKS);
    const config = loadSiteConfig(site);
    expect(config.nav.map((link) => withSiteBase(link.href, config.site.base))).toEqual(
      LINKS.map((link) => link.href),
    );
  });
});
