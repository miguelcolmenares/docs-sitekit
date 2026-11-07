/**
 * The script of the color palette. The server writes every copy button hidden, because without JavaScript it would do
 * nothing, and the swatches and their values stay readable. This shows the buttons where the browser allows clipboard
 * writes, and one listener on the page copies the value of the button that was clicked. After a copy the button says
 * "Copied" for a moment, and the polite status region of the palette says the value, its token and its set, so a
 * screen reader hears the result. A failed copy is announced the same way. It makes no request.
 */
if (navigator.clipboard) {
  const timers = new WeakMap<Element, number>();
  document.querySelectorAll<HTMLButtonElement>(".palette-copy").forEach((button) => {
    button.hidden = false;
  });
  document.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(".palette-copy");
    const palette = button?.closest("[data-color-palette]");
    const status = palette?.querySelector(".palette-status");
    const value = button?.dataset.paletteCopy;
    const name = button?.dataset.paletteName ?? "";
    if (!button || !value || !status) return;
    status.textContent = "";
    navigator.clipboard.writeText(value).then(
      () => {
        button.textContent = button.dataset.copied ?? "";
        status.textContent = `Copied ${name}`;
        clearTimeout(timers.get(button));
        timers.set(
          button,
          window.setTimeout(() => {
            button.textContent = button.dataset.copy ?? "";
          }, 1600),
        );
      },
      () => {
        status.textContent = `Could not copy ${name}`;
      },
    );
  });
}
