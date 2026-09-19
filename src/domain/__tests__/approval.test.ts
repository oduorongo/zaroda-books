import { describe, expect, it } from "vitest";
import { bookEntitlement } from "../subscription";

const args = (over: Partial<Parameters<typeof bookEntitlement>[0]> = {}) => ({
  subscription: undefined,
  freeAllowanceUsed: false,
  orgApproved: true,
  level: "primary" as const,
  fyLabel: "2025/26",
  schoolId: "school-a",
  ...over,
});

describe("bookEntitlement, before the org is approved", () => {
  it("holds the free school back until the account has been reviewed", () => {
    const d = bookEntitlement(args({ orgApproved: false }));
    expect(d.allowed).toBe(false);
  });

  it("says it is being reviewed rather than refusing outright", () => {
    // Nothing is wrong with the account, so the wording must not read as a fault.
    const d = bookEntitlement(args({ orgApproved: false }));
    if (d.allowed) throw new Error("expected a refusal");
    expect(d.reason).toMatch(/review/i);
  });

  it("grants the free school once approval is given", () => {
    expect(bookEntitlement(args({ orgApproved: true }))).toEqual({
      allowed: true, bindTo: "school-a", grantFree: true,
    });
  });

  it("opens a subscribed book even while unapproved", () => {
    // A subscription row only exists because it was entered by hand after
    // payment, which is approval already. A second gate would strand a payer.
    expect(bookEntitlement(args({
      subscription: { schoolId: null }, orgApproved: false, freeAllowanceUsed: true,
    }))).toEqual({ allowed: true, bindTo: "school-a", grantFree: false });
  });

  it("opens another account on a subscribed school while unapproved", () => {
    expect(bookEntitlement(args({
      subscription: { schoolId: "school-a" }, orgApproved: false,
    }))).toEqual({ allowed: true, bindTo: null, grantFree: false });
  });

  it("still refuses a spent allowance, approved or not", () => {
    // Approval is not a second free school.
    for (const orgApproved of [true, false]) {
      expect(bookEntitlement(args({ freeAllowanceUsed: true, orgApproved })).allowed).toBe(false);
    }
  });

  it("names payment, not review, when the allowance is simply spent", () => {
    const d = bookEntitlement(args({ freeAllowanceUsed: true, orgApproved: true }));
    if (d.allowed) throw new Error("expected a refusal");
    expect(d.reason).toMatch(/subscription/i);
    expect(d.reason).not.toMatch(/review/i);
  });
});
