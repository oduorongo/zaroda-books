import { describe, expect, it } from "vitest";
import { schoolNameKey } from "../subscription";

describe("schoolNameKey", () => {
  it("ignores case, so one school is not two", () => {
    expect(schoolNameKey("Pith Primary")).toBe(schoolNameKey("PITH PRIMARY"));
  });

  it("ignores leading, trailing and repeated spaces", () => {
    expect(schoolNameKey("  Pith   Primary  ")).toBe(schoolNameKey("Pith Primary"));
  });

  it("ignores punctuation, which is typed inconsistently", () => {
    expect(schoolNameKey("Ong'ora Kakuru Primary")).toBe(schoolNameKey("Ongora Kakuru Primary"));
    expect(schoolNameKey("St. Mary's School")).toBe(schoolNameKey("St Marys School"));
  });

  it("keeps genuinely different schools apart", () => {
    expect(schoolNameKey("Pith Primary")).not.toBe(schoolNameKey("Pith Secondary"));
    expect(schoolNameKey("Amoso Junior")).not.toBe(schoolNameKey("Amosa Junior"));
  });

  it("keeps digits, which distinguish some schools", () => {
    expect(schoolNameKey("Kakuru DEB 2")).toBe("kakuru deb 2");
  });

  it("is empty for a name that is only punctuation", () => {
    expect(schoolNameKey("  ...  ")).toBe("");
  });
});
