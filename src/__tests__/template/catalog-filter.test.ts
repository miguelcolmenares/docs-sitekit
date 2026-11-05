import {
  EMPTY_FILTER,
  collectTags,
  filterSummary,
  filterText,
  isFiltering,
  matchesFilter,
  normalizeTags,
  normalizeText,
  parseFilterState,
  serializeFilterState,
  tagKey,
} from "../../../template/src/domain";
import type { FilterItem } from "../../../template/src/domain";

const card = (title: string, description: string, tags: string[]): FilterItem => ({
  tags: tags.map(tagKey),
  text: filterText({ title, description, tags }),
});

const button = card("Button", "A clickable control.", ["UI", "Forms"]);
const table = card("Data table", "Rows and columns for records.", ["UI", "Data"]);
const guide = card("Getting started", "Install it. Café menu.", []);

describe("normalizeTags", () => {
  it("takes a list, trims it and keeps the first spelling of a repeated tag", () => {
    expect(normalizeTags(["  UI ", "forms", "ui", "FORMS"])).toEqual(["UI", "forms"]);
  });

  it("takes a comma separated string", () => {
    expect(normalizeTags("ui, forms ,, data")).toEqual(["ui", "forms", "data"]);
  });

  it("keeps a number as text and drops what is not text", () => {
    expect(normalizeTags([2024, null, { a: 1 }, ["x"], "", "  ", true])).toEqual(["2024"]);
  });

  it.each([undefined, null, 7, {}, true])("has no tags for %p", (value) => {
    expect(normalizeTags(value)).toEqual([]);
  });
});

describe("normalizeText", () => {
  it("lowercases, drops accents and collapses space", () => {
    expect(normalizeText("  Café   MENÚ\n")).toBe("cafe menu");
  });
});

describe("matchesFilter", () => {
  const match = (item: FilterItem, tags: string[], query = "") =>
    matchesFilter(item, { tags, query });

  it("shows everything for the empty state", () => {
    expect([button, table, guide].every((item) => matchesFilter(item, EMPTY_FILTER))).toBe(true);
  });

  it("needs every selected tag, so a second tag narrows further", () => {
    expect(match(button, ["ui"])).toBe(true);
    expect(match(table, ["ui"])).toBe(true);
    expect(match(button, ["ui", "forms"])).toBe(true);
    expect(match(table, ["ui", "forms"])).toBe(false);
    expect(match(guide, ["ui"])).toBe(false);
  });

  it("matches a tag by its key, not by its case", () => {
    expect(match(button, [tagKey(" Forms ")])).toBe(true);
  });

  it("needs every word of the query, in any order, in the title, description or tags", () => {
    expect(match(button, [], "click")).toBe(true);
    expect(match(button, [], "control clickable")).toBe(true);
    expect(match(button, [], "click table")).toBe(false);
    expect(match(table, [], "records")).toBe(true);
    expect(match(table, [], "data")).toBe(true);
  });

  it("ignores case, accents and extra space in the query", () => {
    expect(match(guide, [], "  CAFE   menu ")).toBe(true);
    expect(match(guide, [], "café")).toBe(true);
  });

  it("combines tags and text", () => {
    expect(match(button, ["ui"], "click")).toBe(true);
    expect(match(table, ["ui"], "click")).toBe(false);
  });

  it("matches nothing for a tag no card has", () => {
    expect([button, table, guide].some((item) => match(item, ["nope"]))).toBe(false);
  });

  it("treats a query of only space as no query", () => {
    expect(match(guide, [], "   ")).toBe(true);
  });
});

describe("isFiltering", () => {
  it("is true for a tag or a word, false for neither", () => {
    expect(isFiltering(EMPTY_FILTER)).toBe(false);
    expect(isFiltering({ tags: [], query: "  " })).toBe(false);
    expect(isFiltering({ tags: ["ui"], query: "" })).toBe(true);
    expect(isFiltering({ tags: [], query: "card" })).toBe(true);
  });
});

describe("the address", () => {
  it("reads tags and the text from the query string", () => {
    expect(parseFilterState("?tag=ui&q=card")).toEqual({ tags: ["ui"], query: "card" });
    expect(parseFilterState("tag=ui&tag=Forms&tag=ui&q=a%20b")).toEqual({
      tags: ["ui", "forms"],
      query: "a b",
    });
  });

  it("reads an address with no state, or only noise, as the empty state", () => {
    expect(parseFilterState("")).toEqual(EMPTY_FILTER);
    expect(parseFilterState("?tag=&utm=1")).toEqual(EMPTY_FILTER);
  });

  it("writes only what is selected, with its question mark", () => {
    expect(serializeFilterState(EMPTY_FILTER)).toBe("");
    expect(serializeFilterState({ tags: ["ui"], query: "" })).toBe("?tag=ui");
    expect(serializeFilterState({ tags: ["ui", "forms"], query: " card " })).toBe(
      "?tag=ui&tag=forms&q=card",
    );
    expect(serializeFilterState({ tags: [], query: "   " })).toBe("");
  });

  it("round trips a state, including characters that need escaping", () => {
    const state = { tags: ["c++", "a&b"], query: "x=1 & y" };
    expect(parseFilterState(serializeFilterState(state))).toEqual(state);
  });
});

describe("collectTags", () => {
  it("makes one option per tag key with the first spelling, a count, sorted by label", () => {
    expect(
      collectTags([
        { tags: ["UI", "Forms"] },
        { tags: ["ui", "Data"] },
        { tags: ["Forms", "forms"] },
        { tags: [] },
      ]),
    ).toEqual([
      { key: "data", label: "Data", count: 1 },
      { key: "forms", label: "Forms", count: 2 },
      { key: "ui", label: "UI", count: 2 },
    ]);
  });

  it("has no options when no card has a tag", () => {
    expect(collectTags([{ tags: [] }, { tags: [] }])).toEqual([]);
  });
});

describe("filterSummary", () => {
  it("says how many are shown out of how many", () => {
    expect(filterSummary(12, 12)).toBe("12 of 12 shown.");
    expect(filterSummary(3, 12)).toBe("3 of 12 shown.");
  });

  it("says plainly that nothing matches", () => {
    expect(filterSummary(0, 12)).toBe("Nothing matches this filter. 0 of 12 shown.");
  });
});
