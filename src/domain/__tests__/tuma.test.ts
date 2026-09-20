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

/**
 * Bodies captured from Tuma's sandbox on 20 September 2026 — the first real
 * callbacks this code ever received, copied verbatim. Guesswork above, fact here.
 */
describe("parseTumaCallback, against real Tuma bodies", () => {
  it("reads the receipt from a completed payment", () => {
    expect(parseTumaCallback({
      status: "completed",
      merchant_request_id: "aeab-4ded-a7a1-f42beaf3219456123271",
      checkout_request_id: "ws_CO_20092026044414807724282065",
      result_code: 0,
      result_desc: "The service request is processed successfully.",
      timestamp: "2026-09-20 04:44:26",
      mpesa_receipt_number: "UIKPD71IKJ",
      amount: 1,
    })).toEqual({
      merchantRequestId: "aeab-4ded-a7a1-f42beaf3219456123271",
      success: true,
      mpesaReceipt: "UIKPD71IKJ",
    });
  });

  it("does not credit a prompt the customer never answered", () => {
    // 1038, seen live: the PIN screen lapsed.
    expect(parseTumaCallback({
      status: "failed",
      merchant_request_id: "cbc7-4eb6-8033-e874ef3eaa9660688712",
      result_code: 1038,
      result_desc: "No response from user.",
      failure_reason: "No response from user.",
    })).toEqual({
      merchantRequestId: "cbc7-4eb6-8033-e874ef3eaa9660688712",
      success: false,
      mpesaReceipt: undefined,
    });
  });

  it("does not credit a prompt the customer cancelled", () => {
    // 1032, seen live: cancelled at the PIN screen.
    expect(parseTumaCallback({
      status: "cancelled",
      merchant_request_id: "e2de-4827-be47-3be09950b86130718694",
      result_code: 1032,
      result_desc: "Request Cancelled by user.",
      failure_reason: "Transaction cancelled by user",
    }).success).toBe(false);
  });
});
