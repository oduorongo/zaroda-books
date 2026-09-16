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
