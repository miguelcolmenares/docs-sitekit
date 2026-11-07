import { fence, previewHtml } from "@/infrastructure/demo-samples";
import { parseSiteConfig } from "@/domain";

describe("the preview of a sample", () => {
  it("prefixes every id, so it does not repeat an id of the page", () => {
    const html = '<h2 id="steps">Steps</h2><p id="intro">Text</p>';
    expect(previewHtml(html, "sample0-")).toBe(
      '<h2 role="presentation" id="sample0-steps">Steps</h2><p id="sample0-intro">Text</p>',
    );
  });

  it("turns each link into its text, styled as a link, so it leads nowhere", () => {
    const html = '<p>See <a href="/docs/options/">the options</a> and <a href="#top">here</a>.</p>';
    const out = previewHtml(html, "s-");
    expect(out).not.toContain("<a");
    expect(out).not.toContain("href");
    expect(out).toContain(
      '<span class="text-brand underline underline-offset-[3px]">the options</span>',
    );
    expect(out).toContain("here</span>.");
  });

  it("does not mistake an element that begins with a, such as abbr or article, for a link", () => {
    expect(previewHtml("<abbr>KIT</abbr><article>x</article>", "p-")).toBe(
      "<abbr>KIT</abbr><article>x</article>",
    );
  });

  it("takes the role of a heading away, and keeps its level and its text", () => {
    expect(previewHtml("<h3>Deep</h3>", "p-")).toBe('<h3 role="presentation">Deep</h3>');
  });
});

describe("the fence of a sample", () => {
  it("is three backticks when the code has none", () => {
    expect(fence("a\n", "md", "docs/a.md")).toBe('```md title="docs/a.md"\na\n```\n');
  });

  it("is one backtick longer than the longest run in the code, so its own fences stay inside", () => {
    const out = fence("```ts\nx\n```\n", "markdown");
    expect(out.startsWith("````markdown\n")).toBe(true);
    expect(out.endsWith("\n````\n")).toBe(true);
  });
});

describe("the demo key of the config", () => {
  const base = {
    site: { name: "Demo", description: "d", url: "https://example.com" },
    hero: { title: "Demo", lede: "l", primary: { label: "Go", href: "/docs/" } },
  };
  const sample = (n: number) => ({ label: `S${n}`, title: `docs/s${n}.md`, file: `s${n}.md` });

  it("takes three or four samples, and nothing else", () => {
    expect(() =>
      parseSiteConfig({ ...base, demo: { samples: [sample(1), sample(2), sample(3)] } }),
    ).not.toThrow();
    expect(() =>
      parseSiteConfig({ ...base, demo: { samples: [1, 2, 3, 4].map(sample) } }),
    ).not.toThrow();
    expect(() => parseSiteConfig({ ...base, demo: { samples: [sample(1), sample(2)] } })).toThrow(
      /demo\.samples takes three or four items/,
    );
    expect(() =>
      parseSiteConfig({ ...base, demo: { samples: [1, 2, 3, 4, 5].map(sample) } }),
    ).toThrow(/demo\.samples takes three or four items/);
  });

  it("is optional, and a key that is not declared fails the load", () => {
    expect(parseSiteConfig(base).demo).toBeUndefined();
    expect(() =>
      parseSiteConfig({ ...base, demo: { samples: [1, 2, 3].map(sample), extra: true } }),
    ).toThrow();
  });

  it("refuses a title with a quote, which would break the fence that shows it", () => {
    expect(() =>
      parseSiteConfig({
        ...base,
        demo: { samples: [{ ...sample(1), title: 'a"b.md' }, sample(2), sample(3)] },
      }),
    ).toThrow();
  });
});
