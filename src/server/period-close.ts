import "server-only";
import { db, schema } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { monthEndExclusive, monthsToClose, monthsToReopen } from "@/domain";
import { loadBook } from "@/server/book-context";
import { assertClosable, assertReconciled, monthKey } from "@/server/periods";
import { getTxns, upTo } from "@/server/queries";
import { getReconciliation } from "@/server/reconciliation";

async function periodsOf(financialYearId: string) {
  return db
    .select()
    .from(schema.periods)
    .where(eq(schema.periods.financialYearId, financialYearId));
}

/** "2025-06" -> "2025-06-30". */
const lastDayOf = (key: string) => {
  const d = new Date(`${monthEndExclusive(key)}T00:00:00Z`);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
};

/**
 * Rule 5: closing snapshots each month's cash and bank carried down and
 * freezes it. Closing a month closes every open month before it, each checked
 * at its own month end (rule 4, `assertClosable`); only the month asked for
 * must be reconciled to the statement. Nothing closes unless all of them pass.
 */
export async function closeMonth(accountId: string, month: string) {
  const { user, fy, heads } = await loadBook(accountId, { write: true, require: "period.close" });

  const periods = await periodsOf(fy.id);
  const chosen = monthsToClose(periods, month);
  if (!chosen.months) throw new Error(chosen.error);

  const [txns, { reconciliation, hasStatement }] = await Promise.all([
    getTxns(fy.id),
    getReconciliation(accountId, monthKey(month)),
  ]);
  assertReconciled(hasStatement ? reconciliation : null);

  const opening = { cash: fy.openingCash, bank: fy.openingBank };
  const snapshots = chosen.months.map((m) => {
    const key = monthKey(m);
    const tb = assertClosable(lastDayOf(key), opening, upTo(txns, key), heads);
    return { period: periods.find((p) => p.month === m)!, closingCash: tb.closingCash, closingBank: tb.closingBank };
  });

  const closedAt = new Date();
  const writes = snapshots.flatMap(({ period, closingCash, closingBank }) => [
    db.update(schema.periods)
      .set({ status: "closed", closingCash, closingBank, closedBy: user.id, closedAt })
      .where(eq(schema.periods.id, period.id)),
    db.insert(schema.auditLog).values({
      orgId: user.orgId,
      userId: user.id,
      action: "close",
      entity: "period",
      entityId: period.id,
      after: JSON.stringify({ month: period.month, closingCash, closingBank, closedWith: month }),
    }),
  ]);
  await db.batch(writes as unknown as Parameters<typeof db.batch>[0]);
  return chosen.months;
}

/**
 * Rule 5: reopening needs a reason, and the reason goes to the audit log.
 * Reopening a month reopens every closed month after it, so no month is left
 * frozen on a balance brought down that can now change.
 */
export async function reopenMonth(accountId: string, month: string, reason: string) {
  const { user, fy } = await loadBook(accountId, { write: true, require: "period.reopen" });
  if (!reason.trim()) throw new Error("Say why the month is being reopened.");

  const periods = await periodsOf(fy.id);
  const chosen = monthsToReopen(periods, month);
  if (!chosen.months) throw new Error(chosen.error);
  const reopened = periods.filter((p) => chosen.months.includes(p.month));

  const writes = [
    db.update(schema.periods)
      .set({ status: "open", closingCash: null, closingBank: null, closedBy: null, closedAt: null })
      .where(inArray(schema.periods.id, reopened.map((p) => p.id))),
    ...reopened.map((p) => db.insert(schema.auditLog).values({
      orgId: user.orgId,
      userId: user.id,
      action: "reopen",
      entity: "period",
      entityId: p.id,
      before: JSON.stringify({
        month: p.month, closingCash: p.closingCash, closingBank: p.closingBank,
        closedBy: p.closedBy, closedAt: p.closedAt,
      }),
      after: JSON.stringify({ month: p.month, reason: reason.trim(), reopenedWith: month }),
    })),
  ];
  await db.batch(writes as unknown as Parameters<typeof db.batch>[0]);
}
