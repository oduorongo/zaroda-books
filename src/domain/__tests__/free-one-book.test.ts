import { describe, expect, it } from "vitest";
import { bookEntitlement } from "../subscription";

const args = (over: Partial<Parameters<typeof bookEntitlement>[0]> = {}) => ({
  subscription: undefined,
  freeAllowanceUsed: false,
  orgApproved: true,
  booksAlreadyOpen: 0,
  level: "primary" as const,
  fyLabel: "2025/26",
  schoolId: "school-a",
  ...over,
});

describe("the free grant is one book, not a whole level", () => {
  it("opens the first book free", () => {
    expect(bookEntitlement(args())).toEqual({
      allowed: true, bindTo: "school-a", grantFree: true,
    });
  });

  it("refuses a second book on the free grant", () => {
    // The free school has its one book. Operations alongside tuition is the
    // moment the subscription is worth paying for.
    const d = bookEntitlement(args({
      subscription: { schoolId: "school-a", paidAt: null, isFree: true },
      freeAllowanceUsed: true,
      booksAlreadyOpen: 1,
    }));
    expect(d.allowed).toBe(false);
  });

  it("says the second book needs the subscription, naming the price", () => {
    const d = bookEntitlement(args({
      subscription: { schoolId: "school-a", paidAt: null, isFree: true },
      freeAllowanceUsed: true,
      booksAlreadyOpen: 1,
      level: "senior",
    }));
    if (d.allowed) throw new Error("expected a refusal");
    expect(d.reason).toContain("1,060");
  });

  it("absorbs the free book once the level and year are paid for", () => {
    // Paying covers every account at that level, the free one included: the
    // tenant is not left with one book outside the subscription they bought.
    expect(bookEntitlement(args({
      subscription: { schoolId: "school-a", paidAt: new Date(), isFree: true },
      freeAllowanceUsed: true,
      booksAlreadyOpen: 3,
    }))).toEqual({ allowed: true, bindTo: null, grantFree: false });
  });

  it("lets a paid subscription open any number of books", () => {
    expect(bookEntitlement(args({
      subscription: { schoolId: "school-a", paidAt: new Date(), isFree: false },
      freeAllowanceUsed: true,
      booksAlreadyOpen: 7,
    })).allowed).toBe(true);
  });

  it("lets a subscription entered by hand open books before payment lands", () => {
    expect(bookEntitlement(args({
      subscription: { schoolId: "school-a", paidAt: null, isFree: false },
      freeAllowanceUsed: true,
      booksAlreadyOpen: 2,
    })).allowed).toBe(true);
  });

  it("still refuses a different school on a bound subscription", () => {
    const d = bookEntitlement(args({
      subscription: { schoolId: "school-a", paidAt: new Date(), isFree: false },
      schoolId: "school-b",
      freeAllowanceUsed: true,
    }));
    expect(d.allowed).toBe(false);
  });

  it("grants the allowance once only, across levels", () => {
    expect(bookEntitlement(args({ freeAllowanceUsed: true, level: "junior" })).allowed).toBe(false);
  });
});
