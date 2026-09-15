import type { Cents } from "./money";
import type { Allocation } from "./types";

export interface CapitationRate {
  voteHeadCode: string;
  perLearner: Cents; // cents per learner per disbursement
}

/**
 * Splits a capitation disbursement across vote heads.
 * Enrolment is a stored number — never derived by dividing the total by a rate.
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
