import { applyGroups } from "../../../template/src/domain";

const pages = (...slugs: string[]) => slugs.map((slug) => ({ slug }));
const group = (
  name: string,
  items: string[],
  tone: "neutral" | "brand" | "success" | "warn" = "neutral",
) => ({ name, tone, items });

describe("applyGroups", () => {
  it("orders pages by group, then by their place in the group, and tags each with its group", () => {
    const result = applyGroups(
      pages("c", "a", "b", "d"),
      [group("First", ["b", "a"], "brand"), group("Second", ["d", "c"], "warn")],
      "Docs",
    );
    expect(result.map((page) => page.slug)).toEqual(["b", "a", "d", "c"]);
    expect(result.map((page) => page.group)).toEqual([
      { name: "First", tone: "brand" },
      { name: "First", tone: "brand" },
      { name: "Second", tone: "warn" },
      { name: "Second", tone: "warn" },
    ]);
  });

  it("fails on a page that is in no group, and says how to fix it", () => {
    expect(() => applyGroups(pages("a", "new-page"), [group("G", ["a"])], "Docs")).toThrow(
      /new-page is in no group of Docs.*Add it to a group/,
    );
  });

  it("names every unclassified page", () => {
    expect(() => applyGroups(pages("a", "x", "y"), [group("G", ["a"])], "Docs")).toThrow(
      /x, y are in no group.*Add them/,
    );
  });

  it("fails on a group that lists a page that does not exist, so a typo cannot hide a page", () => {
    expect(() => applyGroups(pages("a"), [group("G", ["a", "tpyo"])], "Docs")).toThrow(
      /"G" of Docs lists "tpyo".*Pages are: a/,
    );
  });

  it("fails on a page named in two groups", () => {
    expect(() =>
      applyGroups(pages("a"), [group("One", ["a"]), group("Two", ["a"])], "Docs"),
    ).toThrow(/"a" is in two groups.*"One" and "Two"/);
  });

  it("keeps the other fields of each page", () => {
    const [page] = applyGroups([{ slug: "a", title: "Title" }], [group("G", ["a"])], "Docs");
    expect(page).toMatchObject({ slug: "a", title: "Title" });
  });
});
