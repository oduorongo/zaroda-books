import { describe, expect, it } from "vitest";
import { ROLES, can, type Action, type Role } from "../permissions";

/** The matrix as agreed, written out again so the test is the specification. */
const EXPECTED: Record<Action, Role[]> = {
  "entry.post": ["owner", "accountant", "bursar"],
  "entry.amend": ["owner", "accountant", "bursar"],
  "entry.delete": ["owner", "accountant"],
  "period.close": ["owner", "accountant"],
  "period.reopen": ["owner"],
  "voteHead.manage": ["owner", "accountant"],
  "openingBalances.set": ["owner", "accountant"],
  "school.edit": ["owner"],
  "financialYear.change": ["owner"],
  "book.archive": ["owner"],
  "book.create": ["owner"],
  "subscription.pay": ["owner"],
  "people.manage": ["owner"],
  "letter.edit": ["owner", "accountant", "bursar"],
  "auditQuery.answer": ["owner", "accountant", "bursar"],
  "book.sendForAudit": ["owner", "accountant"],
};

describe("can", () => {
  it("matches the agreed matrix exactly, for every role and action", () => {
    for (const [action, allowed] of Object.entries(EXPECTED) as [Action, Role[]][]) {
      for (const role of ROLES) {
        expect(
          can(role, action),
          `${role} / ${action}`,
        ).toBe(allowed.includes(role));
      }
    }
  });

  it("lets a viewer do nothing at all", () => {
    // Read is not in the matrix: everyone in the org reads, and reading is
    // gated by tenancy rather than by role.
    for (const action of Object.keys(EXPECTED) as Action[]) {
      expect(can("viewer", action)).toBe(false);
    }
  });

  it("lets an owner do everything", () => {
    for (const action of Object.keys(EXPECTED) as Action[]) {
      expect(can("owner", action)).toBe(true);
    }
  });

  it("stops a bursar deleting an entry, though they may post and amend", () => {
    // Entering the day's takings is the bursar's job; making an entry vanish
    // is not. Amending leaves a trail, deleting removes one.
    expect(can("bursar", "entry.post")).toBe(true);
    expect(can("bursar", "entry.amend")).toBe(true);
    expect(can("bursar", "entry.delete")).toBe(false);
  });

  it("stops a bursar closing or reopening a period", () => {
    expect(can("bursar", "period.close")).toBe(false);
    expect(can("bursar", "period.reopen")).toBe(false);
  });

  it("stops an accountant reopening a closed period", () => {
    // The most audit-sensitive action in the app: the owner alone.
    expect(can("accountant", "period.close")).toBe(true);
    expect(can("accountant", "period.reopen")).toBe(false);
  });

  it("refuses an unknown role rather than defaulting open", () => {
    expect(can("caretaker" as Role, "entry.post")).toBe(false);
  });
});
