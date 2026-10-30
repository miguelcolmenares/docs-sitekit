import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { ReferenceTable } from "../../../template/src/presentation/components/site/ReferenceTable";

// react-dom lives in the template, which has its own dependencies. The component is a plain
// function of its props, so it is called directly and its element is rendered to markup.
const requireFromTemplate = createRequire(
  join(__dirname, "..", "..", "..", "template", "package.json"),
);
const { renderToStaticMarkup } = requireFromTemplate("react-dom/server") as {
  renderToStaticMarkup: (element: unknown) => string;
};

const rows = [
  { name: "search.enabled", type: "boolean", default: "true", allowed: "true, false", text: "On." },
  { name: "site.url", type: "string (URL)", text: "The origin." },
];
const render = (items: Parameters<typeof ReferenceTable>[0]["rows"] = rows) =>
  renderToStaticMarkup(ReferenceTable({ label: "Keys of search", rows: items }));

describe("ReferenceTable", () => {
  it("wraps the table in a focusable, named region, set in the HTML", () => {
    const html = render();
    expect(html).toMatch(/^<div[^>]*role="region"/);
    expect(html).toMatch(/^<div[^>]*aria-label="Keys of search"/);
    expect(html).toMatch(/^<div[^>]*tabindex="0"/);
    expect(html).toMatch(/^<div[^>]*overflow-x-auto/);
  });

  it("is a table with a caption, column headers and the name of each row as its row header", () => {
    const html = render();
    expect(html).toContain("<caption");
    expect(html.match(/<th scope="col"/g)).toHaveLength(5);
    expect(html.match(/<th scope="row"/g)).toHaveLength(2);
    expect(html).toMatch(/<th scope="row"[^>]*><code[^>]*>search\.enabled<\/code><\/th>/);
  });

  it("is wider than a phone so it scrolls inside its wrapper, and keeps names on one line", () => {
    const html = render();
    expect(html).toMatch(/min-w-\[\d+rem\]/);
    expect(html).toMatch(/<code[^>]*whitespace-nowrap/);
  });

  it("shows a dash for a missing default or allowed values, never an empty cell", () => {
    const html = render([{ name: "a", type: "string", text: "Text." }]);
    expect(html.match(/<td[^>]*>-<\/td>/g)).toHaveLength(2);
    expect(html).not.toMatch(/<td[^>]*><\/td>/);
  });

  it("escapes text instead of injecting it", () => {
    const html = render([{ name: "<b>", type: "a & b", text: "<script>x</script>" }]);
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("a &amp; b");
    expect(html).not.toContain("<script>");
  });

  it("renders no row for an empty list, only the headers", () => {
    expect(render([])).not.toMatch(/<tbody><tr/);
  });

  it("chooses no status color and uses no shadow", () => {
    const source = readFileSync(
      join(
        __dirname,
        "..",
        "..",
        "..",
        "template",
        "src",
        "presentation",
        "components",
        "site",
        "ReferenceTable.tsx",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/\b(text|bg|border)-(success|warn|danger|destructive)\b/);
    expect(source).not.toMatch(/\bshadow/);
    // Decorative tokens are not for text.
    expect(source).not.toMatch(/\btext-fg-(dim|faint)\b/);
  });
});
