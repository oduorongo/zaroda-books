import { describe, expect, it } from "vitest";
import { normalisePhoneForTuma, parseTumaCallback } from "../tuma";

describe("normalisePhoneForTuma", () => {
  it("turns the way a number is written in Kenya into the bare form Tuma wants", () => {
    expect(normalisePhoneForTuma("0712345678")).toBe("254712345678");
  });

  it("accepts an already international number", () => {
    expect(normalisePhoneForTuma("254712345678")).toBe("254712345678");
  });

  it("accepts the nine digits without the leading zero", () => {
    expect(normalisePhoneForTuma("712345678")).toBe("254712345678");
  });

  it("accepts a Safaricom 01 number", () => {
    expect(normalisePhoneForTuma("0110123456")).toBe("254110123456");
  });

  it("strips spaces, plus signs and dashes before deciding", () => {
    expect(normalisePhoneForTuma("+254 712 345 678")).toBe("254712345678");
    expect(normalisePhoneForTuma("0712-345-678")).toBe("254712345678");
  });

  it("refuses a number that is not a Kenyan mobile", () => {
    // Returning null rather than a guess: sending an STK push to the wrong
    // phone asks a stranger for money.
    expect(normalisePhoneForTuma("12345")).toBeNull();
    expect(normalisePhoneForTuma("020 123456")).toBeNull();
    expect(normalisePhoneForTuma("")).toBeNull();
  });
});

describe("parseTumaCallback", () => {
  it("reads the snake_case shape", () => {
    expect(parseTumaCallback({
      merchant_request_id: "abc", result_code: 0, mpesa_receipt: "SJ12ABC",
    })).toEqual({ merchantRequestId: "abc", success: true, mpesaReceipt: "SJ12ABC" });
  });

  it("reads the Daraja PascalCase shape", () => {
    expect(parseTumaCallback({
      MerchantRequestID: "abc", ResultCode: 0, MpesaReceiptNumber: "SJ12ABC",
    })).toEqual({ merchantRequestId: "abc", success: true, mpesaReceipt: "SJ12ABC" });
  });

  it("reads a body nested under data", () => {
    expect(parseTumaCallback({
      data: { merchant_request_id: "abc", result_code: 0, mpesa_receipt: "SJ12ABC" },
    })).toEqual({ merchantRequestId: "abc", success: true, mpesaReceipt: "SJ12ABC" });
  });

  it("treats result code 0 as paid whether it arrives as a number or a string", () => {
    expect(parseTumaCallback({ result_code: 0 }).success).toBe(true);
    expect(parseTumaCallback({ result_code: "0" }).success).toBe(true);
  });

  it("treats a worded status as paid", () => {
    expect(parseTumaCallback({ status: "SUCCESS" }).success).toBe(true);
    expect(parseTumaCallback({ status: "completed" }).success).toBe(true);
  });

  it("does not treat a cancelled push as paid", () => {
    // Result code 1032 is the customer cancelling at the PIN prompt.
    expect(parseTumaCallback({ result_code: 1032 }).success).toBe(false);
    expect(parseTumaCallback({ status: "failed" }).success).toBe(false);
  });

  it("defaults to unpaid on a body it cannot read at all", () => {
    // The safe direction: a missed payment is chased, a wrongly credited one
    // is a book that says money arrived when it did not.
    expect(parseTumaCallback({}).success).toBe(false);
    expect(parseTumaCallback(null).success).toBe(false);
    expect(parseTumaCallback("nonsense").success).toBe(false);
  });
});
