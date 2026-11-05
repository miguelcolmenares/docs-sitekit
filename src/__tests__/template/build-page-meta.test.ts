import { buildPageMeta } from "../../../template/src/application";
import type { RepositoryHistory } from "../../../template/src/application";
import { parseSiteConfig } from "../../../template/src/domain";
import type { Document } from "../../../template/src/domain";

const config = (extra: Record<string, unknown> = {}, repository = "https://github.com/me/widget") =>
  parseSiteConfig({
    site: { name: "W", description: "d", url: "https://me.github.io", repository },
    hero: { title: "W", lede: "l", primary: { label: "Go", href: "/" } },
    ...extra,
  });

const page = (path: string): Document => ({
  collection: "docs",
  path,
  slug: "a",
  route: "/docs/a/",
  title: "A",
  description: "",
  descriptionSource: "none",
  order: null,
  tags: [],
  group: null,
  body: "",
});

const history = (overrides: Partial<RepositoryHistory> = {}): RepositoryHistory => ({
  available: true,
  shallow: false,
  prefix: "",
  lastChange: () => undefined,
  ...overrides,
});

const on = { editLink: { enabled: true }, lastUpdated: { enabled: true } };

describe("buildPageMeta", () => {
  it("does not read the history at all when both options are off", () => {
    const read = jest.fn(history);
    const builder = buildPageMeta(config(), read);
    expect(read).not.toHaveBeenCalled();
    expect(builder.of(page("docs/a.md"))).toEqual({});
    expect(builder.warnings).toEqual([]);
  });

  it("builds the edit address from the path of the page and the folder of the sources in the repository", () => {
    const builder = buildPageMeta(config(on), () => history({ prefix: "packages/widget/" }));
    expect(builder.of(page("docs/a.md")).editUrl).toBe(
      "https://github.com/me/widget/edit/main/packages/widget/docs/a.md",
    );
  });

  it("uses the branch and the host of the config", () => {
    const builder = buildPageMeta(
      config(
        { editLink: { enabled: true, branch: "trunk", host: "gitlab" } },
        "https://git.example.org/me/widget",
      ),
      () => history(),
    );
    expect(builder.of(page("docs/a.md")).editUrl).toBe(
      "https://git.example.org/me/widget/-/edit/trunk/docs/a.md",
    );
  });

  it("asks for the date of the file itself, by its path in the sources", () => {
    const asked: string[] = [];
    const builder = buildPageMeta(config(on), () =>
      history({
        lastChange: (path) => {
          asked.push(path);
          return path === "docs/a.md" ? "2026-03-15T10:00:00+00:00" : "2026-01-10T10:00:00+00:00";
        },
      }),
    );
    expect(builder.of(page("docs/a.md")).updated).toEqual({
      datetime: "2026-03-15",
      text: "15 March 2026",
    });
    expect(builder.of(page("docs/b.md")).updated?.datetime).toBe("2026-01-10");
    expect(asked).toEqual(["docs/a.md", "docs/b.md"]);
  });

  it("shows no date for a file git has no history for, and still links to it", () => {
    const meta = buildPageMeta(config(on), () => history()).of(page("docs/new.md"));
    expect(meta.updated).toBeUndefined();
    expect(meta.editUrl).toContain("/edit/main/docs/new.md");
  });

  it("turns the link off with a message for an unknown host, and keeps the dates", () => {
    const builder = buildPageMeta(config(on, "https://git.example.org/me/widget"), () =>
      history({ lastChange: () => "2026-03-15T10:00:00Z" }),
    );
    const meta = builder.of(page("docs/a.md"));
    expect(meta.editUrl).toBeUndefined();
    expect(meta.updated?.datetime).toBe("2026-03-15");
    expect(builder.warnings.join()).toMatch(
      /host of https:\/\/git\.example\.org\/me\/widget is not known/,
    );
  });

  it("shows no date in a shallow clone, with a warning, instead of the date of the last commit for every page", () => {
    const builder = buildPageMeta(config(on), () =>
      history({ shallow: true, lastChange: () => "2026-10-30T10:00:00Z" }),
    );
    expect(builder.of(page("docs/a.md")).updated).toBeUndefined();
    expect(builder.of(page("docs/a.md")).editUrl).toBeDefined();
    expect(builder.warnings.join()).toMatch(/shallow clone.*fetch-depth: 0/);
  });

  it("shows no date outside a git repository, with a warning", () => {
    const builder = buildPageMeta(config(on), () => history({ available: false }));
    expect(builder.of(page("docs/a.md")).updated).toBeUndefined();
    expect(builder.warnings.join()).toMatch(/not in a git repository/);
  });

  it("does not warn about a shallow clone when lastUpdated is off", () => {
    const builder = buildPageMeta(config({ editLink: { enabled: true } }), () =>
      history({ shallow: true }),
    );
    expect(builder.warnings).toEqual([]);
  });
});
