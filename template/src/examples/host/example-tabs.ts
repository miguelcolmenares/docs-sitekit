/**
 * The script of the Preview and Code tabs, and of the switch that shows a preview in the other theme. The server
 * writes both panels one after the other and the bar hidden, so without this script a visitor reads the preview and
 * then the code. Here the bar is shown by a one line script right after each block (so the first paint is final),
 * and this module wires it: the tabs pattern, with `aria-selected`, a roving `tabindex` and the arrow keys, Home and
 * End. It makes no request.
 */
const root = document.documentElement;

/** The theme the page shows now. A page with no attribute yet (a system theme before its script) is read from the media query. */
const pageTheme = (): "dark" | "light" => {
  const value = root.dataset.theme;
  if (value === "dark" || value === "light") return value;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
};
const otherTheme = () => (pageTheme() === "light" ? "dark" : "light");

for (const block of document.querySelectorAll<HTMLElement>("[data-example]")) {
  const tabs = [...block.querySelectorAll<HTMLButtonElement>("[data-example-tab]")];
  const panels = new Map(
    [...block.querySelectorAll<HTMLElement>("[data-example-panel]")].map((panel) => [
      panel.dataset.examplePanel!,
      panel,
    ]),
  );
  const stage = block.querySelector<HTMLElement>("[data-example-stage]")!;
  const toggle = block.querySelector<HTMLButtonElement>("[data-example-theme]")!;

  const select = (name: string, focus = false) => {
    for (const tab of tabs) {
      const active = tab.dataset.exampleTab === name;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    }
    for (const [key, panel] of panels) panel.hidden = key !== name;
    // The switch is about the preview, so it is only there while the preview is.
    toggle.hidden = name !== "preview";
  };

  const syncTheme = () => {
    const pressed = toggle.getAttribute("aria-pressed") === "true";
    toggle.textContent = `Preview in the ${otherTheme()} theme`;
    if (pressed) stage.dataset.previewTheme = otherTheme();
    else delete stage.dataset.previewTheme;
  };

  panels.get("preview")!.tabIndex = 0;
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(tab.dataset.exampleTab!));
    tab.addEventListener("keydown", (event) => {
      const last = tabs.length - 1;
      const target =
        event.key === "ArrowRight"
          ? (index + 1) % tabs.length
          : event.key === "ArrowLeft"
            ? (index - 1 + tabs.length) % tabs.length
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? last
                : -1;
      if (target === -1) return;
      event.preventDefault();
      select(tabs[target]!.dataset.exampleTab!, true);
    });
  });
  toggle.addEventListener("click", () => {
    toggle.setAttribute("aria-pressed", String(toggle.getAttribute("aria-pressed") !== "true"));
    syncTheme();
  });
  window.addEventListener("themechange", syncTheme);
  select("preview");
  syncTheme();
}
