import { codeBlockTransformers } from "../../../template/src/infrastructure";

type Props = Record<string, string | boolean | string[] | undefined>;
interface El {
  type: "element";
  tagName: string;
  properties: Props;
  children: Array<El | { type: "text"; value: string }>;
}

const [transformer] = codeBlockTransformers();
const el = (tagName: string, properties: Props = {}, children: El["children"] = []): El => ({
  type: "element",
  tagName,
  properties,
  children,
});

/** Run the three hooks the way Shiki does for one block, and return the line elements and the root. */
function highlight(code: string, lang: string, raw?: string) {
  const context = { meta: {} as Record<string, unknown>, options: { meta: { __raw: raw } } };
  const cleaned = transformer!.preprocess.call(context, code, { lang }) ?? code;
  const lines = cleaned.split("\n").map(() => el("span", { class: "line" }));
  lines.forEach((line, index) => transformer!.line.call(context, line, index + 1));
  const pre = el("pre", { class: "astro-code" }, [el("code", {}, lines)]);
  const root = transformer!.root.call(context, { type: "root", children: [pre] });
  return { cleaned, lines, root: root!, pre };
}

describe("the code block transformers", () => {
  it("wrap a block with no meta string in a div, with a hidden button and an empty status region", () => {
    const { root, pre } = highlight("a\nb", "ts");
    const block = root.children[0] as El;
    expect(block.tagName).toBe("div");
    expect(block.properties.className).toEqual(["code-block"]);
    expect(block.properties.dataTitled).toBeUndefined();
    const [first, button, status] = block.children as El[];
    expect(first).toBe(pre);
    expect(button).toMatchObject({
      tagName: "button",
      properties: {
        type: "button",
        hidden: true,
        ariaLabel: "Copy code",
        dataCopy: "Copy",
        dataCopied: "Copied",
      },
    });
    expect(status).toMatchObject({
      tagName: "span",
      properties: { role: "status", ariaLive: "polite" },
      children: [],
    });
  });

  it("mark no line of a block with no meta string", () => {
    const { lines } = highlight("a\nb\nc", "ts");
    for (const line of lines) expect(Object.keys(line.properties)).toEqual(["class"]);
  });

  it("put a title in a figcaption of a figure, before the code", () => {
    const { root, pre } = highlight("a", "ts", 'title="src/config.ts"');
    const block = root.children[0] as El;
    expect(block.tagName).toBe("figure");
    expect(block.properties.dataTitled).toBe("");
    const [caption, second] = block.children as El[];
    expect(caption).toMatchObject({
      tagName: "figcaption",
      properties: { className: ["code-title"] },
      children: [{ type: "text", value: "src/config.ts" }],
    });
    expect(second).toBe(pre);
  });

  it("mark the highlighted lines and no others", () => {
    const { lines } = highlight("1\n2\n3\n4\n5", "ts", "{2,4-5}");
    expect(lines.map((line) => "dataHighlighted" in line.properties)).toEqual([
      false,
      true,
      false,
      true,
      true,
    ]);
  });

  it("ignore a highlighted line past the end of the block", () => {
    const { lines } = highlight("1\n2", "ts", "{9}");
    expect(lines.some((line) => "dataHighlighted" in line.properties)).toBe(false);
  });

  it("take the marker comments out of the code, and mark those lines with a drawn sign", () => {
    const { cleaned, lines } = highlight("a // [!code --]\nb // [!code ++]\nc", "ts");
    expect(cleaned).toBe("a\nb\nc");
    expect(lines[0]!.properties).toMatchObject({ dataDiff: "remove", dataSign: "" });
    expect(lines[1]!.properties).toMatchObject({ dataDiff: "add", dataSign: "" });
    expect(lines[2]!.properties.dataDiff).toBeUndefined();
  });

  it("mark the lines of the diff language without a drawn sign, since the sign is in the text", () => {
    const { cleaned, lines } = highlight("+a\n-b\n c", "diff");
    expect(cleaned).toBe("+a\n-b\n c");
    expect(lines[0]!.properties).toMatchObject({ dataDiff: "add" });
    expect(lines[1]!.properties).toMatchObject({ dataDiff: "remove" });
    expect(lines.some((line) => "dataSign" in line.properties)).toBe(false);
  });

  it("can highlight a line that is also added", () => {
    const { lines } = highlight("a // [!code ++]", "ts", "{1}");
    expect(lines[0]!.properties).toMatchObject({ dataHighlighted: "", dataDiff: "add" });
  });

  it("keep the state of one block out of the next", () => {
    highlight("a", "ts", 'title="first" {1}');
    const second = highlight("b", "ts");
    expect((second.root.children[0] as El).tagName).toBe("div");
    expect("dataHighlighted" in second.lines[0]!.properties).toBe(false);
  });

  it("leave a root that is not a pre alone, as the inline code of the markdown package is", () => {
    const context = { meta: {} as Record<string, unknown>, options: {} };
    transformer!.preprocess.call(context, "x", { lang: "ts" });
    const root = { type: "root" as const, children: [el("code")] };
    expect(transformer!.root.call(context, root)).toBeUndefined();
  });
});
