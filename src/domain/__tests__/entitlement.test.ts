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

describe("bookEntitlement", () => {
  it("opens the very first book free, and says it is spending the allowance", () => {
    expect(bookEntitlement(args())).toEqual({
      allowed: true, bindTo: "school-a", grantFree: true,
    });
  });

  it("refuses a level and year with no subscription once the allowance is spent", () => {
    const d = bookEntitlement(args({ freeAllowanceUsed: true }));
    expect(d.allowed).toBe(false);
  });

  it("names the level, the year and the price, so the refusal can be acted on", () => {
    const d = bookEntitlement(args({ freeAllowanceUsed: true, level: "senior", fyLabel: "2026/27" }));
    if (d.allowed) throw new Error("expected a refusal");
    expect(d.reason).toContain("senior");
    expect(d.reason).toContain("2026/27");
    expect(d.reason).toContain("1,060");
  });

  it("opens a book against a subscription that was paid for but never used", () => {
    expect(bookEntitlement(args({
      subscription: { schoolId: null }, freeAllowanceUsed: true,
    }))).toEqual({ allowed: true, bindTo: "school-a", grantFree: false });
  });

  it("opens another account for the school the subscription is already bound to", () => {
    // One payment covers every account that level needs, free or paid alike.
    expect(bookEntitlement(args({
      subscription: { schoolId: "school-a" }, freeAllowanceUsed: true,
    }))).toEqual({ allowed: true, bindTo: null, grantFree: false });
  });

  it("opens a second account on the free school without a second grant", () => {
    // The free school is a whole school, not one book: its other accounts follow.
    expect(bookEntitlement(args({
      subscription: { schoolId: "school-a" }, freeAllowanceUsed: true,
    }))).toEqual({ allowed: true, bindTo: null, grantFree: false });
  });

  it("still refuses a different school on a bound subscription", () => {
    const d = bookEntitlement(args({
      subscription: { schoolId: "school-a" }, schoolId: "school-b", freeAllowanceUsed: true,
    }));
    expect(d.allowed).toBe(false);
  });

  it("grants the allowance only once, however many levels are tried", () => {
    // Spending it on primary must not leave a second one for junior.
    const first = bookEntitlement(args({ level: "primary" }));
    expect(first).toEqual({ allowed: true, bindTo: "school-a", grantFree: true });
    const second = bookEntitlement(args({ level: "junior", freeAllowanceUsed: true }));
    expect(second.allowed).toBe(false);
  });

  it("refuses a later year even for the school that held the free one", () => {
    // The grant is one school for one financial year, not that school for ever.
    const d = bookEntitlement(args({ fyLabel: "2026/27", freeAllowanceUsed: true }));
    expect(d.allowed).toBe(false);
  });
});
