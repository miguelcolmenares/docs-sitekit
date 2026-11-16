import { buildDocuments } from "../../../template/src/application";
import { parseDemoManifest, parseSiteConfig, readDemoId } from "../../../template/src/domain";

const example = {
  id: "counter",
  title: "Counter",
  preview: "counter/index.html",
  sources: [{ path: "counter/example.php", language: "php" }],
};
const manifest = (entry: Record<string, unknown> = example) => ({
  schemaVersion: 1,
  examples: [entry],
});

describe("the closed prebuilt demo contract", () => {
  it("accepts the shared descriptor without assuming a framework or executing its source", () => {
    const input = manifest({
      ...example,
      variants: [{ id: "alternate", title: "Alternate", preview: "counter/alternate.html" }],
      viewports: [{ label: "Narrow", width: 360 }],
      api: [
        {
          name: "label",
          type: "string",
          description: "Visible label.",
          required: true,
          default: "Count",
        },
      ],
    });
    expect(parseDemoManifest(input)).toEqual(input);
  });

  it.each([
    { ...manifest(), extra: true },
    manifest({ ...example, renderer: "php" }),
    manifest({ ...example, sources: [{ ...example.sources[0], execute: true }] }),
    manifest({
      ...example,
      api: [{ name: "label", type: "string", description: "Label", default: 1 }],
    }),
    { schemaVersion: 2, examples: [] },
  ])("rejects unknown fields and unsupported versions or types", (input) => {
    expect(() => parseDemoManifest(input)).toThrow(/Invalid demo manifest/);
  });

  it.each([
    "https://example.test/a.html",
    "//example.test/a.html",
    "../a.html",
    "/a.html",
    "a/../b.html",
    "a\\b.html",
    "%2e%2e/a.html",
    "a.html?x=1",
    "a.html#part",
    "a//b.html",
    "./a.html",
    "a.php",
  ])("rejects nonlocal or ambiguous preview %s", (preview) => {
    expect(() => parseDemoManifest(manifest({ ...example, preview }))).toThrow(/preview/);
  });

  it("rejects duplicated example, variant, viewport and API identifiers", () => {
    expect(() => parseDemoManifest({ schemaVersion: 1, examples: [example, example] })).toThrow(
      /Duplicate identifier "counter"/,
    );
    for (const extra of [
      {
        variants: [
          { id: "a", title: "A", preview: "a.html" },
          { id: "a", title: "B", preview: "b.html" },
        ],
      },
      {
        viewports: [
          { label: "Phone", width: 360 },
          { label: "Phone", width: 390 },
        ],
      },
      {
        api: [
          { name: "label", type: "string", description: "A" },
          { name: "label", type: "string", description: "B" },
        ],
      },
    ])
      expect(() => parseDemoManifest(manifest({ ...example, ...extra }))).toThrow(
        /Duplicate identifier/,
      );
  });

  it.each([
    { width: 0 },
    { width: 2561 },
    { width: 360.5 },
    { width: 360, height: 0 },
    { width: 360, height: 1601 },
  ])("bounds viewport dimensions", (size) => {
    expect(() =>
      parseDemoManifest(manifest({ ...example, viewports: [{ label: "Test", ...size }] })),
    ).toThrow(/viewports/);
  });

  it("leaves existing sites unchanged and validates the opt-in config", () => {
    const config = {
      site: { name: "Demo", description: "Demo", url: "https://example.test" },
      hero: { title: "Demo", lede: "Demo", primary: { label: "Read", href: "/docs/" } },
    };
    expect(parseSiteConfig(config).demos).toBeUndefined();
    expect(parseSiteConfig({ ...config, demos: { dir: "../demos" } }).demos).toEqual({
      dir: "../demos",
    });
    expect(() => parseSiteConfig({ ...config, demos: { dir: "../demos", execute: true } })).toThrow(
      /execute/,
    );
  });

  it("reads an explicit Markdown association and rejects invalid identifiers", () => {
    expect(readDemoId(undefined)).toBeUndefined();
    expect(readDemoId("counter")).toBe("counter");
    expect(() => readDemoId({ id: "counter" })).toThrow(/Frontmatter "demo"/);
    const [page] = buildDocuments(
      [
        {
          path: "docs/counter.md",
          collection: "docs",
          collectionPath: "counter.md",
          frontmatter: { demo: "counter" },
          content: "# Counter",
        },
      ],
      {
        base: "/project/",
        collections: [{ id: "docs", label: "Docs", dir: "../docs", groups: [] }],
      },
    );
    expect(page?.demo).toBe("counter");
  });

  it("preserves an existing demo-assets collection until the preview route is enabled", () => {
    const config = {
      site: { name: "Demo", description: "Demo", url: "https://example.test" },
      hero: { title: "Demo", lede: "Demo", primary: { label: "Read", href: "/docs/" } },
      collections: [{ id: "demo-assets", label: "Assets", dir: "../assets" }],
    };
    expect(parseSiteConfig(config).collections[0]?.id).toBe("demo-assets");
    expect(() => parseSiteConfig({ ...config, demos: { dir: "../demos" } })).toThrow(
      /demo-assets.*reserved/,
    );
  });
});
