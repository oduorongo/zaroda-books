import { describe, expect, it } from "vitest";
import { closedThrough, handoverCutoff, readHandover } from "../handover";

it("needs a name, TSC number, reason and date", () => {
  expect(readHandover("", "123", "retirement", "2026-06-30")).toHaveProperty("error");
  expect(readHandover("A. Head", " ", "retirement", "2026-06-30")).toHaveProperty("error");
  expect(readHandover("A. Head", "123", "sacked", "2026-06-30")).toHaveProperty("error");
  expect(readHandover("A. Head", "123", "transfer", "")).toHaveProperty("error");
  expect(readHandover(" A. Head ", "123", "transfer", "2026-06-30"))
    .toEqual({ officer: "A. Head", tscNo: "123", reason: "transfer", handoverDate: "2026-06-30" });
});

describe("handover audit", () => {
  const periods = ["2025-07-01", "2025-08-01", "2025-09-01", "2025-10-01", "2025-11-01"]
    .map((month, i) => ({ month, status: (i < 4 ? "closed" : "open") as "open" | "closed" }));

  it("runs to the end of the month the head hands over in", () => {
    expect(handoverCutoff("2025-10-14", periods)).toBe("2025-10");
  });

  it("is not offered for a handover outside this book's year", () => {
    expect(handoverCutoff("2025-03-02", periods)).toBeNull();
  });

  it("can be sent once every month up to the handover is closed", () => {
    expect(closedThrough(periods, "2025-10")).toBe(true);
    expect(closedThrough(periods, "2025-11")).toBe(false);
  });
});
