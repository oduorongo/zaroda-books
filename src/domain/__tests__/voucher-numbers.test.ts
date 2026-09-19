import { describe, expect, it } from "vitest";
import { renumbering, sequenceVouchers } from "../voucher-numbers";

const p = (id: string, date: string, enteredAt: string, vrNo?: string) =>
  ({ id, date, enteredAt, vrNo });

describe("sequenceVouchers", () => {
  it("numbers the first payment of the financial year 1", () => {
    expect(sequenceVouchers([p("a", "2025-07-04", "1")])).toEqual([{ id: "a", vrNo: "1" }]);
  });

  it("numbers by date, not by the order they were entered", () => {
    // The September payment found in December still belongs before October.
    const out = sequenceVouchers([
      p("oct", "2025-10-02", "1"),
      p("sep", "2025-09-15", "3"),
    ]);
    expect(out).toEqual([{ id: "sep", vrNo: "1" }, { id: "oct", vrNo: "2" }]);
  });

  it("breaks a same-day tie by which was entered first", () => {
    // Two payments on one day need a stable order, or the numbers churn on
    // every save with nothing having changed.
    const out = sequenceVouchers([
      p("second", "2025-07-04", "2"),
      p("first", "2025-07-04", "1"),
    ]);
    expect(out).toEqual([{ id: "first", vrNo: "1" }, { id: "second", vrNo: "2" }]);
  });

  it("runs unbroken across the whole year, not restarting each month", () => {
    const out = sequenceVouchers([
      p("a", "2025-07-04", "1"),
      p("b", "2025-08-11", "2"),
      p("c", "2026-06-30", "3"),
    ]);
    expect(out.map((x) => x.vrNo)).toEqual(["1", "2", "3"]);
  });

  it("returns every voucher, so the caller can see the whole sequence", () => {
    const out = sequenceVouchers([p("a", "2025-07-04", "1", "1")]);
    expect(out).toHaveLength(1);
  });

  it("is empty for a year with no payments", () => {
    expect(sequenceVouchers([])).toEqual([]);
  });
});

describe("renumbering", () => {
  it("reports only the vouchers whose number actually moves", () => {
    // Rewriting a number to the value it already holds is a pointless write
    // and a misleading audit entry.
    const out = renumbering([
      p("a", "2025-07-04", "1", "1"),
      p("b", "2025-08-11", "2", "9"),
    ]);
    expect(out).toEqual([{ id: "b", from: "9", to: "2" }]);
  });

  it("is empty when the sequence already holds", () => {
    expect(renumbering([
      p("a", "2025-07-04", "1", "1"),
      p("b", "2025-08-11", "2", "2"),
    ])).toEqual([]);
  });

  it("treats a voucher with no number yet as a change", () => {
    expect(renumbering([p("a", "2025-07-04", "1")])).toEqual([
      { id: "a", from: null, to: "1" },
    ]);
  });
});
