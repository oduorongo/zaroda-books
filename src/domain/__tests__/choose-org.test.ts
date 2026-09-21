import { describe, expect, it } from "vitest";
import { chooseMembership } from "../choose-org";

const m = (orgId: string, createdAt: string) => ({
  id: `mem-${orgId}`,
  orgId,
  role: "owner" as const,
  schoolId: null,
  createdAt: new Date(createdAt),
});

const own = m("own", "2026-01-01");
const school = m("school", "2026-06-01");

describe("chooseMembership", () => {
  it("is nothing when the person belongs nowhere", () => {
    expect(chooseMembership([], "anything")).toBeUndefined();
  });

  it("takes the only one when there is only one", () => {
    expect(chooseMembership([own], undefined)?.orgId).toBe("own");
  });

  it("takes the one asked for", () => {
    expect(chooseMembership([own, school], "school")?.orgId).toBe("school");
  });

  it("ignores a request for books they do not belong to", () => {
    // The cookie is not a grant. Asking for somebody else's org gets you
    // your own, not theirs.
    expect(chooseMembership([own, school], "someone-elses")?.orgId).toBe("own");
  });

  it("falls back to the oldest, so the answer is the same every time", () => {
    // Without an order, two page loads could land in different orgs.
    expect(chooseMembership([school, own], undefined)?.orgId).toBe("own");
  });

  it("falls back the same way whatever order the database returns", () => {
    expect(chooseMembership([own, school], undefined)?.orgId).toBe("own");
    expect(chooseMembership([school, own], undefined)?.orgId).toBe("own");
  });
});
