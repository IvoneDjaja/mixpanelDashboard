import { fmtSeconds } from "./formatDuration";

describe("fmtSeconds", () => {
  it("formats seconds and minutes", () => {
    expect(fmtSeconds(0)).toBe("0s");
    expect(fmtSeconds(45)).toBe("45s");
    expect(fmtSeconds(65)).toBe("1m 05s");
    expect(fmtSeconds(600)).toBe("10m 00s");
  });
});
