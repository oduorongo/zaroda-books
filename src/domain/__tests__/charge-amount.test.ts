import { describe, expect, it } from "vitest";
import { chargeAmount } from "../pricing";

describe("chargeAmount", () => {
  it("charges the real price when there is no override", () => {
    expect(chargeAmount(48_000, undefined)).toEqual({ cents: 48_000, isTest: false });
  });

  it("charges the override instead, in cents, when one is set", () => {
    // Tuma's sandbox refuses anything from KES 100 up, so a real price of 480
    // cannot be tested at all without this.
    expect(chargeAmount(48_000, "1")).toEqual({ cents: 100, isTest: true });
  });

  it("ignores an override that is not a positive number", () => {
    for (const bad of ["", "0", "-5", "abc", "  "]) {
      expect(chargeAmount(48_000, bad)).toEqual({ cents: 48_000, isTest: false });
    }
  });

  it("records what was actually charged, never the list price", () => {
    // Storing 480 for a shilling taken would put money in the books that
    // never arrived — the one thing the books must never say.
    const { cents } = chargeAmount(106_000, "1");
    expect(cents).toBe(100);
  });

  it("allows a whole-shilling override above one", () => {
    expect(chargeAmount(48_000, "50")).toEqual({ cents: 5_000, isTest: true });
  });

  it("rounds a fractional override to the cent", () => {
    expect(chargeAmount(48_000, "1.5")).toEqual({ cents: 150, isTest: true });
  });
});
