import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "../dates";

describe("formatDate", () => {
  it("shows a stored date as dd/mm/yyyy", () => {
    expect(formatDate("2025-10-04")).toBe("04/10/2025");
  });

  it("shows a moment as the date in Nairobi, not UTC", () => {
    // 22:30 UTC on 31 October is already 1 November in Nairobi.
    expect(formatDate(new Date("2025-10-31T22:30:00Z"))).toBe("01/11/2025");
  });

  it("is blank for no date", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate(null)).toBe("");
  });
});

describe("formatDateTime", () => {
  it("adds the Nairobi time to the date", () => {
    expect(formatDateTime(new Date("2025-10-31T22:30:00Z"))).toBe("01/11/2025 01:30");
  });
});
