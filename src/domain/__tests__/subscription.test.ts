import { describe, expect, it } from "vitest";
import { subscriptionDecision } from "../subscription";

describe("subscriptionDecision", () => {
  it("opens the first book of a level and year, and binds the subscription", () => {
    expect(subscriptionDecision(undefined, "school-a")).toEqual({
      allowed: true, bindTo: "school-a",
    });
  });

  it("binds a subscription that was paid for but never used", () => {
    expect(subscriptionDecision({ schoolId: null }, "school-a")).toEqual({
      allowed: true, bindTo: "school-a",
    });
  });

  it("opens another book for the school it is already bound to", () => {
    // One payment covers every book that level needs: tuition, operations, the rest.
    expect(subscriptionDecision({ schoolId: "school-a" }, "school-a")).toEqual({
      allowed: true, bindTo: null,
    });
  });

  it("refuses a different school on the same subscription", () => {
    const d = subscriptionDecision({ schoolId: "school-a" }, "school-b");
    expect(d.allowed).toBe(false);
  });

  it("says why, so the refusal is not a dead end", () => {
    const d = subscriptionDecision({ schoolId: "school-a" }, "school-b");
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toMatch(/another school/i);
  });

  it("stays bound after the books are emptied or archived", () => {
    // The binding is the guard: it survives the data being taken away, so a
    // subscription cannot be freed by copying the figures out and deleting.
    const afterArchiving = { schoolId: "school-a" };
    expect(subscriptionDecision(afterArchiving, "school-b").allowed).toBe(false);
    expect(subscriptionDecision(afterArchiving, "school-a").allowed).toBe(true);
  });
});
