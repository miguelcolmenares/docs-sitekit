import { CALLOUT_KINDS, CALLOUT_LABELS } from "../../../template/src/domain";
import { remarkCallouts } from "../../../template/src/infrastructure";
import { calloutIcon } from "../../../template/src/infrastructure/calloutIcons";

interface Node {
  type: string;
  value?: string;
  lang?: string;
  children?: Node[];
  data?: { hName?: string; hProperties?: Record<string, unknown>; hChildren?: unknown[] };
}

const text = (value: string): Node => ({ type: "text", value });
const paragraph = (...children: Node[]): Node => ({ type: "paragraph", children });
const quote = (...children: Node[]): Node => ({ type: "blockquote", children });
const root = (...children: Node[]): Node => ({ type: "root", children });

function run(tree: Node): Node {
  remarkCallouts()(tree);
  return tree;
}

/** The callout a blockquote became: its outer node, the label and the nodes of its text. */
function parts(callout: Node) {
  const [icon, body] = callout.children!;
  const [label, ...content] = body!.children!;
  return { icon: icon!, body: body!, label: label!, content };
}

describe("remarkCallouts", () => {
  it.each(CALLOUT_KINDS)(
    "turns [!%s] into an aside with a note role, an icon and a label",
    (kind) => {
      const tree = run(root(quote(paragraph(text(`[!${kind.toUpperCase()}]\nThe text.`)))));
      const callout = tree.children![0]!;
      expect(callout.data).toMatchObject({
        hName: "aside",
        hProperties: { role: "note", dataCallout: kind, className: ["callout", `callout-${kind}`] },
      });
      const { icon, label, content } = parts(callout);
      expect(icon.data).toMatchObject({ hName: "svg", hProperties: { ariaHidden: "true" } });
      expect(icon.data!.hChildren!.length).toBeGreaterThan(0);
      expect(label.data!.hName).toBe("p");
      expect(label.children).toEqual([text(CALLOUT_LABELS[kind])]);
      expect(content).toEqual([paragraph(text("The text."))]);
    },
  );

  it("is not announced as an alert: no alert role and no live region", () => {
    const tree = run(root(quote(paragraph(text("[!WARNING]\nCareful.")))));
    const properties = tree.children![0]!.data!.hProperties!;
    expect(properties.role).toBe("note");
    expect(properties).not.toHaveProperty("ariaLive");
  });

  it("removes a paragraph that holds only the marker and keeps the next blocks", () => {
    const list = {
      type: "list",
      children: [{ type: "listItem", children: [paragraph(text("a"))] }],
    };
    const tree = run(root(quote(paragraph(text("[!TIP]")), paragraph(text("One.")), list)));
    expect(parts(tree.children![0]!).content).toEqual([paragraph(text("One.")), list]);
  });

  it("drops the break that follows a marker ended with two spaces or a backslash", () => {
    const tree = run(root(quote(paragraph(text("[!NOTE]"), { type: "break" }, text("After.")))));
    expect(parts(tree.children![0]!).content).toEqual([paragraph(text("After."))]);
  });

  it("keeps inline nodes that follow the marker line", () => {
    const strong = { type: "strong", children: [text("bold")] };
    const tree = run(root(quote(paragraph(text("[!NOTE]\nSee "), strong))));
    expect(parts(tree.children![0]!).content).toEqual([paragraph(text("See "), strong)]);
  });

  it("keeps code and lists inside the callout", () => {
    const code = { type: "code", lang: "ts", value: "const a = 1;" };
    const list = { type: "list", children: [] };
    const tree = run(root(quote(paragraph(text("[!NOTE]\nRun:")), code, list)));
    expect(parts(tree.children![0]!).content).toEqual([paragraph(text("Run:")), code, list]);
  });

  it("works inside a list item, and a callout can hold another callout", () => {
    const inner = quote(paragraph(text("[!CAUTION]\nInner.")));
    const outer = quote(paragraph(text("[!NOTE]\nOuter.")), inner);
    const item = { type: "listItem", children: [paragraph(text("Step")), outer] };
    const tree = run(root({ type: "list", children: [item] }));
    const outerCallout = item.children[1]!;
    expect(outerCallout.data!.hName).toBe("aside");
    const innerCallout = parts(outerCallout).content[1]!;
    expect(innerCallout.data).toMatchObject({ hProperties: { dataCallout: "caution" } });
    expect(tree.children).toHaveLength(1);
  });

  describe("leaves alone", () => {
    const unchanged = (tree: Node) => {
      const before = structuredClone(tree);
      expect(run(tree)).toEqual(before);
    };

    it("a blockquote without a marker", () => {
      unchanged(root(quote(paragraph(text("Just a quote.")))));
    });

    it("an unknown marker, as a plain blockquote", () => {
      unchanged(root(quote(paragraph(text("[!NOTES]\nText")))));
    });

    it("a marker with text after it on the same line", () => {
      unchanged(root(quote(paragraph(text("[!NOTE] Text")))));
    });

    it("a marker that is not at the start of the blockquote", () => {
      unchanged(root(quote(paragraph(text("Intro")), paragraph(text("[!NOTE]\nText")))));
    });

    it("a marker in a code block or a code span", () => {
      unchanged(
        root(
          quote({ type: "code", lang: "md", value: "> [!NOTE]\n> text" }),
          quote(paragraph({ type: "inlineCode", value: "[!NOTE]" }, text(" is the marker"))),
        ),
      );
    });

    it("a marker outside a blockquote", () => {
      unchanged(root(paragraph(text("[!NOTE]\nText"))));
    });

    it("an empty blockquote", () => {
      unchanged(root(quote()));
    });
  });
});

describe("calloutIcon", () => {
  it.each(CALLOUT_KINDS)("draws %s as a 16px svg that takes the color of the text", (kind) => {
    const icon = calloutIcon(kind);
    expect(icon).toMatchObject({
      tagName: "svg",
      properties: { width: "16", height: "16", stroke: "currentColor", viewBox: "0 0 24 24" },
    });
    expect(icon.properties).not.toHaveProperty("class");
    expect(icon.properties).not.toHaveProperty("xmlns");
    expect(icon.properties.strokeWidth).toBe("2");
    expect(icon.children.length).toBeGreaterThan(0);
    for (const shape of icon.children) expect(shape.properties).not.toEqual({});
  });

  it("gives a copy, so one callout cannot change the next", () => {
    calloutIcon("note").children.length = 0;
    expect(calloutIcon("note").children.length).toBeGreaterThan(0);
  });

  it("draws every kind differently", () => {
    const drawn = CALLOUT_KINDS.map((kind) => JSON.stringify(calloutIcon(kind).children));
    expect(new Set(drawn).size).toBe(CALLOUT_KINDS.length);
  });
});
