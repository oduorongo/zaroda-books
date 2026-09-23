import { describe, expect, it } from "vitest";
import { POSITIONS, seesCapitationLetter } from "../positions";

describe("seesCapitationLetter", () => {
  it("is shown to the head of institution and the bursar", () => {
    expect(seesCapitationLetter("hoi")).toBe(true);
    expect(seesCapitationLetter("bursar")).toBe(true);
  });

  it("is hidden from auditors and freelancers", () => {
    expect(seesCapitationLetter("auditor")).toBe(false);
    expect(seesCapitationLetter("freelancer")).toBe(false);
  });

  it("is hidden from someone who has not been given a position", () => {
    // Accounts from before positions existed stay blank until the system
    // owner sets one, and blank must not open the letter.
    expect(seesCapitationLetter(null)).toBe(false);
  });

  it("refuses an unknown position rather than defaulting open", () => {
    expect(seesCapitationLetter("caretaker" as never)).toBe(false);
  });

  it("offers exactly the four positions at signup", () => {
    expect([...POSITIONS]).toEqual(["hoi", "bursar", "auditor", "freelancer"]);
  });
});
