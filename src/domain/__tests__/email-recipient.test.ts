import { describe, expect, it } from "vitest";
import { resolveRecipient } from "../email-recipient";

describe("resolveRecipient", () => {
  it("sends to the intended person when no override is set", () => {
    expect(resolveRecipient("bursar@school.ac.ke", undefined)).toEqual({
      to: "bursar@school.ac.ke",
      redirectedFrom: null,
    });
  });

  it("ignores a blank override rather than sending nowhere", () => {
    expect(resolveRecipient("bursar@school.ac.ke", "   ").to).toBe("bursar@school.ac.ke");
  });

  it("ignores an override that is not an address", () => {
    // A typo in an environment variable must not silently swallow the mail.
    expect(resolveRecipient("bursar@school.ac.ke", "not-an-address").to)
      .toBe("bursar@school.ac.ke");
  });

  it("diverts to the override when one is set", () => {
    expect(resolveRecipient("bursar@school.ac.ke", "oduorongo@gmail.com")).toEqual({
      to: "oduorongo@gmail.com",
      redirectedFrom: "bursar@school.ac.ke",
    });
  });

  it("reports who it was meant for, so the message can say so", () => {
    // Without this, a diverted password reset looks like your own.
    const { redirectedFrom } = resolveRecipient("head@school.ac.ke", "oduorongo@gmail.com");
    expect(redirectedFrom).toBe("head@school.ac.ke");
  });

  it("does not call it a diversion when the override is the intended person", () => {
    expect(resolveRecipient("oduorongo@gmail.com", "oduorongo@gmail.com")).toEqual({
      to: "oduorongo@gmail.com",
      redirectedFrom: null,
    });
  });

  it("compares addresses without regard to case or spacing", () => {
    expect(resolveRecipient(" Oduorongo@Gmail.com ", "oduorongo@gmail.com").redirectedFrom)
      .toBeNull();
  });
});
