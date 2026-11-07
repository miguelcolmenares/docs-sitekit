import { activeHeadingId } from "../../../template/public/docs-page.js";

const headings = [
  { id: "install", top: -400 },
  { id: "configure", top: 40 },
  { id: "deploy", top: 500 },
];

describe("activeHeadingId", () => {
  it("is the last heading whose top has passed the line", () => {
    expect(activeHeadingId(headings, 76, false)).toBe("configure");
  });

  it("counts a heading exactly at the line, and not one below it", () => {
    expect(
      activeHeadingId(
        [
          { id: "a", top: 76 },
          { id: "b", top: 77 },
        ],
        76,
        false,
      ),
    ).toBe("a");
  });

  it("has no active heading above the first one that has passed the line", () => {
    expect(
      activeHeadingId(
        [
          { id: "a", top: 300 },
          { id: "b", top: 900 },
        ],
        76,
        false,
      ),
    ).toBeUndefined();
    expect(activeHeadingId([], 76, false)).toBeUndefined();
    expect(activeHeadingId([], 76, true)).toBeUndefined();
  });

  it("makes the first heading active when it is the only one that has passed", () => {
    expect(
      activeHeadingId(
        [
          { id: "a", top: 10 },
          { id: "b", top: 300 },
        ],
        76,
        false,
      ),
    ).toBe("a");
  });

  it("makes the last heading active at the bottom, even when it has not reached the line", () => {
    expect(activeHeadingId(headings, 76, true)).toBe("deploy");
    expect(
      activeHeadingId(
        [
          { id: "a", top: 10 },
          { id: "b", top: 700 },
        ],
        76,
        true,
      ),
    ).toBe("b");
  });
});
