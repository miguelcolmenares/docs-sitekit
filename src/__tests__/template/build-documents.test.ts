import { buildDocuments, publishedRoutes } from "../../../template/src/application";
import type { SourceFile } from "../../../template/src/domain";

const file = (
  path: string,
  content: string,
  frontmatter: Record<string, unknown> = {},
  collection = "docs",
  collectionPath = path.replace(/^(docs|examples|tutorials)\//, ""),
): SourceFile => ({ path, collection, collectionPath, frontmatter, content });

describe("buildDocuments", () => {
  it("takes the tags from the frontmatter, as a list or as one comma separated string", () => {
    const docs = buildDocuments(
      [
        file("docs/a.md", "# A", { tags: ["UI", " forms ", "ui"] }),
        file("docs/b.md", "# B", { tags: "one, two" }),
        file("docs/c.md", "# C", { tags: 7 }),
        file("docs/d.md", "# D"),
      ],
      { base: "/" },
    );
    expect(docs.map((doc) => doc.tags)).toEqual([["UI", "forms"], ["one", "two"], [], []]);
  });

  it("takes title and description from the content when the frontmatter has none", () => {
    const [doc] = buildDocuments(
      [file("docs/start.md", "# Getting going\n\nThe first steps.\n\nMore.")],
      { base: "/" },
    );
    expect(doc).toMatchObject({
      slug: "start",
      route: "/docs/start/",
      title: "Getting going",
      description: "The first steps.",
    });
    expect(doc!.body.startsWith("# Getting going")).toBe(false);
  });

  it("records where the description came from, so a page does not repeat its own first paragraph", () => {
    const docs = buildDocuments(
      [
        file("docs/a.md", "# A\n\nFrom the body."),
        file("docs/b.md", "# B\n\nBody.", { description: "From frontmatter" }),
        file("docs/c.md", "# C"),
      ],
      { base: "/" },
    );
    expect(docs.map((d) => d.descriptionSource)).toEqual(["content", "frontmatter", "none"]);
  });

  it("prefers the frontmatter and keeps a body heading that differs from the title", () => {
    const [doc] = buildDocuments(
      [
        file("docs/a.md", "# Heading\n\nProse.", {
          title: "Custom",
          description: "Custom description",
        }),
      ],
      { base: "/" },
    );
    expect(doc).toMatchObject({ title: "Custom", description: "Custom description" });
    expect(doc!.body).toContain("# Heading");
  });

  it("falls back to the file name when there is no heading", () => {
    const [doc] = buildDocuments([file("docs/design-tokens.md", "Just prose.")], { base: "/" });
    expect(doc!.title).toBe("Design tokens");
  });

  it("prefixes routes with the site base", () => {
    const [doc] = buildDocuments([file("docs/a.md", "# A")], { base: "/recaptcha/" });
    expect(doc!.route).toBe("/recaptcha/docs/a/");
  });

  it("names a folder page after its folder", () => {
    const docs = buildDocuments(
      [file("docs/guide/README.md", "# G"), file("docs/other/index.md", "# O")],
      { base: "/" },
    );
    expect(docs.map((d) => d.slug).sort()).toEqual(["guide", "other"]);
  });

  it("gives the changelog one fixed route", () => {
    const [doc] = buildDocuments(
      [file("CHANGELOG.md", "# Changelog\n\n## 1.0.0", {}, "changelog", "CHANGELOG.md")],
      { base: "/x/" },
    );
    expect(doc).toMatchObject({ slug: "changelog", route: "/x/changelog/" });
  });

  it("sorts by explicit order first, then by slug", () => {
    const docs = buildDocuments(
      [
        file("docs/b.md", "# B"),
        file("docs/a.md", "# A"),
        file("docs/z.md", "# Z", { order: 1 }),
        file("docs/y.md", "# Y", { order: 2 }),
      ],
      { base: "/" },
    );
    expect(docs.map((d) => d.slug)).toEqual(["z", "y", "a", "b"]);
  });

  it("fails loudly when two files get the same route", () => {
    expect(() =>
      buildDocuments([file("docs/a/guide.md", "# One"), file("docs/b/guide.md", "# Two")], {
        base: "/",
      }),
    ).toThrow(/docs\/a\/guide\.md and docs\/b\/guide\.md/);
  });

  it("maps repository paths to routes", () => {
    const docs = buildDocuments([file("docs/a.md", "# A")], { base: "/" });
    expect(publishedRoutes(docs).get("docs/a.md")).toBe("/docs/a/");
  });
});

describe("buildDocuments collections and groups", () => {
  const collections = (
    groups: Array<{
      name: string;
      tone?: "neutral" | "brand" | "success" | "warn";
      items: string[];
    }> = [],
  ) => [
    {
      id: "docs",
      label: "Docs",
      dir: "../docs",
      groups: groups.map((group) => ({ tone: "neutral" as const, ...group })),
    },
    { id: "tutorials", label: "Tutorials", dir: "../docs/tutorials", groups: [] },
  ];

  it("gives a README at the top of a collection the slug overview", () => {
    const [doc] = buildDocuments([file("docs/README.md", "# Docs home\n\nStart here.")], {
      base: "/",
      collections: collections(),
    });
    expect(doc).toMatchObject({ slug: "overview", route: "/docs/overview/", title: "Docs home" });
  });

  it("names a nested folder page after its folder", () => {
    const [doc] = buildDocuments([file("docs/guide/README.md", "# Guide")], {
      base: "/",
      collections: collections(),
    });
    expect(doc!.slug).toBe("guide");
  });

  it("orders collections as configured, then the changelog last, whatever order the files come in", () => {
    const docs = buildDocuments(
      [
        file("CHANGELOG.md", "# Changelog", {}, "changelog", "CHANGELOG.md"),
        file("docs/tutorials/t.md", "# T", {}, "tutorials", "t.md"),
        file("docs/a.md", "# A"),
      ],
      { base: "/", collections: collections() },
    );
    expect(docs.map((d) => d.collection)).toEqual(["docs", "tutorials", "changelog"]);
  });

  it("orders pages by their groups and records the group on each page", () => {
    const docs = buildDocuments(
      [file("docs/a.md", "# A"), file("docs/b.md", "# B"), file("docs/c.md", "# C")],
      {
        base: "/",
        collections: collections([
          { name: "Later", tone: "warn", items: ["c"] },
          { name: "First", tone: "brand", items: ["b", "a"] },
        ]),
      },
    );
    expect(docs.map((d) => [d.slug, d.group?.name])).toEqual([
      ["c", "Later"],
      ["b", "First"],
      ["a", "First"],
    ]);
  });

  it("fails the build on a page that no group lists", () => {
    expect(() =>
      buildDocuments([file("docs/a.md", "# A"), file("docs/b.md", "# B")], {
        base: "/",
        collections: collections([{ name: "G", items: ["a"] }]),
      }),
    ).toThrow(/b is in no group of "Docs"/);
  });

  it("fails the build on a group that lists a missing page", () => {
    expect(() =>
      buildDocuments([file("docs/a.md", "# A")], {
        base: "/",
        collections: collections([{ name: "G", items: ["a", "gone"] }]),
      }),
    ).toThrow(/lists "gone"/);
  });

  it("leaves pages ungrouped, sorted by name, when a collection has no groups", () => {
    const docs = buildDocuments([file("docs/b.md", "# B"), file("docs/a.md", "# A")], {
      base: "/",
      collections: collections(),
    });
    expect(docs.map((d) => d.slug)).toEqual(["a", "b"]);
    expect(docs.every((d) => d.group === null)).toBe(true);
  });

  it("keeps a page of an unconfigured collection, after the configured ones", () => {
    const docs = buildDocuments(
      [file("extra/x.md", "# X", {}, "extra", "x.md"), file("docs/a.md", "# A")],
      { base: "/", collections: collections() },
    );
    expect(docs.map((d) => d.collection)).toEqual(["docs", "extra"]);
  });
});
