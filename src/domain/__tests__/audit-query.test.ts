import { describe, expect, it } from "vitest";
import { statusAfterMessage, closeRefusal, queryPartyFor, reminderDue } from "../audit-query";

describe("an audit query's status", () => {
  it("is answered once the school replies", () => {
    expect(statusAfterMessage("open", "school")).toEqual({ status: "answered" });
  });

  it("goes back to the school as open when the auditor replies again", () => {
    expect(statusAfterMessage("answered", "auditor")).toEqual({ status: "open" });
  });

  it("stays open while the auditor adds to a query the school has not answered", () => {
    expect(statusAfterMessage("open", "auditor")).toEqual({ status: "open" });
  });

  // A closed query is the record of what the audit settled; adding to it
  // afterwards would rewrite that record.
  it("takes no more messages once closed", () => {
    expect(statusAfterMessage("closed", "school").error).toMatch(/closed/);
    expect(statusAfterMessage("closed", "auditor").error).toMatch(/closed/);
  });
});

describe("closing an audit query", () => {
  it("is allowed while it is open or answered", () => {
    expect(closeRefusal("open")).toBeNull();
    expect(closeRefusal("answered")).toBeNull();
  });

  it("is refused once it is already closed", () => {
    expect(closeRefusal("closed")).toMatch(/already closed/);
  });
});

describe("a query addressed to the head of institution", () => {
  it("is answered only when the head replies", () => {
    expect(statusAfterMessage("open", "hoi", "hoi")).toEqual({ status: "answered" });
  });

  it("stays the head's turn when the bookkeeper adds information", () => {
    expect(statusAfterMessage("open", "school", "hoi")).toEqual({ status: "open" });
    expect(statusAfterMessage("answered", "school", "hoi")).toEqual({ status: "answered" });
  });

  it("goes back to the head when the auditor replies", () => {
    expect(statusAfterMessage("answered", "auditor", "hoi")).toEqual({ status: "open" });
  });
});

describe("queryPartyFor, which side a signed-in person answers on", () => {
  it("puts the head on the head's side of a query addressed to them", () => {
    expect(queryPartyFor({ role: "authoriser", position: "hoi" }, "hoi")).toBe("hoi");
    expect(queryPartyFor({ role: "owner", position: "hoi" }, "hoi")).toBe("hoi");
  });

  it("keeps the bookkeeper on the school's side, even on the head's queries", () => {
    expect(queryPartyFor({ role: "owner", position: "freelancer" }, "hoi")).toBe("school");
    expect(queryPartyFor({ role: "bursar", position: "bursar" }, "school")).toBe("school");
  });

  it("lets a head who keeps their own books answer the school's queries too", () => {
    expect(queryPartyFor({ role: "owner", position: "hoi" }, "school")).toBe("school");
  });

  it("leaves an authoriser out of the bookkeeper's queries, and a viewer out of all", () => {
    expect(queryPartyFor({ role: "authoriser", position: "hoi" }, "school")).toBeNull();
    expect(queryPartyFor({ role: "viewer", position: null }, "hoi")).toBeNull();
  });
});

describe("reminderDue", () => {
  const day = 86_400_000;
  const now = new Date("2026-10-10T06:00:00Z");

  it("reminds after seven quiet days", () => {
    expect(reminderDue({ lastActivity: new Date(+now - 7 * day), remindedAt: null, now })).toBe(true);
    expect(reminderDue({ lastActivity: new Date(+now - 6 * day), remindedAt: null, now })).toBe(false);
  });

  it("waits another seven days after a reminder", () => {
    const lastActivity = new Date(+now - 20 * day);
    expect(reminderDue({ lastActivity, remindedAt: new Date(+now - 3 * day), now })).toBe(false);
    expect(reminderDue({ lastActivity, remindedAt: new Date(+now - 7 * day), now })).toBe(true);
  });
});
