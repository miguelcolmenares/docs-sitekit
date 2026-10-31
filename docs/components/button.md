---
title: Button
description: "Button and buttonVariants, from shadcn/ui, with the look of the kit."
---

# Button

## About

The button of shadcn/ui, wired to the tokens of the kit. `Button` draws a `<button>`. `buttonVariants` returns the classes of the same look, for an anchor or any other element.

On an Astro page, put the look on the element with `buttonVariants`. `asChild` hands the look to a child element through a React slot, and a child written in Astro is not a React element, so it does not work there.

## Accessibility

- A `Button` is a native `<button>`: Tab reaches it, and Enter and Space press it. An anchor with `buttonVariants` is a link, so Enter presses it and Space does not.
- The focus ring is the 3 px ring of the component on top of the outline of the site, in both themes.
- The heights are 36 px (`default`), 24 px (`xs`), 32 px (`sm`) and 40 px (`lg`). The square `icon` sizes are 36 px, 24 px, 32 px and 40 px. None of them reaches the 44 px that the kit asks for on a phone, so on a phone add a taller class, for example `className="min-h-11"`. The 24 px sizes only meet the minimum of WCAG 2.2.
- A button that holds only an icon needs an `aria-label`. The component cannot know the name, so it does not add one.
- `disabled` dims the button to half its opacity and stops pointer events. A disabled control is exempt from the contrast rules.

## Source

- [`button.tsx`](../../template/src/presentation/components/ui/button.tsx)
