import { describe, expect, it } from "vitest";
import { statementCoverageProblem, statementGaps, statementsAuditBlock, uncoveredMonths } from "../bank-statements";

const year = ["2024-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12",
  "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06"];

describe("uncoveredMonths", () => {
  it("is every month when nothing is attached", () => {
    expect(uncoveredMonths(year, [])).toEqual(year);
  });

  it("counts one statement for the whole year as covering every month", () => {
    expect(uncoveredMonths(year, [{ from: "2024-07", to: "2025-06" }])).toEqual([]);
  });

  it("finds the gaps between monthly and quarterly statements", () => {
    expect(uncoveredMonths(year, [
      { from: "2024-07", to: "2024-09" },
      { from: "2024-10", to: "2024-10" },
      { from: "2025-01", to: "2025-06" },
    ])).toEqual(["2024-11", "2024-12"]);
  });
});

describe("statementCoverageProblem", () => {
  it("accepts months in order within the year", () => {
    expect(statementCoverageProblem("2024-07", "2024-09", year)).toBeNull();
    expect(statementCoverageProblem("2025-06", "2025-06", year)).toBeNull();
  });

  it("refuses a range that runs backwards or leaves the year", () => {
    expect(statementCoverageProblem("2024-09", "2024-07", year)).toMatch(/before/i);
    expect(statementCoverageProblem("2024-06", "2024-07", year)).toMatch(/year/i);
  });
});

describe("statementsAuditBlock", () => {
  it("names the months with no statement", () => {
    expect(statementsAuditBlock(["November 2024", "December 2024"]))
      .toMatch(/No bank statement is attached for November 2024, December 2024/);
    expect(statementsAuditBlock([])).toBeNull();
  });
});

describe("statementGaps, which missing statements stop the audit", () => {
  it("requires only the year's last month at the year end", () => {
    expect(statementGaps(["2024-11", "2025-06"], "2025-06", false))
      .toEqual({ required: ["2025-06"], optional: ["2024-11"] });
    expect(statementGaps(["2024-11"], "2025-06", false))
      .toEqual({ required: [], optional: ["2024-11"] });
  });

  it("requires none for a handover audit", () => {
    expect(statementGaps(["2024-11", "2025-06"], "2025-06", true))
      .toEqual({ required: [], optional: ["2024-11", "2025-06"] });
  });
});
