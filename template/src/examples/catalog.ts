/**
 * The component pages of the documentation of this project: which registry entry has one, what its variants are
 * called, and which types the table of its props is built from. This folder is not part of a generated site.
 *
 * A page is made of four things that must agree, and tests check that they do:
 * the registry entry (`example` points at the folder), the examples in that folder (`example.astro` and one file for
 * each variant), a document `docs/components/<name>.md` with the notes, and the group in `sitekit.config.json`.
 */

/** A table of props to build: a component, or a type that its props use. */
export interface TableSpec {
  /** The file, relative to the template folder. An `.astro` file is read through its frontmatter. */
  file: string;
  /** The exported component (`kind: "props"`), the `Props` interface of an `.astro` file, or an exported type (`kind: "fields"`). */
  symbol: string;
  kind: "props" | "fields";
}

/** One variant or state of a component, shown as a preview of its own from `<name>/<id>.astro`. */
export interface VariantSpec {
  id: string;
  title: string;
  /** One or two sentences: what changes, and when to use it. */
  text: string;
}

/** A component page. */
export interface PageSpec {
  /** The name in `registry.json`, the slug of the document and the folder of the examples. */
  name: string;
  /** The title of the document, as it is written in the component's code. */
  title: string;
  variants: readonly VariantSpec[];
  tables: readonly TableSpec[];
}

const SITE = "src/presentation/components/site";
const props = (file: string, symbol: string): TableSpec => ({ file, symbol, kind: "props" });
const fields = (file: string, symbol: string): TableSpec => ({ file, symbol, kind: "fields" });

/**
 * Every component that has a page, in the order of the index. The entries of `registry.json` that are not here
 * are listed in `docs/components.md` without a page, each with the reason.
 */
