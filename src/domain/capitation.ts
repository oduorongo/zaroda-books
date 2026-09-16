import type { Cents } from "./money";
import type { Allocation } from "./types";

export interface CapitationRate {
  voteHeadCode: string;
  perLearner: Cents; // cents per learner per disbursement
}

/**
 * A flat per-school grant that rides in the same disbursement as the
 * per-learner rates. The junior (FDJSE) basic allocation is one of these.
 */
export interface FlatAllocation {
  voteHeadCode: string;
  amount: Cents;
}

const sumFlats = (flats: FlatAllocation[]) => flats.reduce((a, f) => a + f.amount, 0);

/**
 * Splits a capitation disbursement across vote heads.
 * The rounding residue lands on the largest line so the split equals the
 * disbursed amount to the last cent.
 */
export function allocateCapitation(
  disbursed: Cents,
  enrolment: number,
  rates: CapitationRate[],
  basic?: { voteHeadCode: string },
): Allocation[] {
  if (!Number.isInteger(enrolment) || enrolment <= 0)
    throw new Error("Enrolment must be a whole number of learners.");

  const allocations: Allocation[] = rates.map((r) => ({
    voteHeadCode: r.voteHeadCode,
    amount: Math.round(r.perLearner * enrolment),
  }));

  const rated = allocations.reduce((a, x) => a + x.amount, 0);

  if (basic) {
    // Whatever the rated heads do not consume is the basic / residual vote.
    allocations.push({ voteHeadCode: basic.voteHeadCode, amount: disbursed - rated });
    return allocations.filter((a) => a.amount !== 0);
  }

  if (rated !== disbursed) {
    const biggest = allocations.reduce((a, b) => (b.amount > a.amount ? b : a));
    biggest.amount += disbursed - rated;
  }
  return allocations.filter((a) => a.amount !== 0);
}

/**
 * The school is never told the Ministry's enrolment figure — it derives it
 * from the disbursement and the rates in force. See CLAUDE.md rule 7.
 * Any flat per-school grant comes off first: it buys no learners.
 */
export function deriveEnrolment(
  disbursed: Cents,
  rates: CapitationRate[],
  flats: FlatAllocation[] = [],
): number {
  const rateSum = rates.reduce((a, r) => a + r.perLearner, 0);
  if (rateSum <= 0) return 0;
  const perLearnerPart = disbursed - sumFlats(flats);
  if (perLearnerPart <= 0) return 0;
  return Math.round(perLearnerPart / rateSum);
}

export function allocateCapitationFromAmount(
  disbursed: Cents,
  rates: CapitationRate[],
  basic: { voteHeadCode: string },
  flats: FlatAllocation[] = [],
): { enrolment: number; allocations: Allocation[] } {
  const enrolment = deriveEnrolment(disbursed, rates, flats);
  if (enrolment <= 0 && flats.length === 0) return { enrolment: 0, allocations: [] };

  const flatLines: Allocation[] = flats
    .filter((f) => f.amount !== 0)
    .map((f) => ({ voteHeadCode: f.voteHeadCode, amount: f.amount }));

  // The rated heads split what is left after the flat grants; the residue
  // still falls to the basic head so the whole disbursement is accounted for.
  const rated = enrolment > 0
    ? allocateCapitation(disbursed - sumFlats(flats), enrolment, rates, basic)
    : [{ voteHeadCode: basic.voteHeadCode, amount: disbursed - sumFlats(flats) }];

  const merged: Allocation[] = [];
  for (const line of [...flatLines, ...rated]) {
    const existing = merged.find((m) => m.voteHeadCode === line.voteHeadCode);
    if (existing) existing.amount += line.amount;
    else merged.push({ ...line });
  }
  return { enrolment, allocations: merged.filter((a) => a.amount !== 0) };
}
