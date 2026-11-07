/**
 * The two sidebars of a documentation page that a reader can hide: the docs menu on the left and "On this page" on the
 * right. The head script of the layout has already set `data-docs-menu` or `data-docs-toc` to "hidden" on <html> from
 * the choice saved in the browser, so the page is laid out before its first paint. This script shows the buttons, keeps
 * their name and `aria-expanded` in step with that attribute, and saves each click. With storage blocked the choice
 * holds for the page only. Without this script the buttons stay hidden and both sidebars are shown.
 */

/** A sidebar that a reader can hide. */
export type SidebarName = "menu" | "toc";

/**
 * Whether the value of a sidebar's attribute on <html> hides it.
 *
 * @param value - The attribute's value, or null when it is not set.
 * @returns True only for "hidden".
 */
export function isHidden(value: string | null | undefined): boolean {
  return value === "hidden";
}

/**
 * The attribute on <html> that hides a sidebar.
 *
 * @param name - The sidebar.
 * @returns `data-docs-menu` or `data-docs-toc`.
 */
export function attributeOf(name: SidebarName): string {
  return `data-docs-${name}`;
}

/**
 * The key in localStorage that keeps the choice of a sidebar. It is read by the head script of the layout too.
 *
 * @param name - The sidebar.
 * @returns `docs-menu` or `docs-toc`.
 */
export function storageKey(name: SidebarName): string {
  return `docs-${name}`;
}

/**
 * The accessible name of a sidebar's button: what a click does from the state the sidebar is in now.
 *
 * @param name - The sidebar.
 * @param expanded - True while the sidebar is shown.
 * @returns "Hide the docs menu" or "Show the docs menu", and the same for the table of contents.
 */
export function labelFor(name: SidebarName, expanded: boolean): string {
  const sidebar = name === "menu" ? "the docs menu" : "the table of contents";
  return `${expanded ? "Hide" : "Show"} ${sidebar}`;
}

/**
 * Wires the buttons `[data-sidebar-toggle]` of the page. Each button is shown, its name and `aria-expanded` follow the
 * attribute on <html>, and a click sets the attribute and saves the choice.
 *
 * @param root - The element that carries the attributes. The document element by default.
 */
export function attachSidebarToggles(root: HTMLElement = document.documentElement): void {
  document.querySelectorAll<HTMLButtonElement>("[data-sidebar-toggle]").forEach((button) => {
    const name = button.dataset.sidebarToggle;
    if (name !== "menu" && name !== "toc") return;
    const attribute = attributeOf(name);
    const shown = () => !isHidden(root.getAttribute(attribute));
    const sync = () => {
      button.setAttribute("aria-expanded", String(shown()));
      button.setAttribute("aria-label", labelFor(name, shown()));
    };
    sync();
    button.hidden = false;
    button.addEventListener("click", () => {
      const hide = shown();
      if (hide) root.setAttribute(attribute, "hidden");
      else root.removeAttribute(attribute);
      remember(storageKey(name), hide);
      sync();
    });
  });
}

function remember(key: string, hide: boolean): void {
  try {
    if (hide) localStorage.setItem(key, "hidden");
    else localStorage.removeItem(key);
  } catch {
    // Storage is blocked: the choice still holds on this page.
  }
}
