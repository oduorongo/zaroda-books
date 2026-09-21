import { describe, expect, it } from "vitest";
import { bookEntitlement } from "../subscription";

const args = (over: Partial<Parameters<typeof bookEntitlement>[0]> = {}) => ({
  subscription: undefined,
  freeAllowanceUsed: false,
  booksAlreadyOpen: 0,
  orgApproved: true,
  level: "primary" as const,
  fyLabel: "2025/26",
  schoolId: "school-a",
  ...over,
});

describe("bookEntitlement, when the books are on hold", () => {
  it("refuses a book while the account is on hold", () => {
    const d = bookEntitlement(args({ orgApproved: false }));
    expect(d.allowed).toBe(false);
  });

  it("says the books are on hold, and how to reach us", () => {
    // Accounts are approved on creation now, so this only happens when Zaroda
    // has deliberately suspended one. The wording has to say so.
    const d = bookEntitlement(args({ orgApproved: false }));
    if (d.allowed) throw new Error("expected a refusal");
    expect(d.reason).toMatch(/on hold/i);
    expect(d.reason).toMatch(/0781 230 805/);
  });

  it("grants the free school once the hold is lifted", () => {
    expect(bookEntitlement(args({ orgApproved: true }))).toEqual({
      allowed: true, bindTo: "school-a", grantFree: true,
    });
  });

  it("opens a subscribed book even while on hold", () => {
    // A subscription row only exists because it was entered by hand after
    // payment, which is approval already. A second gate would strand a payer.
    expect(bookEntitlement(args({
      subscription: { schoolId: null, paidAt: null, isFree: false }, orgApproved: false, freeAllowanceUsed: true,
    }))).toEqual({ allowed: true, bindTo: "school-a", grantFree: false });
  });

  it("opens another account on a subscribed school while on hold", () => {
    expect(bookEntitlement(args({
      subscription: { schoolId: "school-a", paidAt: null, isFree: false }, orgApproved: false,
    }))).toEqual({ allowed: true, bindTo: null, grantFree: false });
  });

  it("still refuses a spent allowance, on hold or not", () => {
    // Approval is not a second free school.
    for (const orgApproved of [true, false]) {
      expect(bookEntitlement(args({ freeAllowanceUsed: true, orgApproved })).allowed).toBe(false);
    }
  });

  it("names payment, not the hold, when the allowance is simply spent", () => {
    const d = bookEntitlement(args({ freeAllowanceUsed: true, orgApproved: true }));
    if (d.allowed) throw new Error("expected a refusal");
    expect(d.reason).toMatch(/subscription/i);
    expect(d.reason).not.toMatch(/on hold/i);
  });
});
