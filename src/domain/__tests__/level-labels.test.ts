import { describe, expect, it } from "vitest";
import { LEVEL_LABEL, LEVEL_OPTIONS, SCHOOL_LEVELS } from "../vote-heads";

describe("LEVEL_LABEL", () => {
  it("names the three levels the way Zaroda names them", () => {
    expect(LEVEL_LABEL.primary).toBe("Primary school");
    expect(LEVEL_LABEL.junior).toBe("Junior school");
    expect(LEVEL_LABEL.senior).toBe("Senior school");
  });

  it("never says secondary", () => {
    // The old workbooks and the first drafts of this app said "Secondary".
    // One word per level, everywhere, or a bursar wonders if they differ.
    for (const label of Object.values(LEVEL_LABEL)) {
      expect(label.toLowerCase()).not.toContain("secondary");
    }
  });

  it("ends every label with the same word, so they read as one set", () => {
    for (const label of Object.values(LEVEL_LABEL)) {
      expect(label.endsWith(" school")).toBe(true);
    }
  });

  it("covers every level, with nothing left unlabelled", () => {
    for (const level of SCHOOL_LEVELS) expect(LEVEL_LABEL[level]).toBeTruthy();
    expect(Object.keys(LEVEL_LABEL)).toHaveLength(SCHOOL_LEVELS.length);
  });
});

describe("LEVEL_OPTIONS", () => {
  it("is the three levels in the order a school grows", () => {
    expect(LEVEL_OPTIONS.map((o) => o.id)).toEqual(["primary", "junior", "senior"]);
  });

  it("carries the canonical label with each id", () => {
    expect(LEVEL_OPTIONS[2]).toEqual({ id: "senior", label: "Senior school" });
  });
});
