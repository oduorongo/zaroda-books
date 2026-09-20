import { describe, expect, it } from "vitest";
import { SCHOOL_LEVELS, accountTypesFor, isCapitationAccount } from "../vote-heads";

describe("isCapitationAccount", () => {
  it("is true for the accounts the Ministry disburses to", () => {
    expect(isCapitationAccount("primary", "TUITION")).toBe(true);
    expect(isCapitationAccount("junior", "TUITION")).toBe(true);
    expect(isCapitationAccount("senior", "OPERATIONS")).toBe(true);
  });

  it("is false for the accounts parents pay into", () => {
    // No circular sets a rate per learner for these, so there is no enrolment
    // to derive and nothing to acknowledge to the Ministry.
    expect(isCapitationAccount("senior", "BOARDING")).toBe(false);
    expect(isCapitationAccount("primary", "LUNCH")).toBe(false);
  });

  it("is false for infrastructure, funded by transfer rather than by head", () => {
    expect(isCapitationAccount("senior", "INFRASTRUCTURE")).toBe(false);
  });

  it("is false for an account that does not exist at that level", () => {
    expect(isCapitationAccount("primary", "NONSENSE" as never)).toBe(false);
  });

  it("agrees with the chart it is derived from, at every level", () => {
    // The rule is not a second list to keep in step: an account is capitation
    // funded exactly when one of its heads carries a rate.
    for (const level of SCHOOL_LEVELS) {
      for (const a of accountTypesFor(level)) {
        const rated = a.heads.some((h) => h.perLearner || h.flat);
        expect(isCapitationAccount(level, a.id)).toBe(rated);
      }
    }
  });
});
