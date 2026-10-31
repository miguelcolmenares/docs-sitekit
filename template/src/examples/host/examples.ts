import type { AstroComponentFactory } from "astro/runtime/server/index.js";

/** The example files, as components, and as text. Both come from the same files, so a preview and its code cannot drift. */
const components = import.meta.glob<{ default: AstroComponentFactory }>(
  ["../*/*.astro", "!../host/*.astro"],
  { eager: true },
);
const sources = import.meta.glob<string>(["../*/*.astro", "!../host/*.astro"], {
  query: "?raw",
  import: "default",
  eager: true,
});

/** One example of a component: what to draw, and the text of the file that draws it. */
export interface Example {
  Component: AstroComponentFactory;
  source: string;
  /** The path of the file in the template, for the title of the code block. */
  path: string;
}

/** The example `<id>.astro` of the folder `<name>`. It throws when there is none, so a page cannot ship without it. */
export function exampleFor(name: string, id: string): Example {
  const key = `../${name}/${id}.astro`;
  const component = components[key]?.default;
  const source = sources[key];
  if (!component || source === undefined)
    throw new Error(`There is no example src/examples/${name}/${id}.astro.`);
  return { Component: component, source, path: `src/examples/${name}/${id}.astro` };
}
