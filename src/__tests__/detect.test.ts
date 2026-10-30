import { deriveConfig, parseGitHubUrl } from "../domain";
import type { RepositoryFacts } from "../domain";

const facts = (overrides: Partial<RepositoryFacts> = {}): RepositoryFacts => ({
  collections: [{ id: "docs", label: "Docs", dir: "docs" }],
  hasChangelog: true,
  folderName: "my-folder",
  ...overrides,
});

describe("parseGitHubUrl", () => {
  it.each([
    ["https://github.com/me/proj.git", "me", "proj"],
    ["git@github.com:me/proj.git", "me", "proj"],
    ["git+https://github.com/me/proj.git", "me", "proj"],
    ["https://github.com/me/proj/", "me", "proj"],
  ])("reads %s", (url, owner, name) => {
    expect(parseGitHubUrl(url)).toEqual({
      owner,
      name,
      url: `https://github.com/${owner}/${name}`,
    });
  });

  it("returns undefined for other hosts and for nothing", () => {
    expect(parseGitHubUrl("https://bitbucket.org/me/proj.git")).toBeUndefined();
    expect(parseGitHubUrl(undefined)).toBeUndefined();
  });
});

describe("deriveConfig", () => {
  it("builds a project site URL and base from the GitHub remote", () => {
    const config = deriveConfig(
      facts({
        packageJson: {
          name: "@me/widget",
          description: "A widget.",
          license: "MIT",
          version: "1.2.3",
        },
        remoteUrl: "https://github.com/Me/widget.git",
      }),
    );
    expect(config.site).toMatchObject({
      name: "widget",
      description: "A widget.",
      url: "https://me.github.io",
      base: "/widget/",
      repository: "https://github.com/Me/widget",
      license: "MIT",
      installCommand: "npm install @me/widget",
    });
    // Not copied into the config: the site reads it from package.json at build time, so a release rebuild shows the release.
    expect(config.site.version).toBeUndefined();
    expect(config.hero.primary).toEqual({ label: "Get started", href: "/docs/" });
    expect(config.hero.secondary?.href).toBe("https://github.com/Me/widget");
  });

  it("uses base / for a user site", () => {
    const config = deriveConfig(facts({ remoteUrl: "https://github.com/me/me.github.io.git" }));
    expect(config.site.base).toBe("/");
  });

  it("does not suggest an install command for a private package", () => {
    const config = deriveConfig(facts({ packageJson: { name: "internal", private: true } }));
    expect(config.site.installCommand).toBeUndefined();
  });

  it("falls back to the README, then to the folder name", () => {
    expect(deriveConfig(facts({ readmeDescription: "From the readme." })).site.description).toBe(
      "From the readme.",
    );
    const bare = deriveConfig(facts());
    expect(bare.site.name).toBe("my-folder");
    expect(bare.site.description).toBe("Documentation for my-folder.");
  });

  it("points the primary action at the first collection that exists, and at the home page when there is none", () => {
    const examples = [{ id: "examples", label: "Examples", dir: "examples" }];
    expect(deriveConfig(facts({ collections: examples })).hero.primary.href).toBe("/examples/");
    expect(deriveConfig(facts({ collections: [] })).hero.primary.href).toBe("/");
  });

  it("turns the folders it found into collections, with their folder relative to the site", () => {
    const config = deriveConfig(
      facts({
        collections: [
          { id: "docs", label: "Docs", dir: "docs" },
          { id: "tutorials", label: "Tutorials", dir: "docs/tutorials" },
          { id: "examples", label: "Examples", dir: "examples" },
        ],
      }),
    );
    expect(config.collections.map((c) => [c.id, c.label, c.dir])).toEqual([
      ["docs", "Docs", "../docs"],
      ["tutorials", "Tutorials", "../docs/tutorials"],
      ["examples", "Examples", "../examples"],
    ]);
    expect(config.collections.every((c) => c.groups.length === 0)).toBe(true);
  });

  it("turns the edit link on for a GitHub repository, on the branch the repository uses, and the dates on", () => {
    const config = deriveConfig(
      facts({ remoteUrl: "https://github.com/me/proj.git", defaultBranch: "develop" }),
    );
    expect(config.editLink).toEqual({ enabled: true, branch: "develop" });
    expect(config.lastUpdated).toEqual({ enabled: true });
  });

  it("uses main when the branch is not known, and leaves the link off without a GitHub repository", () => {
    const github = deriveConfig(facts({ remoteUrl: "https://github.com/me/proj.git" }));
    expect(github.editLink.branch).toBe("main");
    const none = deriveConfig(facts());
    expect(none.editLink.enabled).toBe(false);
    expect(none.lastUpdated.enabled).toBe(true);
  });

  it("produces a config that passes the schema without a GitHub remote", () => {
    const config = deriveConfig(facts({ packageJson: { name: "x" } }));
    expect(config.site.url).toBe("https://example.github.io");
    expect(config.site.base).toBe("/");
    expect(config.site.repository).toBeUndefined();
  });
});
