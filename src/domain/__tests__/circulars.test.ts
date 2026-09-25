import { describe, expect, it } from "vitest";
import { CIRCULARS, circularsFor } from "../circulars";
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
    Object.entries(c.accounts).map(([type, a]) => [`${c.ref} ${c.date} ${type}`, a!] as const)))(
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
});
