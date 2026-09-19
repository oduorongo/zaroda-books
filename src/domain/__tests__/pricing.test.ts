import { describe, expect, it } from "vitest";
import { LEVEL_PRICE, revenue } from "../pricing";

describe("LEVEL_PRICE", () => {
  it("is the published price per level, in cents", () => {
    expect(LEVEL_PRICE.primary).toBe(48_000);
    expect(LEVEL_PRICE.junior).toBe(58_000);
    expect(LEVEL_PRICE.senior).toBe(106_000);
  });
});

describe("revenue", () => {
  it("is nil with nothing sold", () => {
    expect(revenue([])).toEqual({ collected: 0, outstanding: 0, paidCount: 0, unpaidCount: 0 });
  });

  it("counts a paid subscription as collected at its level's price", () => {
    expect(revenue([{ level: "senior", paidAt: new Date() }])).toEqual({
      collected: 106_000, outstanding: 0, paidCount: 1, unpaidCount: 0,
    });
  });

  it("counts an unpaid subscription as outstanding, never as collected", () => {
    expect(revenue([{ level: "primary", paidAt: null }])).toEqual({
      collected: 0, outstanding: 48_000, paidCount: 0, unpaidCount: 1,
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
