import { expect, it } from "vitest";
import { longDate } from "../clearance-memo";

it("dates a memo the way the county writes it", () => {
  expect(longDate("2026-06-30")).toBe("30th June, 2026");
  expect(longDate("2026-08-01")).toBe("1st August, 2026");
  expect(longDate("2026-08-22")).toBe("22nd August, 2026");
  expect(longDate("2026-08-23")).toBe("23rd August, 2026");
  expect(longDate("2026-08-11")).toBe("11th August, 2026");
  expect(longDate("2026-08-13")).toBe("13th August, 2026");
});
