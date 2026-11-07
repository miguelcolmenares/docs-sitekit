import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COLOR_PALETTE_MARKER, colorPalette } from "../../../template/src/domain";
import type { TokenColors } from "../../../template/src/domain";
import { remarkColorPalette } from "../../../template/src/infrastructure";

const ROOT = join(__dirname, "..", "..", "..");
const tokens = JSON.parse(
  readFileSync(join(ROOT, "template", "design", "tokens.json"), "utf8"),
) as TokenColors;

interface Node {
  type: string;
  value?: string;
  children?: Node[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

const root = (...children: Node[]): Node => ({ type: "root", children });
const html = (value: string): Node => ({ type: "html", value });
const paragraph = (value: string): Node => ({
  type: "paragraph",
  children: [{ type: "text", value }],
});

/** Every node of a tree, the node first, then its children in order. */
function nodes(node: Node): Node[] {
  return [node, ...(node.children ?? []).flatMap(nodes)];
}

/** The palette a page renders from a token file, through the remark plugin. */
function render(source: TokenColors): Node {
  const tree = root(paragraph("Before."), html(COLOR_PALETTE_MARKER), paragraph("After."));
  remarkColorPalette({ tokens: source, base: "/site/" })(tree);
  return tree;
}

/** The values a palette offers to copy, in the order of the page: each token's dark value, then its light one. */
const expectedCopies = colorPalette(tokens).flatMap((group) =>
  group.entries.flatMap((entry) => [entry.dark, entry.light]),
);

describe("the design tokens page", () => {
  it("asks for the palette once, where GitHub hides it, and the page keeps its tables", () => {
    const page = readFileSync(join(ROOT, "docs", "design-tokens.md"), "utf8");
    expect(page.split(COLOR_PALETTE_MARKER)).toHaveLength(2);
  });
});

describe("colorPalette", () => {
  it("has every color token of the kit once, in a group, and no group called Other", () => {
    const shown = colorPalette(tokens).flatMap((group) => group.entries.map((entry) => entry.name));
    expect([...shown].sort()).toEqual(Object.keys(tokens.color).sort());
    expect(colorPalette(tokens).map((group) => group.title)).not.toContain("Other");
  });

  it("gives each token its dark and its light value from the file", () => {
    for (const entry of colorPalette(tokens).flatMap((group) => group.entries)) {
      expect(entry.dark).toBe(tokens.color[entry.name]);
      expect(entry.light).toBe(tokens.themes!.light!.color![entry.name]);
    }
  });

  it("puts a token that no group lists in Other, so a site's own token is shown", () => {
    const extended: TokenColors = {
      color: { ...tokens.color, brand: "#123456" },
      themes: { light: { color: { ...tokens.themes!.light!.color, brand: "#654321" } } },
    };
    const other = colorPalette(extended).find((group) => group.title === "Other");
    expect(other?.entries).toEqual([{ name: "brand", dark: "#123456", light: "#654321" }]);
  });

  it("throws when the light and the dark set do not have the same tokens", () => {
    const broken: TokenColors = {
      color: { ...tokens.color, extra: "#000000" },
      themes: { light: { color: tokens.themes!.light!.color! } },
    };
    expect(() => colorPalette(broken)).toThrow(/Only in dark: extra/);
  });
});

describe("remarkColorPalette", () => {
  it("replaces the marker with the palette, and keeps the text around it", () => {
    const tree = render(tokens);
    expect(tree.children!.map((child) => child.type)).toEqual([
      "paragraph",
      "palette",
      "paragraph",
    ]);
    expect(tree.children![1]!.data).toMatchObject({
      hName: "div",
      hProperties: { className: ["color-palette"], dataColorPalette: "" },
    });
  });

  it("loads its own script from the base of the site, which the repository ships", () => {
    const script = nodes(render(tokens)).find((node) => node.data?.hName === "script");
    expect(script?.data?.hProperties).toEqual({ type: "module", src: "/site/palette-copy.js" });
    expect(existsSync(join(ROOT, "template", "public", "palette-copy.js"))).toBe(true);
  });

  it("renders a swatch and a copy button for each value of the file, and nothing else", () => {
    const copies = nodes(render(tokens))
      .map((node) => node.data?.hProperties?.dataPaletteCopy)
      .filter((value) => value !== undefined);
    expect(copies).toEqual(expectedCopies);
    expect(copies).toHaveLength(Object.keys(tokens.color).length * 2);
  });

  it("draws each chip with the color of the file and labels its copy button with the token and the set", () => {
    const items = nodes(render(tokens)).filter((node) =>
      (node.data?.hProperties?.className as string[] | undefined)?.includes("palette-chip"),
    );
    const chips = items.map((node) => node.data!.hProperties!.style);
    const expectedChips = colorPalette(tokens).flatMap((group) =>
      group.entries.flatMap((entry) => [
        `background-color: ${entry.dark}`,
        `background-color: ${entry.light}`,
      ]),
    );
    expect(chips).toEqual(expectedChips);

    const labels = nodes(render(tokens))
      .map((node) => node.data?.hProperties?.ariaLabel)
      .filter((label) => label !== undefined);
    const expectedLabels = colorPalette(tokens).flatMap((group) =>
      group.entries.flatMap((entry) => [
        `Copy ${entry.dark}, ${entry.name}, dark`,
        `Copy ${entry.light}, ${entry.name}, light`,
      ]),
    );
    expect(labels).toEqual(expectedLabels);
  });

  it("hides every copy button, because only the page script can copy", () => {
    const buttons = nodes(render(tokens)).filter((node) => node.data?.hName === "button");
    expect(buttons.length).toBe(expectedCopies.length);
    for (const button of buttons) expect(button.data!.hProperties).toMatchObject({ hidden: true });
  });

  it("leaves any other HTML, and a page without the marker, as they are", () => {
    const tree = root(html("<!-- a note -->"), paragraph("Text."));
    remarkColorPalette({ tokens, base: "/site/" })(tree);
    expect(tree.children).toEqual([html("<!-- a note -->"), paragraph("Text.")]);
  });

  it("fails the build when a page asks for the palette in a site with no tokens", () => {
    const tree = root(html(COLOR_PALETTE_MARKER));
    expect(() => remarkColorPalette({ base: "/site/" })(tree)).toThrow(/design\/tokens\.json/);
  });
});
