import { renderMarkdownPage } from "../../../template/src/domain";
import type { Document, LinkContext } from "../../../template/src/domain";

const context: LinkContext = {
  file: "docs/guides/start.md",
  published: new Map([
    ["docs/guides/convert.md", "/widget/docs/convert/"],
    ["docs/api.md", "/widget/docs/api/"],
  ]),
  existing: new Set(["docs/guides/convert.md", "docs/api.md", "LICENSE", "docs/secret.md"]),
  isExcluded: (path) => path === "docs/secret.md",
  repositoryUrl: "https://github.com/me/widget",
};

const page = (body: string): Document => ({
  collection: "docs",
  path: "docs/guides/start.md",
  slug: "start",
  route: "/widget/docs/start/",
  title: "Start here",
  description: "",
  descriptionSource: "none",
  order: null,
  tags: [],
  group: null,
  body,
});

const render = (body: string) =>
  renderMarkdownPage(page(body), {
    context,
    origin: "https://me.github.io",
    pageUrl: "https://me.github.io/widget/docs/start/",
  });

describe("renderMarkdownPage", () => {
  it("starts with the title as a heading, then the body", () => {
    expect(render("Some text.\n")).toBe("# Start here\n\nSome text.\n");
  });

  it("turns a link to a published page into an absolute address with the base", () => {
    expect(render("See [the API](../api.md).")).toContain(
      "[the API](https://me.github.io/widget/docs/api/)",
    );
  });

  it("keeps the anchor of a link to a published page", () => {
    expect(render("See [the API](../api.md#options).")).toContain(
      "(https://me.github.io/widget/docs/api/#options)",
    );
  });

  it("points a link to a repository file that is not on the site at the repository", () => {
    expect(render("Read [the license](../../LICENSE).")).toContain(
      "[the license](https://github.com/me/widget/blob/HEAD/LICENSE)",
    );
  });

  it("keeps the words of a link to an excluded file, and drops the address", () => {
    const text = render("Private: [the plan](../secret.md).");
    expect(text).toContain("Private: the plan.");
    expect(text).not.toContain("secret");
  });

  it("leaves a link that matches no file as written", () => {
    expect(render("Gone: [x](./missing.md)")).toContain("[x](./missing.md)");
  });

  it("makes an in-page anchor point at the page", () => {
    expect(render("Jump to [the start](#start).")).toContain(
      "[the start](https://me.github.io/widget/docs/start/#start)",
    );
  });

  it("makes a site path absolute and leaves a web address alone", () => {
    const text = render("[home](/widget/) and [site](https://example.com/x)");
    expect(text).toContain("[home](https://me.github.io/widget/)");
    expect(text).toContain("[site](https://example.com/x)");
  });

  it("does not touch an image, a fenced block or inline code", () => {
    const body = [
      "![diagram](../api.md)",
      "",
      "Use `[x](../api.md)` as it is.",
      "",
      "```md",
      "[example](../api.md)",
      "```",
      "",
      "~~~",
      "[tilde](../api.md)",
      "~~~",
    ].join("\n");
    const text = render(body);
    expect(text).toContain("![diagram](../api.md)");
    expect(text).toContain("Use `[x](../api.md)` as it is.");
    expect(text).toContain("[example](../api.md)");
    expect(text).toContain("[tilde](../api.md)");
  });

  it("keeps a link title", () => {
    expect(render('[api](../api.md "The API")')).toContain(
      '[api](https://me.github.io/widget/docs/api/ "The API")',
    );
  });
});
