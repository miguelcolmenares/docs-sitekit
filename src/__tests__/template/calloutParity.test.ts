import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CALLOUT_KINDS, CALLOUT_LABELS } from "../../../template/src/domain";

const SRC = join(__dirname, "..", "..", "..", "template", "src");
const read = (path: string) => readFileSync(join(SRC, path), "utf8");

// A callout written in markdown and the Callout component must look the same, but they are written in
// two places: the component in Tailwind classes, the markdown one in prose.css. These tests keep them together.
describe("the markdown callouts and the Callout component say the same thing", () => {
  const component = read("presentation/components/site/Callout.tsx");
  const css = read("styles/prose.css");

  it.each(CALLOUT_KINDS)("the component has the kind %s with the same label", (kind) => {
    expect(component).toMatch(new RegExp(`\\b${kind}: \\{[^}]*label: "${CALLOUT_LABELS[kind]}"`));
  });

  it("the component is a note, not an alert", () => {
    expect(component).toMatch(/role="note"/);
    expect(component).not.toMatch(/role="(alert|status)"|aria-live/);
  });

  it.each(CALLOUT_KINDS.filter((kind) => kind !== "note"))("prose.css gives %s a tone", (kind) => {
    expect(css).toMatch(
      new RegExp(`\\.prose-site \\.callout-${kind} \\{\\s*--callout-tone: var\\(--sk-`),
    );
  });

  it("every tone of the markdown callouts is a color token, never a literal color", () => {
    const block = css.slice(css.indexOf("Callouts written as"));
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsl/i);
    const tones = [...block.matchAll(/--callout-tone: var\(--sk-([a-z-]+)\)/g)].map((m) => m[1]);
    expect(tones.sort()).toEqual(["accent", "danger", "fg-bright", "success", "warn"]);
  });

  it("the markdown tones are the ones of the component", () => {
    const pairs: Record<string, [string, string]> = {
      note: ["accent", "text-brand"],
      tip: ["success", "text-success"],
      important: ["fg-bright", "text-fg-bright"],
      warning: ["warn", "text-warn"],
      caution: ["danger", "text-destructive"],
    };
    for (const kind of CALLOUT_KINDS) {
      const [token, utility] = pairs[kind]!;
      const rule =
        kind === "note"
          ? /\.prose-site \.callout \{\s*--callout-tone: var\(--sk-([a-z-]+)\)/.exec(css)
          : new RegExp(`\\.callout-${kind} \\{\\s*--callout-tone: var\\(--sk-([a-z-]+)\\)`).exec(
              css,
            );
      expect(rule?.[1]).toBe(token);
      expect(component).toMatch(new RegExp(`${kind}: \\{[^}]*tone: "${utility}"`));
    }
  });
});
