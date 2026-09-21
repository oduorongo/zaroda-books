import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The recorder's one job beyond recording: never make things worse.
 *
 * It is called from inside a payment callback and from the email client. If
 * it threw when the database was unreachable, a minor failure would become
 * the larger one — a payment left uncredited because logging it failed.
 */

const values = vi.fn();
const insert = vi.fn(() => ({ values }));

vi.mock("@/db", () => ({
  db: { insert },
  schema: { problems: {} },
}));

const { recordProblem } = await import("@/server/problems");

beforeEach(() => {
  vi.clearAllMocks();
  values.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("recordProblem", () => {
  it("writes the area, message and tenant", async () => {
    await recordProblem({ area: "payment", message: "Something failed.", orgId: "org1" });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      area: "payment",
      message: "Something failed.",
      orgId: "org1",
    }));
  });

  it("does not throw when the database is unreachable", async () => {
    values.mockRejectedValue(new Error("connection refused"));
    await expect(
      recordProblem({ area: "payment", message: "Something failed." }),
    ).resolves.toBeUndefined();
  });

  it("still says it on the console, so it is findable before anyone opens the page", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await recordProblem({ area: "email", message: "Undeliverable." });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("[email] Undeliverable."), "");
  });

  it("turns an Error into something readable rather than an empty object", async () => {
    await recordProblem({ area: "book", message: "m", detail: new Error("name clash") });
    expect(values.mock.calls[0][0].detail).toBe("Error: name clash");
  });

  it("keeps a plain object as JSON", async () => {
    await recordProblem({ area: "payment", message: "m", detail: { result_code: 1032 } });
    expect(values.mock.calls[0][0].detail).toBe('{"result_code":1032}');
  });

  it("survives detail that cannot be turned into JSON", async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await expect(
      recordProblem({ area: "payment", message: "m", detail: circular }),
    ).resolves.toBeUndefined();
  });

  it("trims a very long message rather than failing the insert", async () => {
    await recordProblem({ area: "email", message: "x".repeat(900) });
    expect(values.mock.calls[0][0].message.length).toBe(500);
  });

  it("records no tenant when there is none", async () => {
    await recordProblem({ area: "gateway", message: "m" });
    expect(values.mock.calls[0][0].orgId).toBeNull();
  });
});
