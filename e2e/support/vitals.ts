import type { Page } from "@playwright/test";

/** The element the browser chose as the largest contentful paint, and when each phase of it ended. */
export interface LcpReport {
  /** Milliseconds from the start of the navigation to the paint. */
  time: number;
  /** The element, as a selector the report can show: tag, id and the first classes. */
  element: string;
  /** The text or the address the element shows, cut short. */
  content: string;
  /** Time to first byte of the document. */
  ttfb: number;
  /** From the first byte to the start of the request for the element's resource. 0 for text. */
  loadDelay: number;
  /** How long that request took. 0 for text. */
  loadTime: number;
  /** From the end of the load (or the first byte, for text) to the paint. */
  renderDelay: number;
}

/** What the page measured for itself since the navigation started. */
export interface Vitals {
  /** Cumulative layout shift: the sum of every shift that did not follow a user's input. */
  cls: number;
  /** Each shift, with the time it happened and the elements that moved. */
  shifts: { value: number; time: number; sources: string[] }[];
  lcp: LcpReport | null;
  /** When the last web font finished loading, or null while none has. */
  fontLoadedAt: number | null;
}

/**
 * Start `PerformanceObserver`s for layout shift and largest contentful paint before any page script runs.
 * Call it before `page.goto`. The observers are `buffered`, so nothing before them is missed either.
 */
export async function observeVitals(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = {
      shifts: [] as { value: number; time: number; sources: string[] }[],
      lcp: null as null | Record<string, unknown>,
      fontLoadedAt: null as number | null,
    };
    (window as unknown as { __vitals: typeof state }).__vitals = state;

    const describe = (node: Node | null | undefined): string => {
      if (!(node instanceof Element)) return "(no element)";
      const classes = [...node.classList].slice(0, 3).join(".");
      return `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}${classes ? `.${classes}` : ""}`;
    };

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        startTime: number;
        hadRecentInput: boolean;
        sources?: { node: Node | null }[];
      }[]) {
        if (entry.hadRecentInput) continue;
        state.shifts.push({
          value: entry.value,
          time: entry.startTime,
          sources: (entry.sources ?? []).map((source) => describe(source.node)),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });

    new PerformanceObserver((list) => {
      const entries = list.getEntries() as unknown as {
        startTime: number;
        url: string;
        element: Element | null;
      }[];
      const last = entries[entries.length - 1];
      if (!last) return;
      const [navigation] = performance.getEntriesByType(
        "navigation",
      ) as PerformanceNavigationTiming[];
      const ttfb = navigation?.responseStart ?? 0;
      let loadDelay = 0;
      let loadTime = 0;
      let renderStart = ttfb;
      if (last.url) {
        const resource = performance.getEntriesByName(last.url)[0] as
          PerformanceResourceTiming | undefined;
        if (resource) {
          loadDelay = Math.max(0, resource.startTime - ttfb);
          loadTime = Math.max(0, resource.responseEnd - resource.startTime);
          renderStart = resource.responseEnd;
        }
      }
      state.lcp = {
        time: last.startTime,
        element: describe(last.element),
        content: (last.url || last.element?.textContent || "").trim().slice(0, 60),
        ttfb,
        loadDelay,
        loadTime,
        renderDelay: Math.max(0, last.startTime - renderStart),
      };
    }).observe({ type: "largest-contentful-paint", buffered: true });

    document.fonts.addEventListener("loadingdone", () => {
      state.fontLoadedAt = performance.now();
    });
  });
}

/** Read what `observeVitals` collected. Wait first for the page to settle, or the numbers are early. */
export async function readVitals(page: Page): Promise<Vitals> {
  const state = await page.evaluate(
    () => (window as unknown as { __vitals: Omit<Vitals, "cls"> }).__vitals,
  );
  return { ...state, cls: state.shifts.reduce((sum, shift) => sum + shift.value, 0) };
}

/** One readable block for a failure message: the shifts, then the LCP element and its four phases. */
export function describeVitals(vitals: Vitals): string {
  const ms = (value: number) => `${Math.round(value)} ms`;
  const lines = [
    `CLS ${vitals.cls.toFixed(4)} in ${vitals.shifts.length} shift(s)`,
    ...vitals.shifts.map(
      (shift) => `  ${shift.value.toFixed(4)} at ${ms(shift.time)}: ${shift.sources.join(", ")}`,
    ),
  ];
  const lcp = vitals.lcp;
  lines.push(
    lcp
      ? `LCP ${ms(lcp.time)}, element ${lcp.element} "${lcp.content}"\n  TTFB ${ms(lcp.ttfb)}, load delay ${ms(lcp.loadDelay)}, load time ${ms(lcp.loadTime)}, render delay ${ms(lcp.renderDelay)}`
      : "LCP: the browser reported none",
  );
  lines.push(`Font loaded at ${vitals.fontLoadedAt === null ? "never" : ms(vitals.fontLoadedAt)}`);
  return lines.join("\n");
}
