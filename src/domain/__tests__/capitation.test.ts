import { describe, expect, it } from "vitest";
import { deriveEnrolment, allocateCapitationFromAmount } from "../capitation";
import { toCents } from "../money";
import { chartFor } from "../vote-heads";

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
    { voteHeadCode: "TEL", amount: toCents(3620) },
    { voteHeadCode: "EWC", amount: toCents(2880) },
    { voteHeadCode: "INT", amount: toCents(4500) },
    { voteHeadCode: "PER", amount: toCents(26520) },
  ];
  const flatTotal = toCents(37520);
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
    expect(allocations.find((a) => a.voteHeadCode === "PER")?.amount).toBe(toCents(26520));
    expect(allocations.find((a) => a.voteHeadCode === "EWC")?.amount).toBe(toCents(2880));
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

// FDJSE Table 1A "Breakdown per School" puts teachers' guides and reference
// materials in the basic per-school allocation, not on a per-learner rate.
// It is tuition money, so it must ride in the tuition account's chart.
describe("junior tuition flat", () => {
  const tuition = chartFor("junior", "TUITION")!;
  const rates = tuition.heads
    .filter((h) => h.perLearner)
    .map((h) => ({ voteHeadCode: h.code, perLearner: h.perLearner! }));
  const flats = tuition.heads
    .filter((h) => h.flat)
    .map((h) => ({ voteHeadCode: h.code, amount: h.flat! }));

  it("carries the teachers' guides grant as a flat, not a rate", () => {
    const tgr = tuition.heads.find((h) => h.code === "TGR");
    expect(tgr?.flat).toBe(toCents(696.97));
    expect(tgr?.perLearner).toBeUndefined();
  });

  it("derives enrolment only after the flat comes off", () => {
    const disbursed = toCents(1746.38) * 412 + toCents(696.97);
    expect(deriveEnrolment(disbursed, rates, flats)).toBe(412);
  });

  it("posts the flat to TGR and reconciles to the disbursement", () => {
    const disbursed = toCents(1746.38) * 412 + toCents(696.97);
    const { allocations } = allocateCapitationFromAmount(
      disbursed, rates, { voteHeadCode: "BCH" }, flats,
    );
    expect(allocations.find((a) => a.voteHeadCode === "TGR")?.amount).toBe(toCents(696.97));
    expect(allocations.reduce((a, x) => a + x.amount, 0)).toBe(disbursed);
  });
});

it("the junior charts carry Table 1A's KSh 38,216.97 per school", () => {
  const flats = (["TUITION", "OPERATIONS"] as const)
    .flatMap((t) => chartFor("junior", t)!.heads)
    .reduce((a, h) => a + (h.flat ?? 0), 0);
  expect(flats).toBe(toCents(38216.97));
});
