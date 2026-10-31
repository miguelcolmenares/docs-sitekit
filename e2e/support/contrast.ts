import type { Page } from "@playwright/test";

/** A piece of text below the contrast it needs, with the colors that were measured. */
export interface ContrastOffender {
  element: string;
  text: string;
  ratio: number;
  required: number;
  foreground: string;
  background: string;
}

/**
 * Measure the contrast of every visible piece of text on the page, in the browser.
 * The background is found by stacking the background colors of the element and its ancestors, so it
 * works for any CSS color syntax. An ancestor that paints an image or a gradient behind the text is
 * reported as `uncertain`, not guessed. Decorative layers that sit behind the page (the hero glow)
 * are covered by a token test, since they are not ancestors of the text. The text of a disabled control is
 * left out, as WCAG 1.4.3 does.
 */
export async function measureContrast(
  page: Page,
): Promise<{ offenders: ContrastOffender[]; uncertain: string[]; checked: number }> {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    type Rgba = [number, number, number, number];

    const parse = (css: string): Rgba => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = "#000";
      context.fillStyle = css;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data as unknown as number[];
      // getImageData premultiplies away the alpha for fully drawn pixels, so read it from the CSS when needed.
      return [r!, g!, b!, a! / 255];
    };
    const over = (top: Rgba, bottom: Rgba): Rgba => {
      const a = top[3] + bottom[3] * (1 - top[3]);
      if (a === 0) return [0, 0, 0, 0];
      const mix = (i: 0 | 1 | 2) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a;
      return [mix(0), mix(1), mix(2), a];
    };
    const luminance = ([r, g, b]: Rgba) => {
      const channel = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const ratio = (a: Rgba, b: Rgba) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    const label = (element: Element) =>
      `${element.tagName.toLowerCase()}${element.className && typeof element.className === "string" ? `.${element.className.split(/\s+/).slice(0, 2).join(".")}` : ""}`;

    const offenders: ContrastOffender[] = [];
    const uncertain: string[] = [];
    let checked = 0;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      const element = node.parentElement;
      if (!text || !element || seen.has(element)) continue;
      if (["SCRIPT", "STYLE", "NOSCRIPT", "TITLE"].includes(element.tagName)) continue;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (
        rect.width === 0 ||
        rect.height === 0 ||
        style.visibility === "hidden" ||
        style.display === "none"
      )
        continue;
      if (rect.width <= 1 && rect.height <= 1) continue; // sr-only
      // WCAG 1.4.3 leaves out the text of an inactive component: a disabled control has no contrast to meet.
      if (element.closest(":disabled")) continue;
      seen.add(element);

      // Opacity applies to the whole subtree, so multiply it up the tree.
      let opacity = 1;
      const layers: Rgba[] = [];
      let paintsImage = false;
      for (let current: Element | null = element; current; current = current.parentElement) {
        const s = getComputedStyle(current);
        opacity *= Number(s.opacity);
        if (s.backgroundImage !== "none" && current !== element) paintsImage = true;
        const bg = parse(s.backgroundColor);
        if (bg[3] > 0) layers.push(bg);
        if (bg[3] === 1) break;
      }
      let background: Rgba = parse(getComputedStyle(document.documentElement).backgroundColor);
      if (background[3] === 0) background = parse(getComputedStyle(document.body).backgroundColor);
      if (background[3] === 0) background = [9, 9, 11, 1];
      for (const layer of layers.reverse()) background = over(layer, background);

      if (paintsImage) {
        uncertain.push(`${label(element)}: "${text.slice(0, 40)}"`);
        continue;
      }
      const color = parse(style.color);
      const foreground = over([color[0], color[1], color[2], color[3] * opacity], background);
      const size = parseFloat(style.fontSize);
      const bold = Number(style.fontWeight) >= 700;
      const required = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
      const value = ratio(foreground, background);
      checked += 1;
      if (value + 0.005 < required) {
        offenders.push({
          element: label(element),
          text: text.slice(0, 40),
          ratio: Math.round(value * 100) / 100,
          required,
          foreground: `rgb(${foreground.slice(0, 3).map(Math.round).join(",")})`,
          background: `rgb(${background.slice(0, 3).map(Math.round).join(",")})`,
        });
      }
    }
    return { offenders, uncertain, checked };
  });
}
