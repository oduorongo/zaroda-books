import { describe, expect, it } from "vitest";
import { auditorCanSee, describeAuditScope } from "../audit-scope";

const kisumuEast = { county: "Kisumu", subCounty: "Kisumu East" };
const wholeKisumu = { county: "Kisumu", subCounty: null };

describe("auditorCanSee", () => {
  it("sees a school in its own sub-county", () => {
    expect(auditorCanSee(kisumuEast, { county: "Kisumu", subCounty: "Kisumu East" })).toBe(true);
  });

  it("does not see another sub-county of the same county", () => {
    expect(auditorCanSee(kisumuEast, { county: "Kisumu", subCounty: "Seme" })).toBe(false);
  });

  it("does not see the same sub-county name in another county", () => {
    // Sub-county names are not unique across counties, so the pair must match.
    expect(auditorCanSee(kisumuEast, { county: "Siaya", subCounty: "Kisumu East" })).toBe(false);
  });

  it("sees every sub-county when granted the whole county", () => {
    expect(auditorCanSee(wholeKisumu, { county: "Kisumu", subCounty: "Seme" })).toBe(true);
    expect(auditorCanSee(wholeKisumu, { county: "Kisumu", subCounty: "Nyando" })).toBe(true);
  });

  it("still refuses another county when granted a whole one", () => {
    expect(auditorCanSee(wholeKisumu, { county: "Siaya", subCounty: "Gem" })).toBe(false);
  });

  it("cannot see a school that has not been placed", () => {
    // An unplaced school is not in anybody's area. Showing it to whichever
    // auditor happened to ask would be the worst possible default.
    expect(auditorCanSee(kisumuEast, { county: null, subCounty: null })).toBe(false);
    expect(auditorCanSee(wholeKisumu, { county: null, subCounty: "Kisumu East" })).toBe(false);
  });

  it("needs a sub-county on the school when the grant names one", () => {
    expect(auditorCanSee(kisumuEast, { county: "Kisumu", subCounty: null })).toBe(false);
  });

  it("ignores case and stray spacing, which is how names get typed", () => {
    expect(auditorCanSee(kisumuEast, { county: " kisumu ", subCounty: "KISUMU EAST" })).toBe(true);
  });
});

describe("describeAuditScope", () => {
  it("names a sub-county grant", () => {
    expect(describeAuditScope(kisumuEast)).toBe("Kisumu East, Kisumu County");
  });

  it("names a county-wide grant", () => {
    expect(describeAuditScope(wholeKisumu)).toBe("All of Kisumu County");
  });
});
