import { attributeOf, isHidden, labelFor, storageKey } from "../../../template/public/docs-page.js";

describe("isHidden", () => {
  it("is true only for the value hidden", () => {
    expect(isHidden("hidden")).toBe(true);
    expect(isHidden(null)).toBe(false);
    expect(isHidden(undefined)).toBe(false);
    expect(isHidden("")).toBe(false);
    expect(isHidden("shown")).toBe(false);
  });
});

describe("attributeOf and storageKey", () => {
  it("names the attribute on <html> and the saved choice of each sidebar", () => {
    expect(attributeOf("menu")).toBe("data-docs-menu");
    expect(attributeOf("toc")).toBe("data-docs-toc");
    expect(storageKey("menu")).toBe("docs-menu");
    expect(storageKey("toc")).toBe("docs-toc");
  });
});

describe("labelFor", () => {
  it("says what a click does from the state the sidebar is in", () => {
    expect(labelFor("menu", true)).toBe("Hide the docs menu");
    expect(labelFor("menu", false)).toBe("Show the docs menu");
    expect(labelFor("toc", true)).toBe("Hide the table of contents");
    expect(labelFor("toc", false)).toBe("Show the table of contents");
  });
});
