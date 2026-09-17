import { describe, expect, it } from "vitest";
import { residualHeadCode } from "../capitation";
import { toCents } from "../money";

const rates = [
  { voteHeadCode: "LAB", perLearner: toCents(135) },
  { voteHeadCode: "MFP", perLearner: toCents(740) },
  { voteHeadCode: "STN", perLearner: toCents(662) },
];
const flats = [{ voteHeadCode: "TGR", amount: toCents(696.97) }];
const codes = ["TGR", "LAB", "MFP", "ASS", "STN", "BCH"];

describe("residualHeadCode", () => {
  it("is the largest rate per learner, not the last head in the chart", () => {
    expect(residualHeadCode(rates, flats, codes)).toBe("MFP");
  });

  it("does not drift when a head is added to the end of the chart", () => {
    expect(residualHeadCode(rates, flats, [...codes, "SEC"])).toBe("MFP");
  });

  it("never lands on a flat grant, which must stay at its stated amount", () => {
    expect(residualHeadCode(rates, flats, codes)).not.toBe("TGR");
  });

  it("falls to the largest flat when the circular has no per-learner rate", () => {
    const manyFlats = [
      { voteHeadCode: "TEL", amount: toCents(3620) },
      { voteHeadCode: "PER", amount: toCents(26520) },
    ];
    expect(residualHeadCode([], manyFlats, codes)).toBe("PER");
  });

  it("falls back to the last head when nothing is rated at all", () => {
    expect(residualHeadCode([], [], codes)).toBe("BCH");
  });

  it("is stable when two heads share the largest rate", () => {
    const tied = [
      { voteHeadCode: "AAA", perLearner: toCents(500) },
      { voteHeadCode: "BBB", perLearner: toCents(500) },
    ];
    expect(residualHeadCode(tied, [], ["AAA", "BBB"])).toBe("AAA");
  });
});
