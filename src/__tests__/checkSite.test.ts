import { checkSite } from "../application";
import type { CheckDeps } from "../application";
import { parseSiteConfig } from "../../template/src/domain";
import type { SourceFile } from "../../template/src/domain";
import { fakeEnv, MemoryFileSystem } from "./support/memory";

const ROOT = "/work/widget";
const awsKey = ["AKIA", "IOSFODNN7EXAMPLE"].join("");

const config = (deploy: Record<string, unknown> = {}, anonymize: Record<string, unknown> = {}) =>
  parseSiteConfig({
    site: {
      name: "W",
      description: "d",
      url: "https://me.github.io",
      repository: "https://github.com/me/widget",
    },
    hero: { title: "W", lede: "l", primary: { label: "Go", href: "/" } },
    deploy,
    anonymize,
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
  deploy?: Record<string, unknown>;
  anonymize?: Record<string, unknown>;
  visibility?: "public" | "private" | "internal" | "unknown";
  dist?: Record<string, string>;
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
      config: config(options.deploy, options.anonymize),
      files: options.files ?? [doc("docs/a.md", "# A\n\nFine.")],
    }),
  };
  return checkSite(deps, { root: ROOT, siteDir: "site", dist: options.dist ? "/dist" : undefined });
}

const page = (title = "Home") =>
  `<html lang="en"><head><title>${title}</title></head><body>${title}</body></html>`;
const goodDist = {
  "index.html": page("Home"),
  "404.html": page("Not found"),
  "docs/a/index.html": page("A"),
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
      { fs, env: fakeEnv(), loadContent: () => ({ config: config(), files: [] }) },
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
