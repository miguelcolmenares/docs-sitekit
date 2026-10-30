import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPageMeta } from "../../../template/src/application";
import { parseSiteConfig } from "../../../template/src/domain";
import type { Document } from "../../../template/src/domain";
import { readGitHistory } from "../../../template/src/infrastructure";
import { nodeEnvironment } from "../../infrastructure";

let work: string;

/** Run git in a folder with a fixed identity, and the date of the commit when one is given. */
function git(cwd: string, args: string[], date?: string): void {
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    {
      cwd,
      stdio: "ignore",
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
        ),
        ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}),
      },
    },
  );
}

function commit(cwd: string, files: Record<string, string>, date: string): void {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(cwd, path, ".."), { recursive: true });
    writeFileSync(join(cwd, path), text);
  }
  git(cwd, ["add", ...Object.keys(files)]);
  git(cwd, ["commit", "-q", "-m", `Change ${Object.keys(files).join(", ")}`], date);
}

beforeEach(() => {
  work = realpathSync(mkdtempSync(join(tmpdir(), "sitekit-history-")));
});
afterEach(() => rmSync(work, { recursive: true, force: true }));

describe("readGitHistory, with real git", () => {
  it("gives the date of the commit that last touched the file, not the last commit of the repository", () => {
    git(work, ["init", "-q", "-b", "main"]);
    commit(work, { "docs/a.md": "A\n", "docs/b.md": "B\n" }, "2026-01-10T12:00:00Z");
    commit(work, { "docs/b.md": "B changed\n" }, "2026-03-15T12:00:00Z");
    commit(work, { "other.txt": "unrelated\n" }, "2026-06-01T12:00:00Z");

    const history = readGitHistory(work);
    expect(history.available).toBe(true);
    expect(history.shallow).toBe(false);
    expect(history.prefix).toBe("");
    expect(history.lastChange("docs/a.md")).toBe("2026-01-10T12:00:00Z");
    expect(history.lastChange("docs/b.md")).toBe("2026-03-15T12:00:00Z");
  });

  it("has no date for a file that was never committed, and none in a repository with no commits", () => {
    git(work, ["init", "-q", "-b", "main"]);
    writeFileSync(join(work, "new.md"), "new\n");
    expect(readGitHistory(work).lastChange("new.md")).toBeUndefined();
    commit(work, { "old.md": "old\n" }, "2026-01-10T12:00:00Z");
    expect(readGitHistory(work).lastChange("new.md")).toBeUndefined();
  });

  it("is not available in a folder outside git", () => {
    const history = readGitHistory(work);
    expect(history.available).toBe(false);
    expect(history.lastChange("anything.md")).toBeUndefined();
  });

  it("finds the folder of the sources inside the repository, for a site in a subfolder", () => {
    git(work, ["init", "-q", "-b", "main"]);
    commit(work, { "packages/widget/docs/a.md": "A\n" }, "2026-02-02T12:00:00Z");
    const sources = join(work, "packages", "widget");

    const history = readGitHistory(sources);
    expect(history.prefix).toBe("packages/widget/");
    expect(history.lastChange("docs/a.md")).toBe("2026-02-02T12:00:00Z");

    const config = parseSiteConfig({
      site: {
        name: "W",
        description: "d",
        url: "https://me.github.io",
        repository: "https://github.com/me/widget",
      },
      hero: { title: "W", lede: "l", primary: { label: "Go", href: "/" } },
      editLink: { enabled: true },
      lastUpdated: { enabled: true },
    });
    const document = { path: "docs/a.md" } as Document;
    const meta = buildPageMeta(config, () => history).of(document);
    expect(meta.editUrl).toBe("https://github.com/me/widget/edit/main/packages/widget/docs/a.md");
    expect(meta.updated?.datetime).toBe("2026-02-02");
  });

  it("sees a shallow clone, and gives no dates for it", () => {
    const origin = join(work, "origin");
    mkdirSync(origin);
    git(origin, ["init", "-q", "-b", "main"]);
    commit(origin, { "docs/a.md": "A\n" }, "2026-01-10T12:00:00Z");
    commit(origin, { "docs/b.md": "B\n" }, "2026-03-15T12:00:00Z");

    const shallow = join(work, "shallow");
    git(work, ["clone", "-q", "--depth", "1", `file://${origin}`, shallow]);
    const history = readGitHistory(shallow);
    expect(history.shallow).toBe(true);
    // The wrong answer a shallow clone gives: a.md was written in January, and git says March.
    expect(history.lastChange("docs/a.md")).toBe("2026-03-15T12:00:00Z");

    const config = parseSiteConfig({
      site: { name: "W", description: "d", url: "https://me.github.io" },
      hero: { title: "W", lede: "l", primary: { label: "Go", href: "/" } },
      lastUpdated: { enabled: true },
    });
    const builder = buildPageMeta(config, () => history);
    expect(builder.of({ path: "docs/a.md" } as Document).updated).toBeUndefined();
    expect(builder.warnings.join()).toMatch(/shallow clone/);

    const full = join(work, "full");
    git(work, ["clone", "-q", `file://${origin}`, full]);
    expect(readGitHistory(full).shallow).toBe(false);
    expect(readGitHistory(full).lastChange("docs/a.md")).toBe("2026-01-10T12:00:00Z");
  });
});

describe("the environment that `check` and `init` use, with real git", () => {
  it("tells a shallow clone from a full one, and does not guess outside git", () => {
    const origin = join(work, "origin");
    mkdirSync(origin);
    git(origin, ["init", "-q", "-b", "main"]);
    commit(origin, { "a.md": "A\n" }, "2026-01-10T12:00:00Z");
    commit(origin, { "b.md": "B\n" }, "2026-03-15T12:00:00Z");
    const shallow = join(work, "shallow");
    git(work, ["clone", "-q", "--depth", "1", `file://${origin}`, shallow]);

    expect(nodeEnvironment.isShallowClone(shallow)).toBe(true);
    expect(nodeEnvironment.isShallowClone(origin)).toBe(false);
    const outside = mkdtempSync(join(tmpdir(), "sitekit-outside-"));
    try {
      expect(nodeEnvironment.isShallowClone(outside)).toBeUndefined();
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("names the branch of the repository: origin's HEAD for a clone, the checked out branch otherwise", () => {
    const origin = join(work, "origin");
    mkdirSync(origin);
    git(origin, ["init", "-q", "-b", "trunk"]);
    expect(nodeEnvironment.defaultBranch(origin)).toBe("trunk");
    commit(origin, { "a.md": "A\n" }, "2026-01-10T12:00:00Z");

    const clone = join(work, "clone");
    git(work, ["clone", "-q", `file://${origin}`, clone]);
    git(clone, ["checkout", "-q", "-b", "feature/x"]);
    expect(nodeEnvironment.defaultBranch(clone)).toBe("trunk");
  });
});
