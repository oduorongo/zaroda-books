import { describe, expect, it } from "vitest";
import { financialYearInProgress, financialYearLabels, previousFinancialYear } from "../financial-year";

describe("financialYearInProgress", () => {
  it("is the year that opened in July, once July has come", () => {
    expect(financialYearInProgress(new Date("2026-09-18T00:00:00Z"))).toBe(2026);
  });

  it("opens on 1 July", () => {
    expect(financialYearInProgress(new Date("2026-07-01T00:00:00Z"))).toBe(2026);
  });

  it("is still the previous year in June, before the new one opens", () => {
    expect(financialYearInProgress(new Date("2026-06-30T00:00:00Z"))).toBe(2025);
  });

  it("is the previous year in January, halfway through", () => {
    expect(financialYearInProgress(new Date("2026-01-15T00:00:00Z"))).toBe(2025);
  });
});

describe("financialYearLabels", () => {
  it("runs from the year in progress back to the earliest, newest first", () => {
    expect(financialYearLabels(2026, 2022)).toEqual([
      "2026/27", "2025/26", "2024/25", "2023/24", "2022/23",
    ]);
  });

  it("pads the second year to two digits across a century", () => {
    expect(financialYearLabels(2099, 2099)).toEqual(["2099/00"]);
  });

  it("gives just the one year when they are the same", () => {
    expect(financialYearLabels(2022, 2022)).toEqual(["2022/23"]);
  });

  it("gives nothing when the earliest is after the year in progress", () => {
    expect(financialYearLabels(2021, 2022)).toEqual([]);
  });
});

describe("previousFinancialYear", () => {
  it("names the year a balance is brought forward from", () => {
    expect(previousFinancialYear("2025/26")).toBe("2024/25");
  });

  it("steps back across a century boundary without breaking the two digits", () => {
    expect(previousFinancialYear("2100/01")).toBe("2099/00");
    expect(previousFinancialYear("2001/02")).toBe("2000/01");
  });

  it("pads the second half to two figures", () => {
    // "2009/10" back one is "2008/09", not "2008/9".
    expect(previousFinancialYear("2009/10")).toBe("2008/09");
  });

  it("gives nothing for a label it cannot read, rather than a wrong year", () => {
    // A heading naming the wrong year is worse than one naming none.
    expect(previousFinancialYear("")).toBeNull();
    expect(previousFinancialYear("not a year")).toBeNull();
  });
});
