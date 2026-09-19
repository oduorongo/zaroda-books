import { describe, expect, it } from "vitest";
import { LEVEL_PRICE, priceLabel, revenue } from "../pricing";

describe("LEVEL_PRICE", () => {
  it("is the published price per level, in cents", () => {
    expect(LEVEL_PRICE.primary).toBe(48_000);
    expect(LEVEL_PRICE.junior).toBe(58_000);
    expect(LEVEL_PRICE.senior).toBe(106_000);
  });
});

describe("revenue", () => {
  it("is nil with nothing sold", () => {
    expect(revenue([])).toEqual({ collected: 0, outstanding: 0, paidCount: 0, unpaidCount: 0, freeCount: 0 });
  });

  it("counts a paid subscription as collected at its level's price", () => {
    expect(revenue([{ level: "senior", paidAt: new Date() }])).toEqual({
      collected: 106_000, outstanding: 0, paidCount: 1, unpaidCount: 0, freeCount: 0,
    });
  });

  it("counts an unpaid subscription as outstanding, never as collected", () => {
    expect(revenue([{ level: "primary", paidAt: null }])).toEqual({
      collected: 0, outstanding: 48_000, paidCount: 0, unpaidCount: 1, freeCount: 0,
    });
  });

  it("prices each level separately rather than at an average", () => {
    const r = revenue([
      { level: "primary", paidAt: new Date() },
      { level: "junior", paidAt: new Date() },
      { level: "senior", paidAt: null },
    ]);
    expect(r.collected).toBe(48_000 + 58_000);
    expect(r.outstanding).toBe(106_000);
    expect(r.paidCount).toBe(2);
    expect(r.unpaidCount).toBe(1);
  });
});

describe("priceLabel", () => {
  it("is whole shillings, because every price is a whole number of them", () => {
    expect(priceLabel("primary")).toBe("480");
  });

  it("groups thousands, so a four figure price is not misread", () => {
    expect(priceLabel("senior")).toBe("1,060");
  });

  it("agrees with the cents the console bills from", () => {
    // The guard on the two ever drifting apart: the label is derived, not typed.
    expect(priceLabel("junior")).toBe("580");
    expect(LEVEL_PRICE.junior).toBe(58_000);
  });
});

describe("revenue, with the free school", () => {
  it("counts a free subscription as neither collected nor owed", () => {
    // It is a gift, not a debt: showing it as outstanding would invent a receivable.
    expect(revenue([{ level: "primary", paidAt: null, isFree: true }])).toEqual({
      collected: 0, outstanding: 0, paidCount: 0, unpaidCount: 0, freeCount: 1,
    });
  });

  it("keeps an unpaid subscription outstanding when it is not the free one", () => {
    expect(revenue([{ level: "primary", paidAt: null, isFree: false }])).toEqual({
      collected: 0, outstanding: 48_000, paidCount: 0, unpaidCount: 1, freeCount: 0,
    });
  });

  it("separates the three on one org", () => {
    const r = revenue([
      { level: "primary", paidAt: null, isFree: true },
      { level: "junior", paidAt: new Date(), isFree: false },
      { level: "senior", paidAt: null, isFree: false },
    ]);
    expect(r).toEqual({
      collected: 58_000, outstanding: 106_000, paidCount: 1, unpaidCount: 1, freeCount: 1,
    });
  });
});
