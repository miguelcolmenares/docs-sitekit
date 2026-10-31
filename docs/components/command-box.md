---
title: CommandBox
description: "A copyable shell command."
---

# CommandBox

## About

A command in a box, with a button that copies it. The text is in the HTML, and the button copies once the page's script has hydrated it. A long command scrolls inside the box without a scroll bar, and the page does not widen.

## Accessibility

- The button is a real button named "Copy command: " and the command, or by `label` when you pass one.
- After a copy the icon changes and a polite status region inside the button says "Copied" for a moment.
- The button is 32 px square: above the 24 px minimum of WCAG 2.2, and under the 44 px that the kit asks for on a phone.
- Without JavaScript the button is in the page and does nothing. The command stays selectable, and the box is not a form control.
- The `$` is decorative and `aria-hidden`.

## Source

- [`CommandBox.tsx`](../../template/src/presentation/components/site/CommandBox.tsx)
