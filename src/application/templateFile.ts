import type { TemplateFile } from "./ports";

/** Name for a site's `package.json`, made from the site name: lowercase, hyphens, `-docs` after it. */
export function packageName(siteName: string): string {
  const slug = siteName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "site"}-docs`;
}

/** What makes a site's `package.json` its own: the package name and description. */
export interface SiteIdentity {
  name: string;
  description: string;
}

/** The identity `init` gives a site called `siteName`. */
export function identityFor(siteName: string): SiteIdentity {
  return { name: packageName(siteName), description: `Documentation site for ${siteName}.` };
}

/**
 * The text of a template file as it is written into a site. Every file is copied as it is, except
 * the two manifests, which carry the name of the site. `init` and `upgrade` both render files with
 * this function, so a hash taken at one time can be compared with a hash taken at another.
 */
export function renderTemplateFile(file: TemplateFile, identity: SiteIdentity): string {
  if (file.path === "package.json") {
    const pkg = JSON.parse(file.content) as Record<string, unknown>;
    return `${JSON.stringify({ ...pkg, name: identity.name, description: identity.description }, null, 2)}\n`;
  }
  if (file.path === "package-lock.json") {
    const lockJson = JSON.parse(file.content) as {
      name?: string;
      packages?: Record<string, { name?: string }>;
    };
    lockJson.name = identity.name;
    if (lockJson.packages?.[""]) lockJson.packages[""].name = identity.name;
    return `${JSON.stringify(lockJson, null, 2)}\n`;
  }
  return file.content;
}
