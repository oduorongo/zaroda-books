import "server-only";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { bookStage, reportCoversBook, takesProject, type AccountType, type BookStageKey } from "@/domain";
import { loadBook } from "@/server/book-context";
import { auditStatus } from "@/server/audit-send";
import { paymentStatuses } from "@/server/authorisation";
import { documentsFor, monthsWithoutStatement, paymentsWithoutScde } from "@/server/documents";
import { issuedReportsOn } from "@/server/audit-reports";
import { queriesForAccount } from "@/server/audit-queries";
import { getTxns } from "@/server/queries";

/** Where a book stands on its way to audit. See src/domain/book-progress.ts. */

type Report = typeof schema.auditReports.$inferSelect;

/** An issued report that covers the book and came after it was last sent. */
const auditedSince = (reports: Report[], sentAt: Date | null) =>
  !!sentAt && reports.some((r) => r.issuedAt && r.issuedAt >= sentAt);

/** Closes, reopens, sends and take-backs of a book, oldest first, with who did each. */
async function bookEvents(accountId: string, periodIds: string[]) {
  const rows = await db
    .select({ log: schema.auditLog, name: schema.users.name })
    .from(schema.auditLog)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.userId))
    .where(inArray(schema.auditLog.entityId, [accountId, ...periodIds]))
    .orderBy(schema.auditLog.at);
  return rows
    .filter((r) => (r.log.entity === "period" && (r.log.action === "close" || r.log.action === "reopen"))
      || (r.log.entity === "account" && (r.log.action === "audit.sent" || r.log.action === "audit.withdrawn")))
    .map((r) => {
      let after: Record<string, unknown> = {};
      try { after = JSON.parse(r.log.after ?? "{}"); } catch { /* an old entry; shown without detail */ }
      return { action: r.log.action, at: r.log.at, by: r.name ?? "—", after };
    });
}

/**
 * A close or reopen touches every month it takes in, one log entry each;
 * they are one act on the page. Grouped by what the user did and when.
 */
function acts(events: Awaited<ReturnType<typeof bookEvents>>) {
  const out: { action: string; at: Date; by: string; month: string | null; reason: string | null; months: number }[] = [];
  for (const e of events) {
    const withMonth = (e.after.closedWith ?? e.after.reopenedWith ?? null) as string | null;
    const prev = out.at(-1);
    if (prev && prev.action === e.action && withMonth && prev.month === withMonth
      && Math.abs(prev.at.getTime() - e.at.getTime()) < 60_000) {
      prev.months += 1;
      continue;
    }
    out.push({
      action: e.action, at: e.at, by: e.by,
      month: withMonth ?? ((e.after.auditUpTo as string | null) ?? null),
      reason: (e.after.reason as string | undefined) ?? null,
      months: 1,
    });
  }
  return out;
}

