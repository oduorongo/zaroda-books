import { describe, expect, it } from "vitest";
import { deriveEnrolment, allocateCapitationFromAmount } from "../capitation";
import { toCents } from "../money";

describe("deriveEnrolment", () => {
  it("divides the disbursement by the sum of the rates", () => {
    const rates = [
      { voteHeadCode: "TXB", perLearner: toCents(235) },
      { voteHeadCode: "EXB", perLearner: toCents(160) },
    ];
    expect(deriveEnrolment(toCents(395 * 20), rates)).toBe(20);
  });

  it("rounds to the nearest whole learner", () => {
    const rates = [{ voteHeadCode: "TXB", perLearner: toCents(235) }];
    expect(deriveEnrolment(toCents(235 * 20 + 100), rates)).toBe(20);
  });

  it("ignores heads with no rate set", () => {
    const rates = [
      { voteHeadCode: "TXB", perLearner: toCents(235) },
      { voteHeadCode: "BCH", perLearner: 0 },
    ];
    expect(deriveEnrolment(toCents(235 * 10), rates)).toBe(10);
  });

  it("returns 0 when the rates sum to 0", () => {
    expect(deriveEnrolment(toCents(1000), [])).toBe(0);
  });
});

describe("allocateCapitationFromAmount", () => {
  it("derives enrolment, splits per rate, and puts the residue on the basic head", () => {
    const rates = [
      { voteHeadCode: "TXB", perLearner: toCents(235) },
      { voteHeadCode: "EXB", perLearner: toCents(160) },
    ];
    const disbursed = toCents(395 * 20);
    const { enrolment, allocations } = allocateCapitationFromAmount(disbursed, rates, {
      voteHeadCode: "BCH",
    });
    expect(enrolment).toBe(20);
    const total = allocations.reduce((a, x) => a + x.amount, 0);
    expect(total).toBe(disbursed);
  });

  it("puts a non-zero residue on the basic head when the amount does not divide evenly", () => {
    const rates = [{ voteHeadCode: "TXB", perLearner: toCents(235) }];
    const disbursed = toCents(235 * 20 + 100);
    const { enrolment, allocations } = allocateCapitationFromAmount(disbursed, rates, {
      voteHeadCode: "BCH",
    });
    expect(enrolment).toBe(20);
    const bch = allocations.find((a) => a.voteHeadCode === "BCH");
    expect(bch?.amount).toBe(toCents(100));
  });
});

// The junior (FDJSE) circular disburses a per-learner rate AND a flat
// per-school basic allocation in one figure. The flat part must come off
// before the enrolment is derived, or the enrolment is badly inflated.
describe("flat basic allocations", () => {
  const rates = [
    { voteHeadCode: "RMI", perLearner: toCents(1000) },
    { voteHeadCode: "ADM", perLearner: toCents(275) },
    { voteHeadCode: "ACT", perLearner: toCents(240) },
    { voteHeadCode: "LTT", perLearner: toCents(400) },
    { voteHeadCode: "MED", perLearner: toCents(61) },
  ];
  const flats = [
    { voteHeadCode: "TEL", amount: toCents(58416.37) },
    { voteHeadCode: "EWC", amount: toCents(4647.49) },
    { voteHeadCode: "INT", amount: toCents(11667.14) },
    { voteHeadCode: "PER", amount: toCents(199713) },
  ];
  const flatTotal = toCents(274444);
  const perLearner = toCents(1976);

  it("subtracts the flat grant before deriving enrolment", () => {
    const disbursed = perLearner * 412 + flatTotal;
    expect(deriveEnrolment(disbursed, rates, flats)).toBe(412);
  });

  it("would inflate the enrolment if the flat grant were not subtracted", () => {
    const disbursed = perLearner * 412 + flatTotal;
    expect(deriveEnrolment(disbursed, rates)).toBeGreaterThan(412);
  });

  it("pays each flat head its stated amount and reconciles to the disbursement", () => {
    const disbursed = perLearner * 412 + flatTotal;
    const { enrolment, allocations } = allocateCapitationFromAmount(
      disbursed, rates, { voteHeadCode: "BCH" }, flats,
    );
    expect(enrolment).toBe(412);
    expect(allocations.find((a) => a.voteHeadCode === "PER")?.amount).toBe(toCents(199713));
    expect(allocations.find((a) => a.voteHeadCode === "EWC")?.amount).toBe(toCents(4647.49));
    expect(allocations.reduce((a, x) => a + x.amount, 0)).toBe(disbursed);
  });

  it("derives 0 rather than dividing by zero when the grant is flat only", () => {
    expect(deriveEnrolment(flatTotal, [], flats)).toBe(0);
  });

  it("still allocates a flat-only grant, with the residue on the basic head", () => {
    const { enrolment, allocations } = allocateCapitationFromAmount(
      flatTotal, [], { voteHeadCode: "BCH" }, flats,
    );
    expect(enrolment).toBe(0);
    expect(allocations.reduce((a, x) => a + x.amount, 0)).toBe(flatTotal);
  });

  it("derives 0 when the flat grant exceeds the amount received", () => {
    expect(deriveEnrolment(toCents(1000), rates, flats)).toBe(0);
  });
});
