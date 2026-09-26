import { describe, expect, it } from "vitest";
import { readProject, takesProject } from "../projects";

describe("infrastructure projects", () => {
  it("is asked for on the infrastructure account only", () => {
    expect(takesProject("INFRASTRUCTURE")).toBe(true);
    expect(takesProject("OPERATIONS")).toBe(false);
    expect(takesProject("BOARDING")).toBe(false);
  });

  it("requires the project's name", () => {
    expect(readProject("  ", "Approved", "Ongoing")).toEqual({ error: "Name the project this money is for." });
  });

  it("accepts only the listed approvals and statuses", () => {
    expect(readProject("Tiling", "Maybe", "Ongoing")).toHaveProperty("error");
    expect(readProject("Tiling", "Approved", "Half done")).toHaveProperty("error");
    expect(readProject(" Tiling ", "Approved", "Completed"))
      .toEqual({ project: "Tiling", approval: "Approved", status: "Completed" });
  });
});
