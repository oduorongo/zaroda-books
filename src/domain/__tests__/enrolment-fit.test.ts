import { describe, expect, it } from "vitest";
import { enrolmentFit } from "../capitation";
import { toCents } from "../money";

// The rates AMOSO's tuition book holds, and the T3 disbursement it received.
const rates = [
  { voteHeadCode: "LAB", perLearner: toCents(81) },
  { voteHeadCode: "MFP", perLearner: toCents(144) },
  { voteHeadCode: "ASS", perLearner: toCents(77.64) },
  { voteHeadCode: "STN", perLearner: toCents(200) },
];
const flats = [{ voteHeadCode: "TGR", amount: toCents(696.97) }];

describe("enrolmentFit", () => {
  it("fits exactly when the money agrees with the rates", () => {
    const disbursed = toCents(502.64) * 126 + toCents(696.97);
    expect(enrolmentFit(disbursed, rates, flats)).toEqual({
      exact: 126, learners: 126, difference: 0,
    });
  });

  it("reports how far short a disbursement falls", () => {
    const fit = enrolmentFit(toCents(63967), rates, flats);
    expect(fit.learners).toBe(126);
    expect(fit.difference).toBe(toCents(-62.61));
  });

  it("gives the unrounded learners, which is what shows the mismatch", () => {
    const fit = enrolmentFit(toCents(63967), rates, flats);
    expect(fit.exact).toBeCloseTo(125.8755, 3);
  });

  it("reports an excess as a positive difference", () => {
    const disbursed = toCents(502.64) * 126 + toCents(696.97) + toCents(100);
    expect(enrolmentFit(disbursed, rates, flats).difference).toBe(toCents(100));
  });

  it("a flat-only grant fits when it equals the flats", () => {
    expect(enrolmentFit(toCents(696.97), [], flats)).toEqual({
      exact: 0, learners: 0, difference: 0,
    });
  });

  it("a flat-only grant reports the difference when it does not", () => {
    expect(enrolmentFit(toCents(700), [], flats).difference).toBe(toCents(3.03));
  });
});
