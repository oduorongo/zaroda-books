import { describe, expect, it } from "vitest";
import { parseAmount } from "../parse-amount";

describe("parseAmount", () => {
  it("reads a plain figure", () => {
    expect(parseAmount("3500")).toBe(350_000);
  });

  it("reads shillings and cents", () => {
    expect(parseAmount("3500.25")).toBe(350_025);
  });

  it("reads a figure with thousands separators", () => {
    // The form used to accept this and the server refuse it, so a bursar who
    // typed the number the way it is written could not save at all.
    expect(parseAmount("3,500")).toBe(350_000);
    expect(parseAmount("57,892.79")).toBe(5_789_279);
  });

  it("ignores spaces around and inside the figure", () => {
    expect(parseAmount("  3 500.00 ")).toBe(350_000);
  });

  it("ignores a currency prefix", () => {
    expect(parseAmount("KSh 3,500")).toBe(350_000);
    expect(parseAmount("3500/=")).toBe(350_000);
  });

  it("is nothing for an empty box", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
  });

  it("refuses text rather than reading it as zero", () => {
    // Zero would post a payment of nothing and look like success.
    expect(parseAmount("abc")).toBeUndefined();
    expect(parseAmount("3500 shillings")).toBe(350_000);
  });

  it("refuses a figure with two decimal points", () => {
    expect(parseAmount("35.0.0")).toBeUndefined();
  });

  it("refuses a negative", () => {
    // A payment cannot be negative; a minus sign is a typing slip.
    expect(parseAmount("-3500")).toBeUndefined();
  });

  it("rounds to the cent rather than carrying a fraction of one", () => {
    expect(parseAmount("0.015")).toBe(2);
  });
});
