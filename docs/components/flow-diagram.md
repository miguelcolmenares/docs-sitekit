---
title: FlowDiagram
description: "Steps in a row that stack on small screens."
---

# FlowDiagram

## About

A process as steps in a row, each with a phase, a title, a detail and a command. The steps are in a row from the `md` width, with a short line between them, and stacked under it.

## Accessibility

- The steps are an ordered list, so a screen reader says the position of each step.
- The line between two steps is `aria-hidden`.
- A command is plain text in a `<code>` element, not a control.

## Source

- [`FlowDiagram.tsx`](../../template/src/presentation/components/site/FlowDiagram.tsx)
