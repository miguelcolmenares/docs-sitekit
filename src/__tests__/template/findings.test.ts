import {
  DEFAULT_SEVERITY,
  FINDING_KINDS,
  countFindings,
  formatFinding,
  nearest,
  parseSiteConfig,
  resolveSeverities,
  summarizeFindings,
  unknownCalloutMarker,
} from "../../../template/src/domain";
import type { ContentFinding } from "../../../template/src/domain";

const valid = {
  site: { name: "Demo", description: "A demo", url: "https://me.github.io" },
  hero: { title: "Demo", lede: "Lede", primary: { label: "Start", href: "/docs/" } },
};

const finding = (severity: "error" | "warning"): ContentFinding => ({
  kind: "links",
  severity,
  file: "docs/guide.md",
  line: 42,
  message: 'Link "./nope.md" does not match any file',
});

describe("the kinds of finding", () => {
  it("have a default severity each: a missing image, a bad order and a missing snippet are errors, the rest warnings", () => {
    expect(Object.keys(DEFAULT_SEVERITY).sort()).toEqual([...FINDING_KINDS].sort());
    expect(DEFAULT_SEVERITY.images).toBe("error");
    expect(DEFAULT_SEVERITY.order).toBe("error");
    expect(DEFAULT_SEVERITY.snippets).toBe("error");
    expect(FINDING_KINDS.filter((kind) => DEFAULT_SEVERITY[kind] === "error").sort()).toEqual([
      "images",
      "order",
      "snippets",
    ]);
    expect(FINDING_KINDS.filter((kind) => DEFAULT_SEVERITY[kind] === "warning").sort()).toEqual([
      "anchors",
      "callouts",
      "duplicateHeadings",
      "excludedLinks",
      "frontmatter",
      "links",
      "variables",
    ]);
  });

  it("are changed by the config, and a kind that is not set keeps its default", () => {
    const resolved = resolveSeverities({ links: "error", images: "off" });
    expect(resolved.links).toBe("error");
    expect(resolved.images).toBe("off");
    expect(resolved.anchors).toBe("warning");
  });
});

describe("check in the config", () => {
  it("is empty by default, so a site without the key does not change", () => {
    expect(parseSiteConfig(valid).check).toEqual({});
  });

  it("takes error, warning or off for a kind", () => {
    const { check } = parseSiteConfig({ ...valid, check: { links: "error", anchors: "off" } });
    expect(check).toEqual({ links: "error", anchors: "off" });
  });

  it("fails on a kind it does not know, and says which one and what the kinds are", () => {
    expect(() => parseSiteConfig({ ...valid, check: { linkz: "error" } })).toThrow(
      /check\.linkz: "linkz" is not a kind of finding\. The kinds are links, excludedLinks/,
    );
  });

  it("fails on a severity that is not one of the three, with the key named", () => {
    expect(() => parseSiteConfig({ ...valid, check: { links: "fatal" } })).toThrow(/check\.links/);
  });
});

describe("formatFinding", () => {
  it("writes file, line, severity and message in the order editors and CI logs link", () => {
    expect(formatFinding(finding("warning"))).toBe(
      'docs/guide.md:42: warning: Link "./nope.md" does not match any file',
    );
  });

  it("counts and summarizes", () => {
    const list = [finding("error"), finding("warning"), finding("warning")];
    expect(countFindings(list)).toEqual({ errors: 1, warnings: 2 });
    expect(summarizeFindings(list)).toBe("1 error, 2 warnings");
    expect(summarizeFindings([finding("warning")])).toBe("0 errors, 1 warning");
  });
});

describe("nearest", () => {
  const keys = ["title", "description", "order"];

  it("finds the key a typo was meant to be", () => {
    expect(nearest("titel", keys)).toBe("title");
    expect(nearest("Descripton", keys)).toBe("description");
    expect(nearest("ordr", keys)).toBe("order");
  });

  it("says nothing for a word that is not close to any", () => {
    expect(nearest("layout", keys)).toBeNull();
    expect(nearest("tags", keys)).toBeNull();
  });
});

describe("unknownCalloutMarker", () => {
  it("returns the name of a marker line that is not one of the five kinds", () => {
    expect(unknownCalloutMarker("[!NOTES]")).toBe("NOTES");
    expect(unknownCalloutMarker("[!Info]  ")).toBe("Info");
  });

  it("returns null for a known kind, in any case, and for text that is not a marker line", () => {
    expect(unknownCalloutMarker("[!note]")).toBeNull();
    expect(unknownCalloutMarker("[!WARNING]")).toBeNull();
    expect(unknownCalloutMarker("[!NOTES] with text after")).toBeNull();
    expect(unknownCalloutMarker("plain text")).toBeNull();
  });
});
