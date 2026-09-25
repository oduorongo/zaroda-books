import { describe, expect, it } from "vitest";
import { statusAfterMessage, closeRefusal } from "../audit-query";

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
