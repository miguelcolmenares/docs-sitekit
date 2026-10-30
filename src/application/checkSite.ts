import { scanText } from "../domain";
import type { Finding } from "../domain";
import { LLMS_FILE } from "../../template/src/domain";
import type { Document, SiteConfig, SourceFile } from "../../template/src/domain";
import { checkLlms } from "./checkLlms";
import { joinPath } from "./paths";
import type { Environment, FileSystem } from "./ports";

/** What `checkSite` needs from outside: files, the host, and a way to read the site's content. */
export interface CheckDeps {
  fs: FileSystem;
  env: Environment;
  /** Read the config, the markdown the site documents, and the pages built from them. */
  loadContent: (siteAbs: string) => {
    config: SiteConfig;
    files: SourceFile[];
    documents: Document[];
  };
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

const TEXT_FILE = /\.(html|js|mjs|css|json|txt|xml|svg|map|webmanifest|md)$/i;

const describe = (finding: Finding) =>
  `${finding.location}: ${finding.rule} (${finding.confidence}) "${finding.preview}"`;

/** Check that a site is safe to publish: its content, the repository visibility and the built output. */
export function checkSite(deps: CheckDeps, options: CheckOptions): CheckReport {
  const { fs, env } = deps;
  const report: CheckReport = { errors: [], warnings: [], findings: [] };
  const { config, files, documents } = deps.loadContent(joinPath(options.root, options.siteDir));
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
      if (config.llms.enabled) {
        // llms.txt is new text (the site name and description come from the config), so it gets the
        // medium rules too. The Markdown copies repeat the content, which is scanned in full above.
        if (!built.includes(LLMS_FILE)) {
          report.errors.push(
            `dist/${LLMS_FILE} is missing, but llms.enabled is on in sitekit.config.json.`,
          );
        } else {
          report.errors.push(
            ...checkLlms(fs.readText(joinPath(options.dist, LLMS_FILE)), {
              origin: config.site.url,
              base: config.site.base,
              documents,
              built,
              markdownPages: config.llms.markdownPages,
            }),
          );
        }
      }
      for (const path of built.filter((candidate) => TEXT_FILE.test(candidate))) {
        const content = fs.readText(joinPath(options.dist, path));
        report.findings.push(
          ...scanText(content, {
            ...scanOptions,
            location: `dist/${path}`,
            includeMedium: path === LLMS_FILE,
          }),
        );
        if (path.endsWith(".html") && !/<title>[^<]+<\/title>/.test(content))
          report.errors.push(`dist/${path} has no <title>.`);
      }
      if (!built.includes("index.html")) report.errors.push("dist/index.html is missing.");
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
