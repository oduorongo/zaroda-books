import { describe, expect, it } from "vitest";
import { COUNTIES, SUB_COUNTIES, isCounty, subCountiesOf, isSubCountyOf } from "../counties";

describe("COUNTIES", () => {
  it("is the 47 counties of the Constitution", () => {
    expect(COUNTIES).toHaveLength(47);
  });

  it("names no county twice", () => {
    expect(new Set(COUNTIES).size).toBe(47);
  });

  it("gives every county at least one sub-county", () => {
    // A county with an empty list would leave the second dropdown unusable.
    for (const c of COUNTIES) expect(subCountiesOf(c).length).toBeGreaterThan(0);
  });

  it("lists sub-counties only under counties that exist", () => {
    for (const c of Object.keys(SUB_COUNTIES)) expect(COUNTIES).toContain(c);
  });

  it("names no sub-county twice within a county", () => {
    for (const c of COUNTIES) {
      const subs = subCountiesOf(c);
      expect(new Set(subs).size).toBe(subs.length);
    }
  });
});

describe("validation", () => {
  it("accepts a county on the list", () => {
    expect(isCounty("Kisumu")).toBe(true);
  });

  it("refuses anything not on the list, whatever the form posted", () => {
    expect(isCounty("Atlantis")).toBe(false);
    expect(isCounty("")).toBe(false);
  });

  it("accepts a sub-county under its own county", () => {
    expect(isSubCountyOf("Kisumu", "Seme")).toBe(true);
  });

  it("refuses a real sub-county under the wrong county", () => {
    // The pair has to hold together, or coverage figures are quietly wrong.
    expect(isSubCountyOf("Mombasa", "Seme")).toBe(false);
  });

  it("refuses a sub-county under a county that does not exist", () => {
    expect(isSubCountyOf("Atlantis", "Seme")).toBe(false);
  });
});
