import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The M-Pesa callback: the one route that credits money.
 *
 * It is unauthenticated of necessity — Tuma calls it server to server — so
 * what keeps it safe is that the body carries no instruction. The amount, the
 * level and the year all come from the row written when the push went out;
 * the body only says which payment it refers to. These tests hold that line,
 * and hold the parsing that a real bug already slipped through once.
 */

const findPaymentByMerchantRequest = vi.fn();
const markPaymentSucceeded = vi.fn();
const markPaymentFailed = vi.fn();

const recordProblem = vi.fn();

vi.mock("@/server/billing", () => ({
  findPaymentByMerchantRequest,
  markPaymentSucceeded,
  markPaymentFailed,
}));
vi.mock("@/server/problems", () => ({ recordProblem }));

const { POST } = await import("@/app/api/tuma/callback/route");

const post = (body: unknown) =>
  POST(new Request("https://zarodabooks.com/api/tuma/callback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));

beforeEach(() => {
  vi.clearAllMocks();
  findPaymentByMerchantRequest.mockResolvedValue({ id: "pay1" });
});

describe("a completed payment", () => {
  // Captured from Tuma's sandbox, 20 September 2026.
  const completed = {
    status: "completed",
    merchant_request_id: "aeab-4ded-a7a1-f42beaf3219456123271",
    result_code: 0,
    mpesa_receipt_number: "UIKPD71IKJ",
    amount: 1,
  };

  it("credits the payment it names", async () => {
    await post(completed);
    expect(markPaymentSucceeded).toHaveBeenCalledWith("pay1", "UIKPD71IKJ", completed);
    expect(markPaymentFailed).not.toHaveBeenCalled();
  });

  it("passes on the M-Pesa receipt number", async () => {
    // The field is mpesa_receipt_number. Reading the wrong name recorded a
    // successful payment with no receipt at all — the evidence money arrived.
    await post(completed);
    expect(markPaymentSucceeded.mock.calls[0][1]).toBe("UIKPD71IKJ");
  });

  it("keeps the whole body, so a misread can be recovered from", async () => {
    await post(completed);
    expect(markPaymentSucceeded.mock.calls[0][2]).toEqual(completed);
  });
});

describe("a payment that did not complete", () => {
  it("does not credit a prompt the customer ignored", async () => {
    await post({ status: "failed", merchant_request_id: "m1", result_code: 1038 });
    expect(markPaymentFailed).toHaveBeenCalledWith("pay1", expect.anything());
    expect(markPaymentSucceeded).not.toHaveBeenCalled();
  });

  it("does not credit a prompt the customer cancelled", async () => {
    await post({ status: "cancelled", merchant_request_id: "m1", result_code: 1032 });
    expect(markPaymentSucceeded).not.toHaveBeenCalled();
  });
});

describe("bodies it cannot make sense of", () => {
  it("credits nothing when no payment is named", async () => {
    await post({ status: "completed", result_code: 0 });
    expect(findPaymentByMerchantRequest).not.toHaveBeenCalled();
    expect(markPaymentSucceeded).not.toHaveBeenCalled();
  });

  it("records a problem when no payment is named, rather than dropping it", async () => {
    await post({ status: "completed", result_code: 0 });
    expect(recordProblem).toHaveBeenCalledWith(
      expect.objectContaining({ area: "payment" }),
    );
  });

  it("records a problem when the payment is unknown to us", async () => {
    findPaymentByMerchantRequest.mockResolvedValue(undefined);
    await post({ status: "completed", result_code: 0, merchant_request_id: "never-seen" });
    expect(recordProblem).toHaveBeenCalledWith(
      expect.objectContaining({ area: "payment" }),
    );
  });

  it("credits nothing when the payment is unknown to us", async () => {
    findPaymentByMerchantRequest.mockResolvedValue(undefined);
    await post({ status: "completed", result_code: 0, merchant_request_id: "never-seen" });
    expect(markPaymentSucceeded).not.toHaveBeenCalled();
  });

  it("treats an unreadable body as not paid", async () => {
    await post({ nonsense: true, merchant_request_id: "m1" });
    expect(markPaymentSucceeded).not.toHaveBeenCalled();
    expect(markPaymentFailed).toHaveBeenCalled();
  });

  it("answers 200 even then, so the gateway does not retry for ever", async () => {
    const res = await post({ nothing: "useful" });
    expect(res.status).toBe(200);
  });
});
