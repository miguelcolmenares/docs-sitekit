import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const SCRIPT = join(ROOT, "scripts", "lighthouse.mjs");

interface Numbers {
  lcp: number;
  cls: number;
  tbt: number;
  performance: number;
}

/** The parts of a Lighthouse JSON report that the budget reads. */
const report = ({ lcp, cls, tbt, performance }: Numbers) => ({
  categories: { performance: { score: performance / 100 } },
  audits: {
    "largest-contentful-paint": { numericValue: lcp },
    "cumulative-layout-shift": { numericValue: cls },
    "total-blocking-time": { numericValue: tbt },
    "largest-contentful-paint-element": {
      details: {
        items: [
          {
            items: [
              {
                node: { selector: "main > p.lede", nodeLabel: "A widget that does widget things." },
              },
            ],
          },
          {
            items: [
              { phase: "TTFB", timing: 452 },
              { phase: "Render Delay", timing: 1502 },
            ],
          },
        ],
      },
    },
  },
});

const GOOD: Numbers = { lcp: 1954, cls: 0, tbt: 0, performance: 99 };

describe("scripts/lighthouse.mjs --check", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sitekit-lighthouse-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  /** Save one report per set of numbers and run the script over them. */
  const check = (...runs: Numbers[]) => {
    const files = runs.map((numbers, index) => {
      const file = join(dir, `run-${index + 1}.report.json`);
      writeFileSync(file, JSON.stringify(report(numbers)));
      return file;
    });
    const result = spawnSync(process.execPath, [SCRIPT, "--check", ...files], { encoding: "utf8" });
    return { status: result.status, out: result.stdout, err: result.stderr };
  };

  it("passes three runs inside the budget and prints each run, the LCP element and its phases", () => {
    const { status, out } = check(GOOD, GOOD, GOOD);
    expect(status).toBe(0);
    expect(out).toContain("| Run 1 | Run 2 | Run 3 |");
    expect(out).toContain('LCP element: main > p.lede "A widget that does widget things."');
    expect(out).toContain("LCP phases: TTFB 452 ms, Render Delay 1502 ms");
    expect(out).not.toContain("FAIL");
  });

  it("judges the worst run, so one slow run fails the job", () => {
    const { status, out, err } = check(GOOD, { ...GOOD, lcp: 2501 }, GOOD);
    expect(status).toBe(1);
    expect(out).toMatch(
      /Largest Contentful Paint \| 1954 \| 2501 \| 1954 \| 2501 \| at most 2500 ms \| FAIL/,
    );
    expect(err).toContain("Over budget: Largest Contentful Paint.");
  });

  it.each([
    ["the layout shift", { ...GOOD, cls: 0.011 }, "Cumulative Layout Shift"],
    ["the total blocking time", { ...GOOD, tbt: 201 }, "Total Blocking Time"],
    ["the performance score", { ...GOOD, performance: 94 }, "Performance score"],
  ])("fails on %s alone, and names it", (_name, numbers, label) => {
    const { status, err } = check(numbers);
    expect(status).toBe(1);
    expect(err).toContain(`Over budget: ${label}.`);
  });

  it("accepts the values that sit exactly on the limits", () => {
    expect(check({ lcp: 2500, cls: 0.01, tbt: 200, performance: 95 }).status).toBe(0);
  });

  it("fails with a clear message for a report that has no LCP, and for no report at all", () => {
    const file = join(dir, "empty.json");
    writeFileSync(
      file,
      JSON.stringify({ audits: {}, categories: { performance: { score: 0.9 } } }),
    );
    const empty = spawnSync(process.execPath, [SCRIPT, "--check", file], { encoding: "utf8" });
    expect(empty.status).toBe(1);
    expect(empty.stderr).toContain("The report has no largest-contentful-paint value");
    const none = spawnSync(process.execPath, [SCRIPT, "--check"], { encoding: "utf8" });
    expect(none.status).toBe(1);
    expect(none.stderr).toContain("--check needs at least one report");
  });
});

describe("the Lighthouse budget, in the open", () => {
  const exported = () => {
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { BUDGET, LIGHTHOUSE_VERSION } from ${JSON.stringify(SCRIPT)}; console.log(JSON.stringify({ BUDGET, LIGHTHOUSE_VERSION }));`,
      ],
      { encoding: "utf8" },
    );
    return JSON.parse(result.stdout) as {
      BUDGET: Record<string, { max?: number; min?: number }>;
      LIGHTHOUSE_VERSION: string;
    };
  };

  it("the page on performance states the budget and the Lighthouse version the script uses", () => {
    const { BUDGET, LIGHTHOUSE_VERSION } = exported();
    const page = readFileSync(join(ROOT, "docs", "performance.md"), "utf8");
    expect(page).toContain(`lighthouse@${LIGHTHOUSE_VERSION}`);
    expect(page).toContain(`${BUDGET.lcp!.max!.toLocaleString("en-US")} ms`);
    expect(page).toContain(String(BUDGET.cls!.max));
    expect(page).toContain(`${BUDGET.tbt!.max} ms`);
    expect(page).toContain(String(BUDGET.performance!.min));
  });

  it("CI runs the script on the site the e2e built, and uploads what it wrote", () => {
    const workflow = readFileSync(join(ROOT, ".github", "workflows", "ci.yml"), "utf8");
    expect(workflow).toContain("node scripts/lighthouse.mjs --dist generated-site");
    expect(workflow).toMatch(/needs: package-and-e2e/);
    expect(workflow).toMatch(/name: lighthouse-report\n\s+path: lighthouse-report\//);
    // The job judges the site that was driven in the browser, not a second build.
    expect(workflow).toMatch(/name: generated-site\n\s+path: e2e\/\.build\/repo\/site\/dist/);
  });

  it("the package is the public one, at an exact version, and not a dependency of this project", () => {
    const { LIGHTHOUSE_VERSION } = exported();
    expect(LIGHTHOUSE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    const manifest = readFileSync(join(ROOT, "package.json"), "utf8");
    expect(manifest).not.toMatch(/lighthouse|performance-toolkit/i);
    expect(readFileSync(SCRIPT, "utf8")).not.toMatch(/performance-toolkit/i);
  });
});
