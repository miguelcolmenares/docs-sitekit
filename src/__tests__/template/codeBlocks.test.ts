import {
  isHighlighted,
  parseCodeMeta,
  readDiffLanguage,
  readDiffMarkers,
} from "../../../template/src/domain";

describe("parseCodeMeta", () => {
  it("reads a title in double quotes", () => {
    expect(parseCodeMeta('title="src/config.ts"')).toEqual({
      title: "src/config.ts",
      highlighted: [],
    });
  });

  it("reads a title in single quotes, and one that holds the other quote", () => {
    expect(parseCodeMeta("title='a.ts'").title).toBe("a.ts");
    expect(parseCodeMeta(`title="it's here"`).title).toBe("it's here");
    expect(parseCodeMeta(`title='say "hi"'`).title).toBe('say "hi"');
  });

  it("keeps spaces inside the title and trims the edges", () => {
    expect(parseCodeMeta('title="  my file.ts "').title).toBe("my file.ts");
  });

  it("has no title when it is empty or missing", () => {
    expect(parseCodeMeta('title=""').title).toBeNull();
    expect(parseCodeMeta('title="   "').title).toBeNull();
    expect(parseCodeMeta("{1}").title).toBeNull();
    expect(parseCodeMeta(undefined).title).toBeNull();
    expect(parseCodeMeta(null).title).toBeNull();
    expect(parseCodeMeta("").title).toBeNull();
  });

  it("does not read a word that only ends in title as a title", () => {
    expect(parseCodeMeta('subtitle="x"').title).toBeNull();
  });

  it("reads single lines and ranges", () => {
    expect(parseCodeMeta("{2,4-6}").highlighted).toEqual([
      [2, 2],
      [4, 6],
    ]);
  });

  it("allows spaces inside the braces", () => {
    expect(parseCodeMeta("{ 1 , 3 - 4 }").highlighted).toEqual([
      [1, 1],
      [3, 4],
    ]);
  });

  it("reads the lines and the title in either order", () => {
    const expected = { title: "a.ts", highlighted: [[2, 3]] };
    expect(parseCodeMeta('title="a.ts" {2-3}')).toEqual(expected);
    expect(parseCodeMeta('{2-3} title="a.ts"')).toEqual(expected);
  });

  it("does not read braces inside the title as lines", () => {
    expect(parseCodeMeta('title="{1,2}.ts"')).toEqual({ title: "{1,2}.ts", highlighted: [] });
  });

  it("ignores a part that is not a valid range (zero, backwards, empty), and keeps the valid ones", () => {
    expect(parseCodeMeta("{0,2,5-3,,7}").highlighted).toEqual([
      [2, 2],
      [7, 7],
    ]);
  });

  it("ignores braces that hold anything but line numbers, even one letter", () => {
    expect(parseCodeMeta("{1,abc}").highlighted).toEqual([]);
    expect(parseCodeMeta("{foo: 1}").highlighted).toEqual([]);
    expect(parseCodeMeta("{}").highlighted).toEqual([]);
  });

  it("reads more than one group of braces", () => {
    expect(parseCodeMeta("{1} {3}").highlighted).toEqual([
      [1, 1],
      [3, 3],
    ]);
  });

  it("does not expand a huge range into a list", () => {
    expect(parseCodeMeta("{1-999999999}").highlighted).toEqual([[1, 999999999]]);
  });
});

describe("isHighlighted", () => {
  const ranges = [
    [2, 2],
    [4, 6],
  ] as const;

  it("is true inside a range, including both ends", () => {
    expect([2, 4, 5, 6].map((line) => isHighlighted(ranges, line))).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it("is false outside every range", () => {
    expect([1, 3, 7].map((line) => isHighlighted(ranges, line))).toEqual([false, false, false]);
  });
});

describe("readDiffMarkers", () => {
  it("takes the marker comment out and records the kind of the line", () => {
    const read = readDiffMarkers("a\nb // [!code --]\nc // [!code ++]\nd");
    expect(read.code).toBe("a\nb\nc\nd");
    expect(read.marks).toEqual([null, "remove", "add", null]);
  });

  it.each([
    ["const x = 1; // [!code ++]", "const x = 1;"],
    ["const x = 1; //[!code ++]", "const x = 1;"],
    ["x = 1  # [!code ++]", "x = 1"],
    ["SELECT 1; -- [!code ++]", "SELECT 1;"],
    ["a { color: red } /* [!code ++] */", "a { color: red }"],
    ["<p>hi</p> <!-- [!code ++] -->", "<p>hi</p>"],
    ["x ; [!code ++]", "x"],
  ])("reads the comment style of %j", (line, code) => {
    expect(readDiffMarkers(line)).toEqual({ code, marks: ["add"] });
  });

  it("leaves a marker that is not at the end of the line", () => {
    const code = "// [!code ++] and then more";
    expect(readDiffMarkers(code)).toEqual({ code, marks: [null] });
  });

  it("returns the code unchanged when no line has a marker", () => {
    const code = "a\r\nb\n\nc";
    expect(readDiffMarkers(code)).toEqual({ code, marks: [null, null, null, null] });
  });

  it("keeps a marked blank comment line as an empty line, so the numbers still match", () => {
    const read = readDiffMarkers("a\n// [!code ++]\nb");
    expect(read.code).toBe("a\n\nb");
    expect(read.marks).toEqual([null, "add", null]);
  });

  it("reads Windows line ends", () => {
    const read = readDiffMarkers("a // [!code ++]\r\nb");
    expect(read.code).toBe("a\nb");
    expect(read.marks).toEqual(["add", null]);
  });

  it("does not read another word in the brackets", () => {
    expect(readDiffMarkers("a // [!code highlight]").marks).toEqual([null]);
  });
});

describe("readDiffLanguage", () => {
  it("reads plus as added, minus as removed, and anything else as neither", () => {
    expect(readDiffLanguage("+a\n-b\n c\n\nd")).toEqual(["add", "remove", null, null, null]);
  });

  it("leaves the file header lines of a unified diff plain when a hunk follows", () => {
    const diff = "--- a/f\n+++ b/f\n@@ -1 +1 @@\n-old\n+new";
    expect(readDiffLanguage(diff)).toEqual([null, null, null, "remove", "add"]);
  });

  it("reads a line that starts with two dashes as removed when there is no hunk header", () => {
    expect(readDiffLanguage("--- a comment\n+new")).toEqual(["remove", "add"]);
  });

  it("reads dashes after the hunk header as changes", () => {
    expect(readDiffLanguage("@@ -1 +1 @@\n--- a comment")).toEqual([null, "remove"]);
  });
});
