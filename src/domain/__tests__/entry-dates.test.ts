import { describe, expect, it } from "vitest";
import { entryDates, todayInKenya } from "../financial-year";

const fy = { startsOn: "2024-07-01", endsOn: "2025-06-30" };

describe("entryDates", () => {
  it("opens on today when today is in the book's year", () => {
    expect(entryDates(fy, ["2024-09-02"], "2025-01-15").start).toBe("2025-01-15");
  });

  it("opens an earlier year's book on its last entry", () => {
    expect(entryDates(fy, ["2024-09-02", "2025-03-11", "2024-12-01"], "2026-09-24").start).toBe("2025-03-11");
  });

  it("opens an empty earlier book on 1 July", () => {
    expect(entryDates(fy, [], "2026-09-24")).toEqual({ from: "2024-07-01", to: "2025-06-30", start: "2024-07-01" });
  });
});

describe("todayInKenya", () => {
  it("is already tomorrow at 22:00 UTC", () => {
    expect(todayInKenya(new Date("2026-09-24T22:00:00Z"))).toBe("2026-09-25");
  });
});