export const PAGES: readonly PageSpec[] = [
  {
    name: "button",
    title: "Button",
    tables: [props("src/presentation/components/ui/button.tsx", "Button")],
    variants: [
      {
        id: "variants",
        title: "Variants",
        text: "Six looks for six jobs: the main action, a quiet one, an outline, a ghost, a destructive action and a link.",
      },
      {
        id: "sizes",
        title: "Sizes",
        text: "Three sizes for text, a smaller one, and four for a button that holds only an icon.",
      },
      {
        id: "as-link",
        title: "As a link",
        text: "In an Astro file the look of a button goes on an anchor with buttonVariants, because asChild does not work with Astro children.",
      },
      {
        id: "disabled",
        title: "Disabled",
        text: "A disabled button is dimmed and takes no pointer events.",
      },
    ],
  },
  {
    name: "tone-badge",
    title: "ToneBadge",
    tables: [props(`${SITE}/ToneBadge.tsx`, "ToneBadge")],
    variants: [
      {
        id: "tones",
        title: "Tones",
        text: "The four tones. A status color is chosen here and nowhere else.",
      },
      {
        id: "dot",
        title: "With a dot",
        text: "A dot before the text, hidden from assistive technology.",
      },
    ],
  },
  {
    name: "icon",
    title: "Icon",
    tables: [props(`${SITE}/Icon.tsx`, "Icon")],
    variants: [
      {
        id: "brand",
        title: "A brand logo",
        text: "brand:<slug> draws one of the logos the kit ships, as an inline SVG in the color of the text.",
      },
      {
        id: "label",
        title: "With a name",
        text: "An icon that stands alone gets a label, and then it has a role and a name.",
      },
      {
        id: "unknown",
        title: "A name that does not exist",
        text: "A name that resolves to nothing draws a plain circle.",
      },
    ],
  },
  {
    name: "section-header",
    title: "SectionHeader",
    tables: [props(`${SITE}/SectionHeader.tsx`, "SectionHeader")],
    variants: [
      {
        id: "page-heading",
        title: "The heading of the page",
        text: 'as="h1" for the one heading that names the page.',
      },
      {
        id: "with-action",
        title: "With an action",
        text: "Children go on the right, and wrap under the text on a phone.",
      },
    ],
  },
  {
    name: "hero",
    title: "Hero",
    tables: [props(`${SITE}/Hero.astro`, "Props")],
    variants: [
      {
        id: "minimal",
        title: "Only what is required",
        text: "A headline, a lede and one action. The badge, the command and the second action are optional.",
      },
    ],
  },
  {
    name: "cta-band",
    title: "CtaBand",
    tables: [props(`${SITE}/CtaBand.astro`, "Props")],
    variants: [
      {
        id: "minimal",
        title: "Only what is required",
        text: "A headline and one action. The text, the command and the second action are optional.",
      },
    ],
  },
  {
    name: "site-footer",
    title: "SiteFooter",
    tables: [
      props(`${SITE}/SiteFooter.tsx`, "SiteFooter"),
      fields(`${SITE}/SiteFooter.tsx`, "FooterColumn"),
    ],
    variants: [
      {
        id: "minimal",
        title: "Without columns",
        text: "The brand and the legal line, for a site with one page.",
      },
    ],
  },
  {
    name: "item-card",
    title: "ItemCard",
    tables: [props(`${SITE}/ItemCard.tsx`, "ItemCard"), props(`${SITE}/ItemCard.tsx`, "CardGrid")],
    variants: [
      {
        id: "badge",
        title: "With a badge",
        text: "A tone badge over the title, to say what kind of page the card leads to.",
      },
      {
        id: "plain",
        title: "Title and description only",
        text: "Without a badge or a hint, the card is a title, a text and an arrow.",
      },
    ],
  },
  {
    name: "feature-grid",
    title: "FeatureGrid",
    tables: [
      props(`${SITE}/FeatureGrid.tsx`, "FeatureGrid"),
      fields(`${SITE}/FeatureGrid.tsx`, "FeatureItem"),
    ],
    variants: [
      {
        id: "brand-icon",
        title: "A brand logo as the icon",
        text: "The icon can be brand:<slug>, as in the home page of a project that names its stack.",
      },
    ],
  },
  {
    name: "stat-row",
    title: "StatRow",
    tables: [props(`${SITE}/StatRow.tsx`, "StatRow"), fields(`${SITE}/StatRow.tsx`, "StatItem")],
    variants: [
      {
        id: "with-notes",
        title: "With notes",
        text: "A note under the value, for the unit or the period.",
      },
      {
        id: "long-value",
        title: "A long value",
        text: "A value that does not fit wraps inside its card, and the page does not scroll.",
      },
      {
        id: "five",
        title: "Five stats",
        text: "The most a row takes. Fewer than two or more than five fails the build.",
      },
    ],
  },
  {
    name: "flow-diagram",
    title: "FlowDiagram",
    tables: [
      props(`${SITE}/FlowDiagram.tsx`, "FlowDiagram"),
      fields(`${SITE}/FlowDiagram.tsx`, "FlowStep"),
    ],
    variants: [
      {
        id: "with-commands",
        title: "With a command on each step",
        text: "A command in a mono pill under the step.",
      },
    ],
  },
  {
    name: "callout",
    title: "Callout",
    tables: [props(`${SITE}/Callout.tsx`, "Callout")],
    variants: [
      {
        id: "kinds",
        title: "The five kinds",
        text: "Note, tip, important, warning and caution. The same five come from markdown as > [!NOTE] and the others.",
      },
      { id: "title", title: "With a title", text: "A title replaces the name of the kind." },
    ],
  },
  {
    name: "side-card",
    title: "SideCard",
    tables: [
      props(`${SITE}/SideCard.tsx`, "SideCard"),
      fields(`${SITE}/SideCard.tsx`, "SideCardRow"),
      fields(`${SITE}/SideCard.tsx`, "SideCardLink"),
    ],
    variants: [],
  },
  {
    name: "reference-table",
    title: "ReferenceTable",
    tables: [
      props(`${SITE}/ReferenceTable.tsx`, "ReferenceTable"),
      fields(`${SITE}/ReferenceTable.tsx`, "ReferenceRow"),
    ],
    variants: [
      {
        id: "long-name",
        title: "A long name",
        text: "A name stays on one line, so the table scrolls inside its region and the page does not.",
      },
    ],
  },
  {
    name: "command-table",
    title: "CommandTable",
    tables: [
      props(`${SITE}/CommandTable.tsx`, "CommandTable"),
      fields(`${SITE}/CommandTable.tsx`, "CommandRow"),
    ],
    variants: [
      {
        id: "with-notes",
        title: "With notes",
        text: "A note after the text, shown from the lg breakpoint up.",
      },
    ],
  },
  {
    name: "command-box",
    title: "CommandBox",
    tables: [props(`${SITE}/CommandBox.tsx`, "CommandBox")],
    variants: [
      {
        id: "label",
        title: "With a label of its own",
        text: "The accessible name of the copy button, when the default one does not fit.",
      },
    ],
  },
  {
    name: "breadcrumbs",
    title: "Breadcrumbs",
    tables: [props(`${SITE}/Breadcrumbs.tsx`, "Breadcrumbs")],
    variants: [
      {
        id: "current-only",
        title: "Only the current page",
        text: "A trail of one item has no link and no separator.",
      },
    ],
  },
  {
    name: "catalog-filter",
    title: "CatalogFilter",
    tables: [props(`${SITE}/CatalogFilter.astro`, "Props")],
    variants: [],
  },
  {
    name: "page-info",
    title: "PageInfo",
    tables: [
      props(`${SITE}/PageInfo.tsx`, "PageInfo"),
      fields(`${SITE}/PageInfo.tsx`, "PageUpdated"),
    ],
    variants: [
      {
        id: "edit-only",
        title: "Only the edit link",
        text: "Without a date, for a page outside git.",
      },
      {
        id: "date-only",
        title: "Only the date",
        text: "Without an address to edit, for a page that is not on a known host.",
      },
    ],
  },
];

/** The pages by name. */
export const PAGE_BY_NAME: ReadonlyMap<string, PageSpec> = new Map(
  PAGES.map((page) => [page.name, page]),
);
