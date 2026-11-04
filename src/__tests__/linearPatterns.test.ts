import { absoluteUrl } from "../../template/src/domain";
import { checkLlms, packageName } from "../application";

// Each of these used to be a pattern that tries again from every position, so a long run of one character
// took quadratic time. The inputs are long enough to fail the time limit if that comes back.
const LIMIT_MS = 1000;
const timed = (run: () => void) => {
  const started = Date.now();
  run();
  expect(Date.now() - started).toBeLessThan(LIMIT_MS);
};

describe("packageName", () => {
  it("makes a slug without hyphens at either end", () => {
    expect(packageName("  My Site!! ")).toBe("my-site-docs");
    expect(packageName("---")).toBe("site-docs");
    expect(packageName("")).toBe("site-docs");
  });

  it("stays fast on a long run of separators", () => {
    timed(() => expect(packageName(`a${"-".repeat(100_000)}!`)).toBe("a-docs"));
  });
});

describe("absoluteUrl", () => {
  it("takes every slash off the end of the origin", () => {
    expect(absoluteUrl("https://a.dev///", "/x/")).toBe("https://a.dev/x/");
    expect(absoluteUrl("https://a.dev", "/x/")).toBe("https://a.dev/x/");
  });

  it("stays fast on a long run of slashes", () => {
    timed(() => expect(absoluteUrl(`https://a.dev${"/".repeat(100_000)}x`, "/")).toContain("x/"));
  });
});

describe("checkLlms links", () => {
  const input = {
    origin: "https://a.dev",
    base: "/",
    documents: [],
    built: ["index.html", "docs/a/index.html"],
    markdownPages: false,
  };

  it("reads every link, also two on one line, and ignores a target with a space", () => {
    const text = [
      "# Site",
      "[a](https://a.dev/docs/a/) and [b](https://other.dev/x) and [c](https://a.dev/not here)",
    ].join("\n");
    expect(checkLlms(text, input)).toEqual([
      "dist/llms.txt links to https://other.dev/x, which is not an address of this site.",
    ]);
  });

  it("stays fast on a long run of link openers", () => {
    timed(() => checkLlms(`# Site\n${"](!".repeat(50_000)}`, input));
    timed(() => checkLlms(`# Site\n${"](".repeat(50_000)}`, input));
  });
});
