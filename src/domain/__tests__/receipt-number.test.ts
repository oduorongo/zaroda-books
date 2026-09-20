import { describe, expect, it } from "vitest";
import { subscriptionReceiptNo } from "../pricing";

describe("subscriptionReceiptNo", () => {
  it("numbers the first receipt of a financial year 0001", () => {
    expect(subscriptionReceiptNo("2025/26", 0)).toBe("ZB/2025-26/0001");
  });

  it("counts on from what has already been issued", () => {
    expect(subscriptionReceiptNo("2025/26", 41)).toBe("ZB/2025-26/0042");
  });

  it("carries the financial year, so two years never collide", () => {
    expect(subscriptionReceiptNo("2026/27", 0)).toBe("ZB/2026-27/0001");
    expect(subscriptionReceiptNo("2025/26", 0)).not.toBe(subscriptionReceiptNo("2026/27", 0));
  });

  it("pads to four figures and then keeps going", () => {
    expect(subscriptionReceiptNo("2025/26", 998)).toBe("ZB/2025-26/0999");
    expect(subscriptionReceiptNo("2025/26", 9999)).toBe("ZB/2025-26/10000");
  });

  it("uses no slash inside the year, so the whole thing reads as one reference", () => {
    expect(subscriptionReceiptNo("2025/26", 0).split("/")).toHaveLength(3);
  });
});
