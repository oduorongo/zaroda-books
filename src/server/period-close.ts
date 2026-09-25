import "server-only";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { closeRefusal, monthEndExclusive, reopenRefusal } from "@/domain";
import { loadBook } from "@/server/book-context";
import { assertClosable, monthKey } from "@/server/periods";
import { getTxns, upTo } from "@/server/queries";
import { getReconciliation } from "@/server/reconciliation";

async function periodsOf(financialYearId: string) {
  return db
    .select()
    .from(schema.periods)
    .where(eq(schema.periods.financialYearId, financialYearId));
}

/**
 * Rule 5: closing snapshots the month's cash and bank carried down and freezes
 * the month. Refused unless the trial balance agrees, cash is not negative and
 * the bank is reconciled to the statement (rule 4, `assertClosable`).
 */
export async function closeMonth(accountId: string, month: string) {
  const { user, fy, heads } = await loadBook(accountId, { write: true, require: "period.close" });

  const periods = await periodsOf(fy.id);
  const refusal = closeRefusal(periods, month);
  if (refusal) throw new Error(refusal);
  const period = periods.find((p) => p.month === month)!;

  const key = monthKey(month);
  const [txns, { reconciliation, hasStatement }] = await Promise.all([
    getTxns(fy.id),
    getReconciliation(accountId, key),
  ]);
  const lastDay = new Date(`${monthEndExclusive(key)}T00:00:00Z`);
  lastDay.setUTCDate(0);
  const tb = assertClosable(
    lastDay.toISOString().slice(0, 10),
    { cash: fy.openingCash, bank: fy.openingBank },
    upTo(txns, key),
    heads,
    hasStatement ? reconciliation : null,
  );

  const closed = { closingCash: tb.closingCash, closingBank: tb.closingBank };
  const writes = [
    db.update(schema.periods)
      .set({ status: "closed", ...closed, closedBy: user.id, closedAt: new Date() })
      .where(and(eq(schema.periods.id, period.id), eq(schema.periods.status, "open"))),
    db.insert(schema.auditLog).values({
      orgId: user.orgId,
      userId: user.id,
      action: "close",
      entity: "period",
      entityId: period.id,
      after: JSON.stringify({ month, ...closed }),
    }),
  ] as const;
  await db.batch(writes as unknown as Parameters<typeof db.batch>[0]);
}

/** Rule 5: reopening needs a reason, and the reason goes to the audit log. */
export async function reopenMonth(accountId: string, month: string, reason: string) {
  const { user, fy } = await loadBook(accountId, { write: true, require: "period.reopen" });
  if (!reason.trim()) throw new Error("Say why the month is being reopened.");

  const periods = await periodsOf(fy.id);
  const refusal = reopenRefusal(periods, month);
  if (refusal) throw new Error(refusal);
  const period = periods.find((p) => p.month === month)!;

  const writes = [
    db.update(schema.periods)
      .set({ status: "open", closingCash: null, closingBank: null, closedBy: null, closedAt: null })
      .where(eq(schema.periods.id, period.id)),
    db.insert(schema.auditLog).values({
      orgId: user.orgId,
      userId: user.id,
      action: "reopen",
      entity: "period",
      entityId: period.id,
      before: JSON.stringify({
        month, closingCash: period.closingCash, closingBank: period.closingBank,
        closedBy: period.closedBy, closedAt: period.closedAt,
      }),
      after: JSON.stringify({ month, reason: reason.trim() }),
    }),
  ] as const;
  await db.batch(writes as unknown as Parameters<typeof db.batch>[0]);
}
