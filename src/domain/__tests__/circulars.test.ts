import { describe, expect, it } from "vitest";
import { CIRCULARS, circularsFor, circularYear, inProportion, proportionSources } from "../circulars";
import { toCents } from "../money";
import { chartFor } from "../vote-heads";

const sum = (xs: Record<string, number>) => Object.values(xs).reduce((a, x) => a + x, 0);

describe("the circular library", () => {
  // The same reference is reused across terms — MOE.HQs/3/7/33(15) heads four
  // different junior circulars — so a circular is its reference and its date.
  it("holds each circular once", () => {
    const keys = CIRCULARS.map((c) => `${c.ref}|${c.date}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // Every figure was typed from a scan; the totals the Ministry printed catch
  // a dropped digit before a bursar ever sees it.
  it.each(CIRCULARS.flatMap((c) =>
    Object.entries(c.accounts).filter(([, a]) => !a!.totalOnly)
      .map(([type, a]) => [`${c.ref} ${c.date} ${type}`, a!] as const)))(
    "%s adds up to the totals the circular states",
    (_, a) => {
      expect(sum(a.perLearner)).toBe(a.perLearnerTotal);
      expect(sum(a.flat)).toBe(a.flatTotal);
    },
  );

  it("names only vote heads the chart of that level and account has", () => {
    for (const c of CIRCULARS) {
      for (const [type, a] of Object.entries(c.accounts)) {
        const codes = chartFor(c.level, type as never)!.heads.map((h) => h.code);
        for (const code of [...Object.keys(a!.perLearner), ...Object.keys(a!.flat)]) {
          expect(codes, `${c.ref} ${c.date} ${type} ${code}`).toContain(code);
        }
      }
    }
  });

  it("offers a book's circulars newest first", () => {
    const dates = circularsFor("junior", "OPERATIONS").map((c) => c.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(dates.length).toBeGreaterThan(1);
  });

  it("offers nothing where no circular has been given", () => {
    expect(circularsFor("junior", "BOARDING")).toEqual([]);
  });

  // A circular that prints only an account's total, or none at all, is split in
  // the proportions of an earlier one.
  it("offers the earlier circulars with a full split, newest first", () => {
    const sources = proportionSources("primary", "OPERATIONS", "2026-01-22");
    expect(sources[0].date).toBe("2025-09-26");
    expect(sources.every((c) => !c.accounts.OPERATIONS!.totalOnly && c.date < "2026-01-22")).toBe(true);
  });

  it("scales an earlier circular to a new total to the cent, keeping its heads", () => {
    const sep2025 = CIRCULARS.find((c) => c.date === "2025-09-26")!.accounts.OPERATIONS!;
    const scaled = inProportion(sep2025, toCents(312.41));
    expect(sum(scaled.perLearner)).toBe(toCents(312.41));
    expect(scaled.perLearnerTotal).toBe(toCents(312.41));
    expect(Object.keys(scaled.perLearner)).toEqual(Object.keys(sep2025.perLearner));
    for (const [code, rate] of Object.entries(sep2025.perLearner)) {
      const share = (rate * toCents(312.41)) / sep2025.perLearnerTotal;
      expect(Math.abs(scaled.perLearner[code] - share), code).toBeLessThan(1);
    }
  });

  it("gives the rounding cents to the heads with the largest remainders", () => {
    const thirds = inProportion({ perLearner: { A: 1, B: 1, C: 1 }, flat: {}, perLearnerTotal: 3, flatTotal: 0 }, 100);
    expect(Object.values(thirds.perLearner).sort()).toEqual([33, 33, 34]);
  });

  it("holds Term 1 2026 Account 2 as its total only", () => {
    const jan2026 = CIRCULARS.find((c) => c.ref === "MOE/DBE/6/2/3/28" && c.date === "2026-01-22")!;
    expect(jan2026.accounts.OPERATIONS).toMatchObject({ totalOnly: true, perLearnerTotal: toCents(312.41) });
  });

  it("files a circular under the financial year it was issued in", () => {
    expect(circularYear("2025-02-13")).toBe("2024/25");
    expect(circularYear("2025-08-28")).toBe("2025/26");
    expect(circularYear("2025-07-01")).toBe("2025/26");
    expect(circularYear("2025-01")).toBe("2024/25");
  });
});
