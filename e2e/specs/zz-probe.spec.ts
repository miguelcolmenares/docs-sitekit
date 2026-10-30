/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "@playwright/test";

test("probe: where does the layout shift come from", async ({ browser }) => {
  const lines: string[] = [];
  for (let run = 0; run < 8; run++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => {
      const log: unknown[] = [];
      (window as any).__log = log;
      const desc = (n: Node | null) => {
        const e = n instanceof Element ? n : n?.parentElement;
        return e
          ? `${e.tagName.toLowerCase()}${[...e.attributes]
              .map((a) => a.name)
              .filter((a) => a.startsWith("data-"))
              .join(",")}`
          : "null";
      };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          log.push({
            t: Math.round(entry.startTime),
            v: +entry.value.toFixed(4),
            sources: (entry.sources ?? []).map((s: any) => desc(s.node)),
          });
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/widget/docs/");
    await page.waitForTimeout(800);
    const out = await page.evaluate(() => ({
      shifts: (window as any).__log,
      fonts: [...document.fonts]
        .filter((f) => f.status === "loaded")
        .map((f) => f.family)
        .join(","),
      woff: performance
        .getEntriesByType("resource")
        .filter((r) => r.name.includes(".woff2"))
        .map(
          (r) =>
            `${r.name.split("/").pop()?.slice(0, 20)}@${Math.round(r.startTime)}+${Math.round(r.duration)}`,
        ),
      fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? -1),
      family: getComputedStyle(document.body).fontFamily,
      h1: document.querySelector("h1")?.getBoundingClientRect().height,
    }));
    lines.push(`run ${run}: ${JSON.stringify(out)}`);
    await context.close();
  }
  throw new Error("PROBE\n" + lines.join("\n"));
});
