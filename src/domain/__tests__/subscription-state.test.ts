import { describe, expect, it } from "vitest";
import { subscriptionStateFor } from "../subscription";

describe("subscriptionStateFor", () => {
  it("records the date when marking paid", () => {
    const s = subscriptionStateFor("paid", { isFree: false });
    expect(s.paidAt).toBeInstanceOf(Date);
    expect(s.isFree).toBe(false);
  });

  it("keeps the free mark when a free book is marked paid", () => {
    // isFree is the record that the org's one allowance was spent here.
    // Clearing it on payment would quietly hand them a second free book.
    const s = subscriptionStateFor("paid", { isFree: true });
    expect(s.paidAt).toBeInstanceOf(Date);
    expect(s.isFree).toBe(true);
  });

  it("clears the payment date when marking unpaid, and the free mark with it", () => {
    // Unpaid means owed. A row that is owed is not the free one.
    expect(subscriptionStateFor("unpaid", { isFree: true }))
      .toEqual({ paidAt: null, isFree: false });
  });

  it("grants the free mark and owes nothing when marking free", () => {
    expect(subscriptionStateFor("free", { isFree: false }))
      .toEqual({ paidAt: null, isFree: true });
  });
});
