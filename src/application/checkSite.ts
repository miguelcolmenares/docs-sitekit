import { scanText } from "../domain";
import type { Finding } from "../domain";
import type { SiteConfig, SourceFile } from "../../template/src/domain";
import { joinPath } from "./paths";
import type { Environment, FileSystem } from "./ports";

/** What `checkSite` needs from outside: files, the host, and a way to read the site's content. */
export interface CheckDeps {
  fs: FileSystem;
  env: Environment;
  /** Read the config, the markdown the site documents, and the address of every page the site builds. */
  loadContent: (siteAbs: string) => { config: SiteConfig; files: SourceFile[]; routes: string[] };
}

/** Where to look: the repository, the site folder inside it, and optionally a built site. */
export interface CheckOptions {
  root: string;
  siteDir: string;
  /** Built site to check, as an absolute path. Skipped when not given. */
  dist?: string;
}

/** What a check found. Any entry in `errors` means the site is not safe to publish. */
export interface CheckReport {
  errors: string[];
  warnings: string[];
  findings: Finding[];
}

const TEXT_FILE = /\.(html|js|mjs|css|json|txt|xml|svg|map|webmanifest)$/i;

const describe = (finding: Finding) =>
  `${finding.location}: ${finding.rule} (${finding.confidence}) "${finding.preview}"`;

/**
 * With search on, the built site has a `search-index.json` with one entry per page, and every entry points at a page
 * that was built. Each failure names the page. The scan of the built files already covers the index, as it is JSON.
 */
function checkSearchIndex(
  fs: FileSystem,
  dist: string,
  base: string,
  routes: readonly string[],
  report: CheckReport,
): void {
  const file = joinPath(dist, "search-index.json");
  if (!fs.exists(file)) {
    report.errors.push(
      "dist/search-index.json is missing. Search is on, so the build must make it, or set search.enabled to false.",
    );
    return;
  }
  let pages: { url?: unknown }[];
  try {
    const parsed = JSON.parse(fs.readText(file)) as { pages?: unknown };
    if (!Array.isArray(parsed.pages)) throw new Error("no pages list");
    pages = parsed.pages as { url?: unknown }[];
  } catch {
    report.errors.push("dist/search-index.json is not a search index: it has no pages list.");
    return;
  }

  const listed = new Set(pages.map((page) => String(page.url)));
  for (const route of routes) {
    if (!listed.has(route))
      report.errors.push(`dist/search-index.json has no entry for the page ${route}.`);
  }
  const known = new Set(routes);
  for (const url of listed) {
    if (!known.has(url))
      report.errors.push(`dist/search-index.json lists ${url}, which is not a page of the site.`);
    else if (!url.startsWith(base))
      report.errors.push(`The page ${url} is not under the base path ${base}.`);
    else if (!fs.exists(joinPath(dist, `${url.slice(base.length)}index.html`))) {
      report.errors.push(`The page ${url} is in the search index, but it was not built.`);
    }
  }
}

/** Check that a site is safe to publish: its content, the repository visibility and the built output. */
export function checkSite(deps: CheckDeps, options: CheckOptions): CheckReport {
  const { fs, env } = deps;
  const report: CheckReport = { errors: [], warnings: [], findings: [] };
  const { config, files, routes } = deps.loadContent(joinPath(options.root, options.siteDir));
  const scanOptions = {
    denyPatterns: config.anonymize.denyPatterns,
    allow: config.anonymize.allow,
  };

  // 1. Content: every markdown file that would be published.
  for (const file of files) {
    const text = `${JSON.stringify(file.frontmatter)}\n${file.content}`;
    report.findings.push(
      ...scanText(text, { ...scanOptions, location: file.path, includeMedium: true }),
    );
  }

  // 2. Visibility: a private repository's Pages site is public.
  if (config.deploy.target === "github-pages") {
    const visibility =
      config.deploy.repositoryVisibility ??
      (config.site.repository ? env.repositoryVisibility(config.site.repository) : "unknown");
    if (visibility === "unknown") {
      report.errors.push(
        "Cannot tell whether the repository is private. Set deploy.repositoryVisibility in sitekit.config.json.",
      );
    } else if (visibility !== "public") {
      if (config.deploy.acknowledgePublicPages) {
        report.warnings.push(
          `The repository is ${visibility}, and GitHub Pages will publish this site publicly. Acknowledged in the config.`,
        );
      } else {
        report.errors.push(
          `The repository is ${visibility}, and GitHub Pages would publish this site publicly. Set deploy.acknowledgePublicPages to true if that is intended.`,
        );
      }
    }
  }

  // 3. The built site: credentials, and the shape of the output.
  if (options.dist) {
    if (!fs.exists(options.dist)) {
      report.errors.push(`${options.dist} does not exist. Build the site first.`);
    } else {
      const built = fs.listFiles(options.dist);
      for (const path of built.filter((candidate) => TEXT_FILE.test(candidate))) {
        const content = fs.readText(joinPath(options.dist, path));
        report.findings.push(
          ...scanText(content, { ...scanOptions, location: `dist/${path}`, includeMedium: false }),
        );
        if (path.endsWith(".html") && !/<title>[^<]+<\/title>/.test(content))
          report.errors.push(`dist/${path} has no <title>.`);
      }
      if (!built.includes("index.html")) report.errors.push("dist/index.html is missing.");
      if (config.search.enabled)
        checkSearchIndex(fs, options.dist, config.site.base, routes, report);
      if (!built.includes("404.html"))
        report.errors.push(
          "dist/404.html is missing, so an unknown address would show a blank error.",
        );
      else if (
        built.includes("index.html") &&
        fs.readText(joinPath(options.dist, "404.html")) ===
          fs.readText(joinPath(options.dist, "index.html"))
      ) {
        report.errors.push(
          "dist/404.html is a copy of index.html. It must be the not-found page, so unknown routes answer 404.",
        );
      }
    }
  }

  report.errors.push(
    ...report.findings.map((finding) => `Possible secret or internal detail: ${describe(finding)}`),
  );
  return report;
}
