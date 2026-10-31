---
title: Icon
description: "A lucide icon by its kebab-case name, or a brand logo as brand:<slug>."
---

# Icon

## About

An icon from `lucide-react` by its name in kebab-case, such as `shield-check`, or a brand logo as `brand:<slug>`, such as `brand:github`. A logo is an inline SVG filled with `currentColor`, so it takes the color of the text and asks nothing from any host. The logos the kit ships, and how to add your own, are in [Brand logos](../brand-logos.md).

## Accessibility

- An icon is decorative by default: it has `aria-hidden="true"`, because the text next to it already names what it shows.
- With `label`, the icon has `role="img"` and that name. A brand logo also carries it as a `<title>`, which a browser shows on hover.
- A brand logo has `focusable="false"`, so an old browser does not put the SVG in the tab order.
- A name that resolves to nothing draws a plain circle, hidden from assistive technology like any other decorative icon.

## Source

- [`Icon.tsx`](../../template/src/presentation/components/site/Icon.tsx)
- [`domain/brands`](../../template/src/domain/brands/index.ts)
