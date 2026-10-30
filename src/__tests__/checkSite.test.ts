import { checkSite } from "../application";
import type { CheckDeps } from "../application";
import { parseSiteConfig } from "../../template/src/domain";
import type { Document, SourceFile } from "../../template/src/domain";
import { fakeEnv, MemoryFileSystem } from "./support/memory";

const ROOT = "/work/widget";
const awsKey = ["AKIA", "IOSFODNN7EXAMPLE"].join("");

const config = (
  deploy: Record<string, unknown> = {},
  anonymize: Record<string, unknown> = {},
  llms: Record<string, unknown> = {},
  base = "/",
  search: boolean = true,
) =>
  parseSiteConfig({
    site: {
      name: "W",
      description: "d",
      url: "https://me.github.io",
      base,
      repository: "https://github.com/me/widget",
    },
    hero: { title: "W", lede: "l", primary: { label: "Go", href: "/" } },
    deploy,
    anonymize,
    llms,
    search: { enabled: search },
  });

const doc = (path: string, content: string): SourceFile => ({
  path,
  collection: "docs",
  collectionPath: path.replace(/^docs\//, ""),
  frontmatter: {},
  content,
});

function run(options: {
  files?: SourceFile[];
  documents?: Document[];
  deploy?: Record<string, unknown>;
  anonymize?: Record<string, unknown>;
  llms?: Record<string, unknown>;
  base?: string;
  visibility?: "public" | "private" | "internal" | "unknown";
  dist?: Record<string, string>;
  search?: boolean;
  routes?: string[];
}) {
  const fs = new MemoryFileSystem(
    options.dist
      ? Object.fromEntries(Object.entries(options.dist).map(([k, v]) => [`/dist/${k}`, v]))
      : {},
  );
  const deps: CheckDeps = {
    fs,
    env: fakeEnv({ visibility: options.visibility ?? "public" }),
    loadContent: () => ({
      config: config(
        options.deploy,
        options.anonymize,
        options.llms,
        options.base,
        options.search ?? true,
      ),
      files: options.files ?? [doc("docs/a.md", "# A\n\nFine.")],
      documents: options.documents ?? [],
      routes: options.routes ?? ["/docs/a/"],
    }),
  };
  return checkSite(deps, { root: ROOT, siteDir: "site", dist: options.dist ? "/dist" : undefined });
}

const page = (title = "Home") =>
  `<html lang="en"><head><title>${title}</title></head><body>${title}</body></html>`;
const indexOf = (urls: string[], text = "Fine.") =>
  JSON.stringify({
    collections: { docs: "Docs" },
    pages: urls.map((url) => ({ url, title: "A", collection: "docs", headings: [], text })),
  });
const goodDist = {
  "index.html": page("Home"),
  "404.html": page("Not found"),
  "docs/a/index.html": page("A"),
  "search-index.json": indexOf(["/docs/a/"]),
};

describe("checkSite content", () => {
  it("passes clean content", () => {
    expect(run({}).errors).toEqual([]);
  });

  it("reports a credential found in a markdown file, masked", () => {
    const report = run({ files: [doc("docs/a.md", `# A\n\nkey ${awsKey}`)] });
    expect(report.errors.join("\n")).toMatch(/docs\/a\.md: aws-access-key/);
    expect(report.errors.join("\n")).not.toContain(awsKey);
  });

  it("reports an email address that is not on the allow list", () => {
    expect(run({ files: [doc("docs/a.md", "write to team@company.dev")] }).errors).toHaveLength(1);
    expect(
      run({
        files: [doc("docs/a.md", "write to team@company.dev")],
        anonymize: { allow: ["team@company.dev"] },
      }).errors,
    ).toEqual([]);
  });

  it("applies the deny patterns from the config", () => {
    expect(
      run({
        files: [doc("docs/a.md", "host acme-prod.example.io")],
        anonymize: { denyPatterns: ["acme-[a-z]+\\.example\\.io"] },
      }).errors,
    ).toHaveLength(1);
  });
});

describe("checkSite visibility", () => {
  it("fails a private repository that would publish to GitHub Pages", () => {
    expect(run({ visibility: "private" }).errors.join()).toMatch(/private.*acknowledgePublicPages/);
  });

  it("passes with an acknowledgement, and keeps warning about it", () => {
    const report = run({ visibility: "private", deploy: { acknowledgePublicPages: true } });
    expect(report.errors).toEqual([]);
    expect(report.warnings.join()).toMatch(/Acknowledged/);
  });

  it("fails when it cannot tell, instead of guessing", () => {
    expect(run({ visibility: "unknown" }).errors.join()).toMatch(
      /Cannot tell.*repositoryVisibility/,
    );
  });

  it("uses the configured visibility over asking the host", () => {
    expect(
      run({ visibility: "unknown", deploy: { repositoryVisibility: "public" } }).errors,
    ).toEqual([]);
  });

  it("skips the rule when the site is not deployed to Pages", () => {
    expect(run({ visibility: "private", deploy: { target: "none" } }).errors).toEqual([]);
  });
});

describe("checkSite built output", () => {
  it("passes a well-formed site", () => {
    expect(run({ dist: goodDist }).errors).toEqual([]);
  });

  it("fails when the build folder is missing", () => {
    const fs = new MemoryFileSystem();
    const report = checkSite(
      {
        fs,
        env: fakeEnv(),
        loadContent: () => ({ config: config(), files: [], documents: [], routes: [] }),
      },
      { root: ROOT, siteDir: "site", dist: "/nope" },
    );
    expect(report.errors.join()).toMatch(/does not exist/);
  });

  it("fails when 404.html is a copy of index.html", () => {
    expect(run({ dist: { ...goodDist, "404.html": page("Home") } }).errors.join()).toMatch(
      /copy of index\.html/,
    );
  });

  it("fails when 404.html or index.html is missing", () => {
    expect(run({ dist: { "index.html": page() } }).errors.join()).toMatch(/404\.html is missing/);
    expect(run({ dist: { "404.html": page() } }).errors.join()).toMatch(/index\.html is missing/);
  });

  it("fails a page without a title", () => {
    expect(
      run({
        dist: { ...goodDist, "docs/b/index.html": "<html><body>no title</body></html>" },
      }).errors.join(),
    ).toMatch(/docs\/b\/index\.html has no <title>/);
  });

  it("finds a credential in a built bundle, but ignores email-like text there", () => {
    const withKey = run({ dist: { ...goodDist, "_astro/app.js": `const k="${awsKey}"` } });
    expect(withKey.errors.join()).toMatch(/dist\/_astro\/app\.js: aws-access-key/);
    const withEmail = run({ dist: { ...goodDist, "_astro/app.js": 'const m="me@corp-team.dev"' } });
    expect(withEmail.errors).toEqual([]);
  });
});

const pageOf = (path: string, route: string, title: string): Document => ({
  collection: "docs",
  path,
  slug: route.split("/").filter(Boolean).pop()!,
  route,
  title,
  description: "Fine.",
  descriptionSource: "content",
  order: null,
  tags: [],
  group: null,
  body: "",
});
const twoPages = [pageOf("docs/a.md", "/docs/a/", "A"), pageOf("docs/b.md", "/docs/b/", "B")];
const llmsOn = { enabled: true };
const llmsText = (...links: string[]) => `# W\n\n> d\n\n## Docs\n\n${links.join("\n")}\n`;
const goodLink = "- [A](https://me.github.io/docs/a/): Fine.";
const goodDist2 = { ...goodDist, "llms.txt": llmsText(goodLink) };

describe("checkSite llms.txt", () => {
  it("passes a site whose llms.txt starts with an H1, links to built pages and lists every page", () => {
    expect(
      run({ dist: goodDist2, llms: llmsOn, documents: [pageOf("docs/a.md", "/docs/a/", "A")] })
        .errors,
    ).toEqual([]);
  });

  it("does not look at llms.txt when the option is off", () => {
    expect(run({ dist: goodDist, documents: twoPages }).errors).toEqual([]);
  });

  it("fails when llms.txt is missing from the build", () => {
    expect(run({ dist: goodDist, llms: llmsOn, documents: twoPages }).errors.join()).toMatch(
      /dist\/llms\.txt is missing/,
    );
  });

  it("fails when llms.txt does not start with an H1", () => {
    const report = run({
      dist: { ...goodDist, "llms.txt": llmsText(goodLink).replace(/^# W\n\n/, "") },
      llms: llmsOn,
      documents: [pageOf("docs/a.md", "/docs/a/", "A")],
    });
    expect(report.errors.join()).toMatch(/does not start with an H1/);
  });

  it("names a link to a page that is not in the build", () => {
    const report = run({
      dist: {
        ...goodDist,
        "llms.txt": llmsText(goodLink, "- [Gone](https://me.github.io/docs/gone/)"),
      },
      llms: llmsOn,
      documents: [pageOf("docs/a.md", "/docs/a/", "A")],
    });
    expect(report.errors.join("\n")).toMatch(
      /links to https:\/\/me\.github\.io\/docs\/gone\/, but dist\/docs\/gone\/index\.html does not exist/,
    );
  });

  it("names a page of the site that llms.txt leaves out", () => {
    const report = run({
      dist: { ...goodDist, "docs/b/index.html": page("B"), "llms.txt": llmsText(goodLink) },
      llms: llmsOn,
      documents: twoPages,
    });
    expect(report.errors.join("\n")).toMatch(/does not list the page docs\/b\.md \(\/docs\/b\/\)/);
  });

  it("checks links and pages under a project base, and names a link outside the base", () => {
    const dist = {
      ...goodDist,
      "llms.txt": llmsText("- [A](https://me.github.io/widget/docs/a/): Fine."),
    };
    expect(
      run({
        dist,
        llms: llmsOn,
        search: false,
        base: "/widget/",
        documents: [pageOf("docs/a.md", "/widget/docs/a/", "A")],
      }).errors,
    ).toEqual([]);
    const outside = run({
      dist: { ...goodDist, "llms.txt": llmsText(goodLink) },
      llms: llmsOn,
      search: false,
      base: "/widget/",
      documents: [pageOf("docs/a.md", "/widget/docs/a/", "A")],
    });
    expect(outside.errors.join()).toMatch(/not an address of this site/);
  });

  it("finds a credential in llms.txt, masked", () => {
    const report = run({
      dist: { ...goodDist, "llms.txt": llmsText(`${goodLink} key ${awsKey}`) },
      llms: llmsOn,
      documents: [pageOf("docs/a.md", "/docs/a/", "A")],
    });
    expect(report.errors.join("\n")).toMatch(/dist\/llms\.txt: aws-access-key/);
    expect(report.errors.join("\n")).not.toContain(awsKey);
  });

  it("finds an internal host in llms.txt, which the site description can carry", () => {
    const report = run({
      dist: {
        ...goodDist,
        "llms.txt": "# W\n\n> Served from wiki.corp.internal.\n\n## Docs\n\n" + goodLink + "\n",
      },
      llms: llmsOn,
      documents: [pageOf("docs/a.md", "/docs/a/", "A")],
    });
    expect(report.errors.join("\n")).toMatch(/dist\/llms\.txt: internal-hostname/);
  });

  it("fails a page without its Markdown copy when markdownPages is on, and names the page", () => {
    const report = run({
      dist: { ...goodDist2 },
      llms: { enabled: true, markdownPages: true },
      documents: [pageOf("docs/a.md", "/docs/a/", "A")],
    });
    expect(report.errors.join("\n")).toMatch(
      /dist\/docs\/a\/index\.html\.md is missing, so the page docs\/a\.md/,
    );
  });

  it("scans the Markdown copies for credentials", () => {
    const report = run({
      dist: {
        ...goodDist2,
        "docs/a/index.html.md": `# A\n\nkey ${awsKey}`,
      },
      llms: { enabled: true, markdownPages: true },
      documents: [pageOf("docs/a.md", "/docs/a/", "A")],
    });
    expect(report.errors.join("\n")).toMatch(/dist\/docs\/a\/index\.html\.md: aws-access-key/);
  });
});

describe("checkSite search index", () => {
  it("fails when search is on and the build has no index, and says so", () => {
    const withoutIndex = Object.fromEntries(
      Object.entries(goodDist).filter(([path]) => path !== "search-index.json"),
    );
    expect(run({ dist: withoutIndex }).errors.join()).toMatch(
      /dist\/search-index\.json is missing/,
    );
  });

  it("does not ask for an index when search is off", () => {
    const withoutIndex = Object.fromEntries(
      Object.entries(goodDist).filter(([path]) => path !== "search-index.json"),
    );
    expect(run({ dist: withoutIndex, search: false }).errors).toEqual([]);
  });

  it("names a page that has no entry in the index", () => {
    const report = run({
      dist: { ...goodDist, "docs/b/index.html": page("B") },
      routes: ["/docs/a/", "/docs/b/"],
    });
    expect(report.errors.join()).toMatch(/no entry for the page \/docs\/b\//);
  });

  it("names an entry that is not a page, and an entry whose page was not built", () => {
    expect(
      run({
        dist: { ...goodDist, "search-index.json": indexOf(["/docs/a/", "/docs/gone/"]) },
      }).errors.join(),
    ).toMatch(/lists \/docs\/gone\/, which is not a page/);
    expect(
      run({
        dist: { ...goodDist, "search-index.json": indexOf(["/docs/a/", "/docs/c/"]) },
        routes: ["/docs/a/", "/docs/c/"],
      }).errors.join(),
    ).toMatch(/\/docs\/c\/ is in the search index, but it was not built/);
  });

  it("fails an index that is not JSON, or has no pages list", () => {
    expect(run({ dist: { ...goodDist, "search-index.json": "{" } }).errors.join()).toMatch(
      /not a search index/,
    );
    expect(run({ dist: { ...goodDist, "search-index.json": "{}" } }).errors.join()).toMatch(
      /not a search index/,
    );
  });

  it("scans the index like any built file, so a credential in a page body is found there", () => {
    const report = run({
      dist: { ...goodDist, "search-index.json": indexOf(["/docs/a/"], `key ${awsKey}`) },
    });
    expect(report.errors.join("\n")).toMatch(/dist\/search-index\.json: aws-access-key/);
    expect(report.errors.join("\n")).not.toContain(awsKey);
  });
});
