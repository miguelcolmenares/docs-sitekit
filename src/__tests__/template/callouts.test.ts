import { CALLOUT_KINDS, CALLOUT_LABELS, parseCalloutMarker } from "../../../template/src/domain";

describe("parseCalloutMarker", () => {
  it.each(CALLOUT_KINDS)("reads [!%s] alone on its line", (kind) => {
    expect(parseCalloutMarker(`[!${kind.toUpperCase()}]\nText.`)).toEqual({ kind, rest: "Text." });
  });

  it("is not case sensitive", () => {
    expect(parseCalloutMarker("[!Warning]\nText")?.kind).toBe("warning");
    expect(parseCalloutMarker("[!tip]")?.kind).toBe("tip");
  });

  it("leaves nothing when the marker is the whole text", () => {
    expect(parseCalloutMarker("[!NOTE]")).toEqual({ kind: "note", rest: "" });
  });

  it("allows spaces after the marker and Windows line ends", () => {
    expect(parseCalloutMarker("[!NOTE]  \r\nText")).toEqual({ kind: "note", rest: "Text" });
  });

  it.each(["[!NOTES]\nText", "[!INFO]\nText", "[!]\nText", "[!NOTE 1]\nText"])(
    "does not read %j: the name is not one of the five",
    (text) => {
      expect(parseCalloutMarker(text)).toBeNull();
    },
  );

  it("does not read a marker with text after it on the same line", () => {
    expect(parseCalloutMarker("[!NOTE] A title\nText")).toBeNull();
  });

  it("does not read a marker that is not at the start", () => {
    expect(parseCalloutMarker("Text [!NOTE]\nmore")).toBeNull();
    expect(parseCalloutMarker(" [!NOTE]\nmore")).toBeNull();
  });

  it("has a label for every kind", () => {
    expect(Object.keys(CALLOUT_LABELS).sort()).toEqual([...CALLOUT_KINDS].sort());
    expect(CALLOUT_LABELS.important).toBe("Important");
  });
});
