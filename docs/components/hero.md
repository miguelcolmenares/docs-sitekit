---
title: Hero
description: "Badge, headline, lede, command and actions."
---

# Hero

## About

The first screen of the home page: a badge, a headline, a lede, a command to copy and up to two actions. The copy button of the command hydrates when it scrolls into view, and nothing else in the component runs JavaScript.

## Accessibility

- The headline is the `h1` of the page, so a page that uses `Hero` has no other `h1`.
- The two actions are links styled by `buttonVariants` at the `lg` size, which is 40 px high.
- The grid and the glow behind the text are `aria-hidden`, and they are outside the text, so they do not take part in the contrast of the text.
- The command is a [`CommandBox`](./command-box.md), see its notes for the copy button.

## Source

- [`Hero.astro`](../../template/src/presentation/components/site/Hero.astro)
