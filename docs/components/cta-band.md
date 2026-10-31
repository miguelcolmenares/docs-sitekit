---
title: CtaBand
description: "Closing headline with a command and actions."
---

# CtaBand

## About

The band at the end of a page: a headline, an optional sentence and command, and up to two actions.

## Accessibility

- The headline is an `h2`, so it sits under the `h1` of the page.
- The actions are links styled by `buttonVariants` at the `lg` size, which is 40 px high.
- The glow behind the text is `aria-hidden` and outside the text.
- The command is a [`CommandBox`](./command-box.md), see its notes for the copy button.

## Source

- [`CtaBand.astro`](../../template/src/presentation/components/site/CtaBand.astro)
