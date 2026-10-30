import { createRequire } from "node:module";
import { join } from "node:path";
import { STAT_LIMITS, StatRow } from "../../../template/src/presentation/components/site/StatRow";

// react-dom lives in the template, which has its own dependencies. The component is a plain
// function of its props, so it is called directly and its element is rendered to markup.
const requireFromTemplate = createRequire(
  join(__dirname, "..", "..", "..", "template", "package.json"),
);
const { renderToStaticMarkup } = requireFromTemplate("react-dom/server") as {
  renderToStaticMarkup: (element: unknown) => string;
};

const stat = (n: number, note?: string) => ({ value: `${n}0`, label: `Label ${n}`, note });
const stats = (count: number) => Array.from({ length: count }, (_, index) => stat(index + 1));
const render = (items: Parameters<typeof StatRow>[0]["stats"]) =>
  renderToStaticMarkup(StatRow({ stats: items }));

describe("StatRow", () => {
  it("renders a description list with the label as the term and the value as its description", () => {
    const html = render([stat(1), stat(2)]);
    expect(html).toMatch(/^<dl\b/);
    expect(html.match(/<dt\b/g)).toHaveLength(2);
    expect(html).toContain("Label 1</dt>");
    expect(html).toMatch(/<dd[^>]*>10<\/dd>/);
    // Each pair sits in its own group, so a label is read with its own value.
    expect(html.match(/<div\b/g)).toHaveLength(2);
  });

  it("adds the note as a second description, and only when there is one", () => {
    expect(render([stat(1, "per month"), stat(2)]).match(/<dd\b/g)).toHaveLength(3);
    expect(render([stat(1, "per month"), stat(2)])).toContain("per month</dd>");
  });

  it("escapes text instead of injecting it", () => {
    const html = render([{ value: "<b>1</b>", label: "a & b" }, stat(2)]);
    expect(html).toContain("&lt;b&gt;1&lt;/b&gt;");
    expect(html).toContain("a &amp; b");
  });

  it.each([
    [2, "sm:grid-cols-2"],
    [3, "sm:grid-cols-3"],
    [4, "lg:grid-cols-4"],
    [5, "lg:grid-cols-5"],
  ])("with %i stats uses explicit tracks, one column on a phone", (count, track) => {
    const html = render(stats(count));
    expect(html).toContain("grid-cols-1");
    expect(html).toContain(track);
    expect(html).not.toMatch(/auto-(fit|fill)/);
  });

  it("lets a long value wrap and keeps the cells inside their track", () => {
    const html = render([{ value: "1".repeat(60), label: "Long" }, stat(2)]);
    expect(html).toContain("wrap-anywhere");
    expect(html).toContain("min-w-0");
  });

  it("never colors a value by its meaning: no status color classes", () => {
    expect(render(stats(5))).not.toMatch(/\b(text|bg|border)-(success|warn|danger|destructive)\b/);
  });

  it.each([0, 1, 6])("throws with %i stats and names the limits", (count) => {
    expect(() => render(stats(count))).toThrow(
      new RegExp(`${STAT_LIMITS.min} to ${STAT_LIMITS.max} stats, got ${count}`),
    );
  });
});
