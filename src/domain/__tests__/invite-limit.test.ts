import { describe, expect, it } from "vitest";
import { MAX_INVITES_PER_DAY, inviteLimitReached } from "../login-throttle";

describe("inviteLimitReached", () => {
  it("lets a practice invite a day's round of schools", () => {
    expect(inviteLimitReached(0)).toBe(false);
    expect(inviteLimitReached(MAX_INVITES_PER_DAY - 1)).toBe(false);
  });

  it("stops at the cap, so a new account cannot use our mail to reach strangers in bulk", () => {
    expect(inviteLimitReached(MAX_INVITES_PER_DAY)).toBe(true);
    expect(inviteLimitReached(MAX_INVITES_PER_DAY + 5)).toBe(true);
  });
});
