import { createRequire } from "node:module";
import { join } from "node:path";
import { PageInfo } from "../../../template/src/presentation/components/site/PageInfo";

// The component is a plain function of its props, so it is called directly and rendered to markup.
const requireFromTemplate = createRequire(
  join(__dirname, "..", "..", "..", "template", "package.json"),
);
const { renderToStaticMarkup } = requireFromTemplate("react-dom/server") as {
  renderToStaticMarkup: (element: unknown) => string;
};
const render = (props: Parameters<typeof PageInfo>[0]) => renderToStaticMarkup(PageInfo(props));

describe("PageInfo", () => {
  it("links to the source file with a 44px target", () => {
    const html = render({ editUrl: "https://github.com/me/widget/edit/main/docs/a.md" });
    expect(html).toMatch(
      /<a [^>]*href="https:\/\/github\.com\/me\/widget\/edit\/main\/docs\/a\.md"/,
    );
    expect(html).toContain("Edit this page");
    expect(html).toContain("min-h-11");
    // The icon is decoration.
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("writes the date as a time element with a machine-readable value and a readable text", () => {
    const html = render({ updated: { datetime: "2026-03-15", text: "15 March 2026" } });
    expect(html).toContain('<time dateTime="2026-03-15">15 March 2026</time>');
    expect(html).toContain("Last updated");
    expect(html).not.toContain("<a ");
  });

  it("shows both when it has both", () => {
    const html = render({
      editUrl: "https://github.com/me/widget/edit/main/a.md",
      updated: { datetime: "2026-03-15", text: "15 March 2026" },
    });
    expect(html).toContain("Edit this page");
    expect(html).toContain("<time");
  });

  it("renders nothing when it has neither, so a page without them does not change", () => {
    expect(PageInfo({})).toBeNull();
  });

  it("escapes the text of the date instead of injecting it", () => {
    const html = render({ updated: { datetime: "2026-03-15", text: "<b>x</b>" } });
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
