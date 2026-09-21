import { describe, expect, it } from "vitest";
import { resetIsUsable, passwordProblem } from "../password-reset";

const now = new Date("2026-09-21T10:00:00Z");
const inAnHour = new Date("2026-09-21T11:00:00Z");
const anHourAgo = new Date("2026-09-21T09:00:00Z");

describe("resetIsUsable", () => {
  it("accepts a fresh, unused link", () => {
    expect(resetIsUsable({ expiresAt: inAnHour, usedAt: null }, now)).toBe(true);
  });

  it("refuses one that has expired", () => {
    expect(resetIsUsable({ expiresAt: anHourAgo, usedAt: null }, now)).toBe(false);
  });

  it("refuses one already used, however fresh", () => {
    // Single use. A reset link in an inbox is a standing key to the account.
    expect(resetIsUsable({ expiresAt: inAnHour, usedAt: anHourAgo }, now)).toBe(false);
  });

  it("refuses at the exact moment of expiry rather than allowing it", () => {
    expect(resetIsUsable({ expiresAt: now, usedAt: null }, now)).toBe(false);
  });

  it("refuses a missing record", () => {
    expect(resetIsUsable(undefined, now)).toBe(false);
  });
});

describe("passwordProblem", () => {
  it("accepts a password of the required length", () => {
    expect(passwordProblem("a-long-enough-one", "a-long-enough-one")).toBeNull();
  });

  it("refuses one that is too short", () => {
    expect(passwordProblem("short", "short")).toMatch(/10 characters/);
  });

  it("refuses when the two do not match", () => {
    expect(passwordProblem("a-long-enough-one", "a-long-enough-two")).toMatch(/do not match/);
  });

  it("checks the length before the match, so the advice is the useful one", () => {
    expect(passwordProblem("short", "other")).toMatch(/10 characters/);
  });
});
