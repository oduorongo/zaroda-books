import { expect, it } from "vitest";
import { readHandover } from "../handover";

it("needs a name, TSC number, reason and date", () => {
  expect(readHandover("", "123", "retirement", "2026-06-30")).toHaveProperty("error");
  expect(readHandover("A. Head", " ", "retirement", "2026-06-30")).toHaveProperty("error");
  expect(readHandover("A. Head", "123", "sacked", "2026-06-30")).toHaveProperty("error");
  expect(readHandover("A. Head", "123", "transfer", "")).toHaveProperty("error");
  expect(readHandover(" A. Head ", "123", "transfer", "2026-06-30"))
    .toEqual({ officer: "A. Head", tscNo: "123", reason: "transfer", handoverDate: "2026-06-30" });
});
