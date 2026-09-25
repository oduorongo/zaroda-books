import { describe, expect, it } from "vitest";
import { monthsToClose, monthsToReopen, yearClosed } from "../period-order";

const months = (...statuses: ("open" | "closed")[]) =>
  statuses.map((status, i) => ({ month: `2024-${String(7 + i).padStart(2, "0")}-01`, status }));

describe("monthsToClose", () => {
  // Schools reconcile at the year end, not every month: closing June takes
  // every month before it that is still open.
  it("takes every open month up to and including the one asked for", () => {
    expect(monthsToClose(months("closed", "open", "open", "open"), "2024-09-01"))
      .toEqual({ months: ["2024-08-01", "2024-09-01"] });
  });

  it("is just the month when everything before it is closed", () => {
    expect(monthsToClose(months("closed", "open"), "2024-08-01")).toEqual({ months: ["2024-08-01"] });
  });

  it("refuses a month already closed", () => {
    expect(monthsToClose(months("closed"), "2024-07-01").error).toMatch(/already closed/);
  });
});

describe("monthsToReopen", () => {
  it("takes the month asked for and every closed month after it, latest first", () => {
    expect(monthsToReopen(months("closed", "closed", "closed", "open"), "2024-08-01"))
      .toEqual({ months: ["2024-09-01", "2024-08-01"] });
  });

  it("refuses a month that is open", () => {
    expect(monthsToReopen(months("open"), "2024-07-01").error).toMatch(/not closed/);
  });
});

describe("yearClosed", () => {
  it("is true once the last month of the year is closed", () => {
    expect(yearClosed(months("closed", "closed", "closed"))).toBe(true);
  });

  it("is false while the last month is open", () => {
    expect(yearClosed(months("closed", "closed", "open"))).toBe(false);
  });
});
