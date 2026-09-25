import { describe, expect, it } from "vitest";
import { closeRefusal, reopenRefusal } from "../period-order";

const months = (...statuses: ("open" | "closed")[]) =>
  statuses.map((status, i) => ({ month: `2024-${String(7 + i).padStart(2, "0")}-01`, status }));

describe("closeRefusal", () => {
  it("lets the first open month close when every month before it is closed", () => {
    expect(closeRefusal(months("closed", "open", "open"), "2024-08-01")).toBeNull();
  });

  it("refuses a month while an earlier one is still open", () => {
    expect(closeRefusal(months("open", "open"), "2024-08-01")).toMatch(/July 2024/);
  });

  it("refuses a month already closed", () => {
    expect(closeRefusal(months("closed"), "2024-07-01")).toMatch(/already closed/);
  });
});

describe("reopenRefusal", () => {
  it("lets the last closed month reopen", () => {
    expect(reopenRefusal(months("closed", "closed", "open"), "2024-08-01")).toBeNull();
  });

  it("refuses a month while a later one is still closed", () => {
    expect(reopenRefusal(months("closed", "closed"), "2024-07-01")).toMatch(/August 2024/);
  });

  it("refuses a month that is open", () => {
    expect(reopenRefusal(months("open"), "2024-07-01")).toMatch(/not closed/);
  });
});