export async function bookProgress(accountId: string) {
  const { user, fy, school, account } = await loadBook(accountId);
  const infrastructure = takesProject(account.type as AccountType);

  const [txns, periods, withoutStatement, scde, audit, reports, queries] = await Promise.all([
    getTxns(fy.id),
    db.select({ period: schema.periods, closedBy: schema.users.name })
      .from(schema.periods)
      .leftJoin(schema.users, eq(schema.users.id, schema.periods.closedBy))
      .where(eq(schema.periods.financialYearId, fy.id)),
    monthsWithoutStatement(accountId, fy.id),
    infrastructure ? paymentsWithoutScde(accountId, school.id, fy.id) : Promise.resolve([]),
    auditStatus(fy.id, account.auditSentTo, account, school.id),
    issuedReportsOn(school.id),
    queriesForAccount(accountId),
  ]);
  const months = periods
    .map((p) => ({ ...p.period, closedByName: p.closedBy }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const statuses = await paymentStatuses(txns);
  const docs = await documentsFor(statuses.map((s) => s.payment.id));
  const events = acts(await bookEvents(accountId, months.map((m) => m.id)));
  const covering = reports.filter((r) =>
    reportCoversBook(r, { accountId, fyLabel: fy.label, startsOn: fy.startsOn, endsOn: fy.endsOn }));
  const lastPeriodEvent = [...events].reverse().find((e) => e.action === "close" || e.action === "reopen");

  const stage = bookStage({
    entries: txns.length,
    months,
    lastPeriodEvent: (lastPeriodEvent?.action as "close" | "reopen" | undefined) ?? null,
    sent: account.auditSentTo ? { upTo: account.auditUpTo } : null,
    auditedSinceSent: auditedSince(covering, account.auditSentAt),
  });

  const count = (state: string) => statuses.filter((s) => s.status.state === state);
  return {
    user, fy, school, account, stage, infrastructure,
    entries: txns.length,
    payments: {
      total: statuses.length,
      withoutDocuments: statuses.filter((s) => !docs.has(s.payment.id)).map((s) => s.payment.vrNo ?? "—"),
      authorised: count("authorised").length,
      held: count("held").map((s) => s.payment.vrNo ?? "—"),
      awaiting: count("awaiting").map((s) => s.payment.vrNo ?? "—"),
      changed: count("changed").map((s) => s.payment.vrNo ?? "—"),
    },
    withoutStatement,
    scde,
    months,
    audit,
    queries: {
      open: queries.filter((q) => q.status === "open").length,
      answered: queries.filter((q) => q.status === "answered").length,
      closed: queries.filter((q) => q.status === "closed").length,
    },
    events,
    reports: covering,
  };
}

/** A stage for every book in the list, from a few queries for all of them together. */
export async function bookStages(
  books: { account: typeof schema.accounts.$inferSelect; school: typeof schema.schools.$inferSelect }[],
): Promise<Record<string, { key: BookStageKey; label: string }>> {
  if (!books.length) return {};
  const accountIds = books.map((b) => b.account.id);
  const fys = await db.select().from(schema.financialYears)
    .where(inArray(schema.financialYears.accountId, accountIds));
  const fyIds = fys.map((f) => f.id);
  const schoolIds = [...new Set(books.map((b) => b.school.id))];

  const [periods, reports] = await Promise.all([
    fyIds.length ? db.select().from(schema.periods).where(inArray(schema.periods.financialYearId, fyIds)) : [],
    db.select().from(schema.auditReports).where(and(
      inArray(schema.auditReports.schoolId, schoolIds),
      eq(schema.auditReports.status, "issued"),
      isNotNull(schema.auditReports.issuedAt),
    )),
  ]);
  const periodIds = periods.map((p) => p.id);
  const [entered, events] = periodIds.length ? await Promise.all([
    db.selectDistinct({ periodId: schema.transactions.periodId }).from(schema.transactions)
      .where(inArray(schema.transactions.periodId, periodIds)),
    db.select({ entityId: schema.auditLog.entityId, action: schema.auditLog.action }).from(schema.auditLog)
      .where(and(eq(schema.auditLog.entity, "period"), inArray(schema.auditLog.entityId, periodIds),
        inArray(schema.auditLog.action, ["close", "reopen"])))
      .orderBy(desc(schema.auditLog.at)),
  ]) : [[], []];
  const withEntries = new Set(entered.map((e) => e.periodId));

  const out: Record<string, { key: BookStageKey; label: string }> = {};
  for (const { account, school } of books) {
    const fy = fys.find((f) => f.accountId === account.id);
    if (!fy) continue;
    const mine = periods.filter((p) => p.financialYearId === fy.id);
    const ids = new Set(mine.map((p) => p.id));
    const last = events.find((e) => e.entityId && ids.has(e.entityId));
    const covering = reports.filter((r) => r.schoolId === school.id
      && reportCoversBook(r, { accountId: account.id, fyLabel: fy.label, startsOn: fy.startsOn, endsOn: fy.endsOn }));
    out[account.id] = bookStage({
      entries: mine.some((p) => withEntries.has(p.id)) ? 1 : 0,
      months: mine,
      lastPeriodEvent: (last?.action as "close" | "reopen" | undefined) ?? null,
      sent: account.auditSentTo ? { upTo: account.auditUpTo } : null,
      auditedSinceSent: auditedSince(covering, account.auditSentAt),
    });
  }
  return out;
}
