import { describeLastChange } from "../../../template/src/domain";

describe("describeLastChange", () => {
  it("reads the date git prints, as a machine-readable value and a readable text", () => {
    expect(describeLastChange("2026-10-30T14:05:09-05:00")).toEqual({
      datetime: "2026-10-30",
      text: "30 October 2026",
    });
  });

  it("keeps the day of the commit itself, whatever the offset", () => {
    expect(describeLastChange("2026-03-01T23:30:00-08:00")?.datetime).toBe("2026-03-01");
    expect(describeLastChange("2026-03-01T00:30:00+09:00")?.datetime).toBe("2026-03-01");
  });

  it("writes the month as a word and the day without a leading zero", () => {
    expect(describeLastChange("2026-01-05T10:00:00Z")?.text).toBe("5 January 2026");
    expect(describeLastChange("2026-12-31T10:00:00Z")?.text).toBe("31 December 2026");
  });

  it("accepts a plain date", () => {
    expect(describeLastChange("2026-02-28")?.text).toBe("28 February 2026");
  });

  it.each(["", "   ", "yesterday", "2026-13-01T00:00:00Z", "2026-02-31T00:00:00Z", "26-01-01"])(
    "returns nothing for %j",
    (value) => {
      expect(describeLastChange(value)).toBeUndefined();
    },
  );

  it("returns nothing for nothing", () => {
    expect(describeLastChange(undefined)).toBeUndefined();
  });
});
