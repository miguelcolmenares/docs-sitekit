/** What the form on the page collects. */
export interface HeroChoices {
  /** The headline of the home page. */
  title: string;
  /** The text under the headline. */
  lede: string;
  /** A short line above the headline. Empty leaves it out. */
  badge: string;
  /** The text of the main button. */
  action: string;
  /** Where the main button goes, a path of the site. */
  target: string;
  /** Add a second, quieter button that goes to the changelog. */
  secondary: boolean;
}

/** The form starts here, and so does the page the server sends. */
export const DEFAULT_CHOICES: HeroChoices = {
  title: "Documentation that looks like a product",
  lede: "Guides, reference and examples in one place.",
  badge: "",
  action: "Get started",
  target: "/docs/getting-started/",
  secondary: false,
};

/** The `hero` key of sitekit.config.json for these choices, as text. */
export function heroSnippet(choices: HeroChoices): string {
  const badge = choices.badge.trim();
  const hero = {
    ...(badge ? { badge } : {}),
    title: choices.title,
    lede: choices.lede,
    primary: { label: choices.action, href: choices.target },
    ...(choices.secondary
      ? { secondary: { label: "Read the changelog", href: "/changelog/" } }
      : {}),
  };
  return JSON.stringify({ hero }, null, 2);
}

/** What the config would refuse: the three texts the schema asks for must not be empty. */
export function heroProblems(choices: HeroChoices): string[] {
  const required = [
    ["title", choices.title],
    ["lede", choices.lede],
    ["button text", choices.action],
  ] as const;
  return required
    .filter(([, value]) => value.trim() === "")
    .map(([name]) => `The ${name} is empty.`);
}
