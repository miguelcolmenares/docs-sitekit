import { parseSiteConfig } from "../../template/src/domain";
import type { SiteConfig } from "../../template/src/domain";

/** What a repository says about itself, as input to `deriveConfig`. */
export interface RepositoryFacts {
  packageJson?: {
    name?: string;
    description?: string;
    version?: string;
    license?: string;
    private?: boolean;
    homepage?: string;
    repository?: string | { url?: string };
  };
  /** Output of `git remote get-url origin`, or undefined when there is no remote. */
  remoteUrl?: string;
  /** Used when the package has no description: the first paragraph of the README. */
  readmeDescription?: string;
  /** Folders that hold pages, found in the repository, in menu order. `dir` is relative to the repository root. */
  collections: { id: string; label: string; dir: string }[];
  hasChangelog: boolean;
  /** The branch the repository is developed on, for the "Edit this page" link. */
  defaultBranch?: string;
  /** Name of the folder, the last resort for a project name. */
  folderName: string;
}

/** A repository on GitHub, split into owner, name and web address. */
export interface GitHubRepository {
  owner: string;
  name: string;
  url: string;
}

/** Read `https://github.com/o/r.git`, `git@github.com:o/r.git` and `git+https://…` into owner and name. */
export function parseGitHubUrl(value: string | undefined): GitHubRepository | undefined {
  if (!value) return undefined;
  const match = /github\.com[:/]+([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(value.trim());
  if (!match) return undefined;
  const [, owner, name] = match as unknown as [string, string, string];
  return { owner, name, url: `https://github.com/${owner}/${name}` };
}

const unscoped = (name: string) => name.replace(/^@[^/]+\//, "");

/** Build a valid `sitekit.config.json` from what the repository already says about itself. */
export function deriveConfig(facts: RepositoryFacts): SiteConfig {
  const pkg = facts.packageJson ?? {};
  const repoField = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  const github = parseGitHubUrl(facts.remoteUrl) ?? parseGitHubUrl(repoField);

  const name = unscoped(pkg.name ?? github?.name ?? facts.folderName);
  const description =
    pkg.description?.trim() || facts.readmeDescription?.trim() || `Documentation for ${name}.`;
  const userSite =
    github && github.name.toLowerCase() === `${github.owner.toLowerCase()}.github.io`;

  const first = facts.collections[0];
  const firstPage = first ? `/${first.id}/` : "/";
  const installable = pkg.name !== undefined && pkg.private !== true;

  return parseSiteConfig({
    site: {
      name,
      description,
      url: github ? `https://${github.owner.toLowerCase()}.github.io` : "https://example.github.io",
      base: github && !userSite ? `/${github.name}/` : "/",
      ...(github ? { repository: github.url } : {}),
      ...(pkg.license ? { license: pkg.license } : {}),
      ...(installable ? { installCommand: `npm install ${pkg.name}` } : {}),
    },
    hero: {
      title: name,
      lede: description,
      primary: { label: "Get started", href: firstPage },
      ...(github ? { secondary: { label: "View on GitHub", href: github.url } } : {}),
    },
    collections: facts.collections.map((collection) => ({
      id: collection.id,
      label: collection.label,
      dir: `../${collection.dir}`,
    })),
    // A new site gets its llms.txt. A site generated before the key existed does not change by itself.
    llms: { enabled: true, optional: [], markdownPages: false },
    // So do the edit link and the date of the last change. The link needs a repository address on a host the kit knows.
    editLink: { enabled: github !== undefined, branch: facts.defaultBranch ?? "main" },
    lastUpdated: { enabled: true },
  });
}
