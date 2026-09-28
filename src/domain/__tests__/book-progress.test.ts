import { describe, expect, it } from "vitest";
import { bookStage, reportCoversBook, type BookStageFacts } from "../book-progress";

const months = (...statuses: ("open" | "closed")[]) =>
  statuses.map((status, i) => {
    const m = 7 + i;
    const year = m > 12 ? 2025 : 2024;
    return { month: `${year}-${String(m > 12 ? m - 12 : m).padStart(2, "0")}-01`, status };
  });

const year = (status: "open" | "closed") => months(...Array<"open" | "closed">(12).fill(status));

const facts = (over: Partial<BookStageFacts>): BookStageFacts => ({
  entries: 0, months: year("open"), lastPeriodEvent: null, sent: null, auditedSinceSent: false, ...over,
});

describe("bookStage", () => {
  it("is not started with no entries", () => {
    expect(bookStage(facts({})).key).toBe("not-started");
  });

  it("is being written up once there are entries", () => {
    expect(bookStage(facts({ entries: 3 })).key).toBe("writing");
  });

  it("names the last month closed", () => {
    const s = bookStage(facts({ entries: 3, months: months("closed", "closed", "open"), lastPeriodEvent: "close" }));
    expect(s).toEqual({ key: "closing", label: "Closed to August 2024" });
  });

  it("is closed when June is", () => {
    expect(bookStage(facts({ entries: 3, months: year("closed"), lastPeriodEvent: "close" })).key).toBe("closed");
  });

  it("shows a reopened book until it is closed again", () => {
    expect(bookStage(facts({ entries: 3, lastPeriodEvent: "reopen" })).key).toBe("reopened");
    expect(bookStage(facts({ entries: 3, months: months("closed", "open"), lastPeriodEvent: "close" })).key).toBe("closing");
  });

  it("is with the auditor once sent, whole year or handover", () => {
    expect(bookStage(facts({ months: year("closed"), sent: { upTo: null } })).key).toBe("sent");
    expect(bookStage(facts({ months: months("closed"), sent: { upTo: "2024-07" } })))
      .toEqual({ key: "handover", label: "With the auditor — handover, to July 2024" });
  });

  it("is audited once a report is issued on the book as sent", () => {
    expect(bookStage(facts({ months: year("closed"), sent: { upTo: null }, auditedSinceSent: true })).key).toBe("audited");
  });
});

describe("reportCoversBook", () => {
  const book = { accountId: "a1", fyLabel: "2024/25", startsOn: "2024-07-01", endsOn: "2025-06-30" };
  const report = { accountId: null, years: null, periodFrom: null, periodTo: null };

  it("takes an IPSAS report naming the year", () => {
    expect(reportCoversBook({ ...report, kind: "ipsas", years: '["2023/24","2024/25"]' }, book)).toBe(true);
    expect(reportCoversBook({ ...report, kind: "ipsas", years: '["2023/24"]' }, book)).toBe(false);
  });

  it("takes a primary report on this account overlapping the year", () => {
    const p = { ...report, kind: "primary" as const, accountId: "a1", periodFrom: "2024-01-01", periodTo: "2024-12-31" };
    expect(reportCoversBook(p, book)).toBe(true);
    expect(reportCoversBook({ ...p, accountId: "a2" }, book)).toBe(false);
    expect(reportCoversBook({ ...p, periodTo: "2024-06-30" }, book)).toBe(false);
  });

  it("takes a clearance memo ending within the year", () => {
    expect(reportCoversBook({ ...report, kind: "clearance", periodTo: "2025-03-31" }, book)).toBe(true);
    expect(reportCoversBook({ ...report, kind: "clearance", periodTo: "2025-08-31" }, book)).toBe(false);
  });
});
