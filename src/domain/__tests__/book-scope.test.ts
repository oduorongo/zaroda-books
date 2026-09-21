import { describe, expect, it } from "vitest";
import { scopeAllows, describeScope, type BookScope } from "../book-scope";

const manyonge = { id: "s1", county: "Kisumu", subCounty: "Kisumu East" };
const amoso = { id: "s2", county: "Migori", subCounty: "Rongo" };

describe("scopeAllows", () => {
  it("lets an org-wide member reach every school", () => {
    const scope: BookScope = { kind: "org" };
    expect(scopeAllows(scope, manyonge)).toBe(true);
    expect(scopeAllows(scope, amoso)).toBe(true);
  });

  it("holds a school-scoped member to their own school", () => {
    // The freelancer case: Manyonge's bursar must not reach Amoso's books.
    const scope: BookScope = { kind: "school", schoolId: "s1" };
    expect(scopeAllows(scope, manyonge)).toBe(true);
    expect(scopeAllows(scope, amoso)).toBe(false);
  });

  it("holds an auditor to their area", () => {
    const scope: BookScope = { kind: "area", county: "Kisumu", subCounty: "Kisumu East" };
    expect(scopeAllows(scope, manyonge)).toBe(true);
    expect(scopeAllows(scope, amoso)).toBe(false);
  });

  it("lets a county-wide auditor reach every sub-county of it", () => {
    const scope: BookScope = { kind: "area", county: "Kisumu", subCounty: null };
    expect(scopeAllows(scope, manyonge)).toBe(true);
    expect(scopeAllows(scope, { id: "s3", county: "Kisumu", subCounty: "Seme" })).toBe(true);
  });

  it("keeps an unplaced school out of every area scope", () => {
    const scope: BookScope = { kind: "area", county: "Kisumu", subCounty: null };
    expect(scopeAllows(scope, { id: "s4", county: null, subCounty: null })).toBe(false);
  });

  it("still reaches an unplaced school by school scope", () => {
    // A school with no county set is still that person's own school. Only the
    // geographic scope depends on it being placed.
    const scope: BookScope = { kind: "school", schoolId: "s4" };
    expect(scopeAllows(scope, { id: "s4", county: null, subCounty: null })).toBe(true);
  });
});

describe("describeScope", () => {
  it("says nothing for an org-wide member", () => {
    expect(describeScope({ kind: "org" })).toBeNull();
  });

  it("names the area for an auditor", () => {
    expect(describeScope({ kind: "area", county: "Kisumu", subCounty: "Seme" }))
      .toBe("Seme, Kisumu County");
  });

  it("marks a school scope, for the caller to name", () => {
    expect(describeScope({ kind: "school", schoolId: "s1" })).toBe("One school only");
  });
});
