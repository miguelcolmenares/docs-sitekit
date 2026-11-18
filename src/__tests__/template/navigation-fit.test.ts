import { shouldMeasureNavigation } from "../../../template/src/presentation/components/site/navigation-fit";

describe("inline navigation measurements", () => {
  it("measures the first compact render, then ignores resize notifications caused by hiding its contents", () => {
    expect(shouldMeasureNavigation(false, false, 782, -1)).toBe(true);
    expect(shouldMeasureNavigation(false, false, 782, 782)).toBe(false);
    expect(shouldMeasureNavigation(false, false, 390, 782)).toBe(false);
  });

  it("retries a collapsed row when it grows, or when text or font metrics changed at the same width", () => {
    expect(shouldMeasureNavigation(false, false, 1024, 782)).toBe(true);
    expect(shouldMeasureNavigation(false, true, 782, 782)).toBe(true);
    expect(shouldMeasureNavigation(false, true, 390, 782)).toBe(true);
  });

  it("checks an inline row on every size notification so a shrinking row cannot retain clipped links", () => {
    expect(shouldMeasureNavigation(true, false, 782, 1440)).toBe(true);
    expect(shouldMeasureNavigation(true, false, 1440, 1440)).toBe(true);
  });
});
