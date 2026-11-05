import {
  detectEditHost,
  editAddress,
  parseSiteConfig,
  resolveEditHost,
} from "../../../template/src/domain";

const GITHUB = "https://github.com/me/widget";

describe("editAddress", () => {
  it("builds {repository}/edit/{branch}/{path} for a page in docs/", () => {
    expect(
      editAddress({ repository: GITHUB, host: "github", branch: "main", path: "docs/guide.md" }),
    ).toBe("https://github.com/me/widget/edit/main/docs/guide.md");
  });

  it("keeps the folder of a collection with a custom folder, and a page in a nested folder", () => {
    expect(
      editAddress({
        repository: GITHUB,
        host: "github",
        branch: "main",
        path: "handbook/tutorials/first-steps.md",
      }),
    ).toBe("https://github.com/me/widget/edit/main/handbook/tutorials/first-steps.md");
  });

  it("puts the folder of the sources under the repository path, for a site in a subfolder", () => {
    // A package inside a monorepo: the sources start at packages/widget/, and the page is docs/guide.md in them.
    expect(
      editAddress({
        repository: GITHUB,
        host: "github",
        branch: "main",
        path: "packages/widget/docs/guide.md",
      }),
    ).toBe("https://github.com/me/widget/edit/main/packages/widget/docs/guide.md");
  });

  it("uses the branch it is given, and keeps the slash of a branch such as release/1.x", () => {
    expect(
      editAddress({ repository: GITHUB, host: "github", branch: "release/1.x", path: "a.md" }),
    ).toBe("https://github.com/me/widget/edit/release/1.x/a.md");
  });

  it("drops a trailing slash and .git from the repository, and encodes names that would break the address", () => {
    expect(
      editAddress({
        repository: `${GITHUB}.git/`,
        host: "github",
        branch: "main",
        path: "docs/a b#1.md",
      }),
    ).toBe("https://github.com/me/widget/edit/main/docs/a%20b%231.md");
  });

  it("knows the edit address of GitLab and Bitbucket", () => {
    expect(
      editAddress({
        repository: "https://gitlab.com/me/widget",
        host: "gitlab",
        branch: "main",
        path: "docs/a.md",
      }),
    ).toBe("https://gitlab.com/me/widget/-/edit/main/docs/a.md");
    expect(
      editAddress({
        repository: "https://bitbucket.org/me/widget",
        host: "bitbucket",
        branch: "main",
        path: "docs/a.md",
      }),
    ).toBe("https://bitbucket.org/me/widget/src/main/docs/a.md?mode=edit");
  });
});

describe("detectEditHost", () => {
  it.each([
    ["https://github.com/me/widget", "github"],
    ["https://GitHub.com/me/widget", "github"],
    ["https://gitlab.com/me/widget", "gitlab"],
    ["https://bitbucket.org/me/widget", "bitbucket"],
  ])("reads the host of %s", (address, host) => {
    expect(detectEditHost(address)).toBe(host);
  });

  it("does not take a host from a lookalike name or a path", () => {
    expect(detectEditHost("https://github.com.evil.example/me/widget")).toBeUndefined();
    expect(detectEditHost("https://example.org/github.com/me/widget")).toBeUndefined();
    expect(detectEditHost("not an address")).toBeUndefined();
    expect(detectEditHost(undefined)).toBeUndefined();
  });
});

describe("resolveEditHost", () => {
  it("detects the host from the repository", () => {
    expect(resolveEditHost(GITHUB, undefined)).toEqual({ ok: true, host: "github" });
  });

  it("lets editLink.host win, for a repository on a domain of its own", () => {
    expect(resolveEditHost("https://git.example.org/me/widget", "gitlab")).toEqual({
      ok: true,
      host: "gitlab",
    });
  });

  it("turns the link off with a message when the host is unknown, never with a guessed address", () => {
    const result = resolveEditHost("https://git.example.org/me/widget", undefined);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: expect.stringContaining("editLink.host") });
  });

  it("turns the link off with a message when there is no repository", () => {
    const result = resolveEditHost(undefined, undefined);
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining("site.repository") });
  });
});

describe("the editLink and lastUpdated keys of the config", () => {
  const valid = {
    site: { name: "Demo", description: "A demo", url: "https://me.github.io" },
    hero: { title: "Demo", lede: "Lede", primary: { label: "Start", href: "/docs/" } },
  };

  it("are off when the config does not have them, so a site that exists does not change", () => {
    const config = parseSiteConfig(valid);
    expect(config.editLink).toEqual({ enabled: false, branch: "main" });
    expect(config.lastUpdated).toEqual({ enabled: false });
  });

  it("take a branch and a host", () => {
    const config = parseSiteConfig({
      ...valid,
      editLink: { enabled: true, branch: "trunk", host: "gitlab" },
    });
    expect(config.editLink).toEqual({ enabled: true, branch: "trunk", host: "gitlab" });
  });

  it("are closed: an undeclared key, an unknown host and an empty branch fail with the key named", () => {
    expect(() => parseSiteConfig({ ...valid, editLink: { enabled: true, label: "x" } })).toThrow(
      /label/,
    );
    expect(() => parseSiteConfig({ ...valid, editLink: { host: "sourcehut" } })).toThrow(
      /editLink\.host/,
    );
    expect(() => parseSiteConfig({ ...valid, editLink: { branch: "" } })).toThrow(
      /editLink\.branch/,
    );
    expect(() => parseSiteConfig({ ...valid, lastUpdated: { format: "long" } })).toThrow(/format/);
  });
});
