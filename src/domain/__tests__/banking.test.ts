import { describe, expect, it } from "vitest";
import { bankingContraFor } from "../banking";
import { toCents } from "../money";

const receipt = {
  date: "2026-07-14",
  receiptNo: "R-1042",
  particulars: "FDJSE term 1 capitation",
  cash: toCents(38216.97),
  bank: 0,
};

describe("bankingContraFor", () => {
  it("moves the whole receipt from cash to bank", () => {
    const c = bankingContraFor(receipt, "2026-07-16");
    expect(c.kind).toBe("contra");
    expect(c.from).toBe("cash");
    expect(c.to).toBe("bank");
    expect(c.amount).toBe(toCents(38216.97));
  });

  it("banks on the date given, not the date of the receipt", () => {
    expect(bankingContraFor(receipt, "2026-07-16").date).toBe("2026-07-16");
  });

  it("names the receipt it banks, so the cash book reads as a pair", () => {
    expect(bankingContraFor(receipt, "2026-07-16").particulars).toBe("Banking — R-1042");
  });

  it("falls back to the particulars when there is no receipt number", () => {
    const { receiptNo: _drop, ...noNumber } = receipt;
    expect(bankingContraFor(noNumber, "2026-07-16").particulars)
      .toBe("Banking — FDJSE term 1 capitation");
  });

  it("banks cash and bank together, so a part-banked receipt still reconciles", () => {
    const split = { ...receipt, cash: toCents(1000), bank: toCents(500) };
    expect(bankingContraFor(split, "2026-07-16").amount).toBe(toCents(1500));
  });

  it("refuses to bank nothing", () => {
    expect(() => bankingContraFor({ ...receipt, cash: 0, bank: 0 }, "2026-07-16"))
      .toThrow(/nothing to bank/i);
  });
});
