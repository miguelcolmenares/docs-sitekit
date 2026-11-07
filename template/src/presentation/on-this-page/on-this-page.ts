/**
 * "On this page" marks the section the reader is in. The headings are watched with an `IntersectionObserver` whose
 * root is a one pixel line where a heading becomes current: the `scroll-padding-top` of the page, which is the header
 * and a rem. A heading that crosses the line, up or down, is an event, so no scroll listener runs. A second observer
 * on a one pixel mark at the end of the document says when the page cannot scroll further, so the last section is
 * current there even when it is too short to reach the line.
 *
 * A click, or a `#hash` in the address, sets its link at once and holds it until the heading reaches the line, so the
 * observer does not fight the scroll to the anchor. The hold ends after 1.5 s in any case.
 *
 * The list scrolls inside its own box when it is taller than the screen, so the current link stays in view. It is
 * scrolled with `scrollTo` on the list, not with `scrollIntoView`, which would move the page as well.
 */

/** A heading of the page: its id, and the distance from the top of the viewport to its top, in pixels. */
export interface HeadingPosition {
  /** The id of the heading, which its link in "On this page" names with `#`. */
  id: string;
  /** The top of the heading, measured from the top of the viewport. */
  top: number;
}

/** How long a click or a hash holds the current link while the page scrolls to its heading. */
const HOLD_MS = 1500;

/**
 * The heading that is current: the last one whose top has reached the line, or the last one at the bottom of the page.
 * Above the first heading that has reached the line nothing is current.
 *
 * @param headings - The headings in the order of the document.
 * @param line - The distance from the top of the viewport at which a heading becomes current.
 * @param atBottom - True when the page cannot scroll any further.
 * @returns The id of the current heading, or undefined when none is.
 */
export function activeHeadingId(
  headings: readonly HeadingPosition[],
  line: number,
  atBottom: boolean,
): string | undefined {
  if (atBottom) return headings.at(-1)?.id;
  let active: string | undefined;
  for (const heading of headings) {
    if (heading.top <= line) active = heading.id;
  }
  return active;
}

/**
 * Marks the link of `nav` that names the section on screen with `aria-current="location"`, and keeps it in view in the
 * list. A link whose target is missing from the page is left out.
 *
 * @param nav - The navigation of "On this page", whose links are `#` anchors of the headings.
 */
export function attachOnThisPage(nav: HTMLElement): void {
  const items = [...nav.querySelectorAll<HTMLAnchorElement>("a[href^='#']")].flatMap((link) => {
    const id = link.getAttribute("href")!.slice(1);
    const heading = document.getElementById(id);
    return heading ? [{ id, link, heading }] : [];
  });
  if (items.length === 0) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  // The mark at the end of the document. It is one pixel high and has no content, so it moves nothing.
  const end = document.createElement("div");
  end.setAttribute("aria-hidden", "true");
  end.style.height = "1px";
  document.body.append(end);

  let current: string | undefined;
  let hold: { id: string; timer: number } | undefined;
  let headingWatch: IntersectionObserver | undefined;
  let jumpWatch: IntersectionObserver | undefined;
  let endWatch: IntersectionObserver | undefined;

  // The line sits where the page puts a heading after a jump: `scroll-padding-top`, which the global styles set.
  const line = () => {
    const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
    return Number.isFinite(padding) ? padding + 1 : 77;
  };
  const atBottom = () => {
    const root = document.documentElement;
    return root.scrollHeight > innerHeight && scrollY + innerHeight >= root.scrollHeight - 2;
  };

  const keepInView = (link: HTMLAnchorElement) => {
    if (nav.scrollHeight <= nav.clientHeight) return;
    const box = nav.getBoundingClientRect();
    const item = link.getBoundingClientRect();
    if (item.top >= box.top && item.bottom <= box.bottom) return;
    nav.scrollTo({
      top: nav.scrollTop + item.top - box.top - (box.height - item.height) / 2,
      behavior: reduceMotion.matches ? "auto" : "smooth",
    });
  };
  const show = (id: string | undefined) => {
    if (id === current) return;
    current = id;
    for (const item of items) {
      if (item.id === id) {
        item.link.setAttribute("aria-current", "location");
        keepInView(item.link);
      } else {
        item.link.removeAttribute("aria-current");
      }
    }
  };
  const update = () => {
    if (hold) {
      const target = items.find((item) => item.id === hold!.id)!;
      // Still on the way to the heading: keep the link the reader chose.
      if (Math.abs(target.heading.getBoundingClientRect().top - line()) > 2) return;
      clearTimeout(hold.timer);
      hold = undefined;
    }
    show(
      activeHeadingId(
        items.map((item) => ({ id: item.id, top: item.heading.getBoundingClientRect().top })),
        line(),
        atBottom(),
      ),
    );
  };
  const holdOn = (id: string) => {
    if (hold) clearTimeout(hold.timer);
    show(id);
    hold = {
      id,
      timer: window.setTimeout(() => {
        hold = undefined;
        update();
      }, HOLD_MS),
    };
  };
  const observe = () => {
    headingWatch?.disconnect();
    jumpWatch?.disconnect();
    endWatch?.disconnect();
    const height = innerHeight;
    const lineAt = Math.round(line());
    // A band from the line down to the line plus one pixel: a heading that crosses the line enters or leaves it.
    headingWatch = new IntersectionObserver(update, {
      rootMargin: `-${lineAt}px 0px -${Math.max(0, height - lineAt - 1)}px 0px`,
    });
    // A heading that moves past the line in one jump (Page Down, a drag of the scroll bar) is not seen by the band
    // above, because it is in neither state for a frame. This band is everything below the line, so a heading that
    // was below it and is above it now is seen.
    jumpWatch = new IntersectionObserver(update, { rootMargin: `-${lineAt}px 0px 0px 0px` });
    for (const item of items) {
      headingWatch.observe(item.heading);
      jumpWatch.observe(item.heading);
    }
    // The bottom one pixel of the viewport: the mark is in it when the page is at its end.
    endWatch = new IntersectionObserver(update, {
      rootMargin: `-${Math.max(0, height - 1)}px 0px 0px 0px`,
    });
    endWatch.observe(end);
  };

  for (const item of items) {
    item.link.addEventListener("click", () => holdOn(item.id));
  }
  const fromHash = items.find((item) => `#${item.id}` === location.hash);
  if (fromHash) holdOn(fromHash.id);
  observe();
  update();
  window.addEventListener("resize", () => {
    observe();
    update();
  });
}
