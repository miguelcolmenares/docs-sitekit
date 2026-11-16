/* global document */
const button = document.querySelector("button");
button.addEventListener("click", () => {
  const count = button.querySelector("span");
  count.textContent = String(Number(count.textContent) + 1);
  document.querySelector('[role="status"]').textContent = "Count updated";
});
