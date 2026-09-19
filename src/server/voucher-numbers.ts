import "server-only";
import { db, schema } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import { renumbering } from "@/domain";

/**
 * Rewrites the whole financial year's voucher numbers so they run 1..N in date
 * order. Called after any payment is created, amended or deleted.
 *
 * It deliberately renumbers vouchers in closed months too. That is the choice
 * the sequence demands — a payment inserted into September has to push October
 * along, and October may well be closed — but it means a closed month's cash
 * book reference can change after the fact. Every move is written to audit_log,
 * which is the only record that the number on a filed voucher is now stale.
 */
export async function resequenceVouchers(input: {
  financialYearId: string;
  orgId: string;
  userId: string;
}) {
  const periods = await db
    .select({ id: schema.periods.id })
    .from(schema.periods)
    .where(eq(schema.periods.financialYearId, input.financialYearId));
  const periodIds = periods.map((p) => p.id);
  if (periodIds.length === 0) return [];

  const payments = await db
    .select({
      id: schema.transactions.id,
      date: schema.transactions.date,
      createdAt: schema.transactions.createdAt,
      vrNo: schema.transactions.vrNo,
    })
    .from(schema.transactions)
    .where(and(
      inArray(schema.transactions.periodId, periodIds),
      eq(schema.transactions.kind, "payment"),
    ));

  const moves = renumbering(
    payments.map((p) => ({
      id: p.id,
      date: p.date,
      enteredAt: p.createdAt.toISOString(),
      vrNo: p.vrNo ?? undefined,
    })),
  );
  if (moves.length === 0) return [];

  for (const m of moves) {
    await db.update(schema.transactions)
      .set({ vrNo: m.to })
      .where(eq(schema.transactions.id, m.id));
  }

  await db.insert(schema.auditLog).values({
    orgId: input.orgId,
    userId: input.userId,
    action: "voucher.resequenced",
    entity: "financial_year",
    entityId: input.financialYearId,
    before: JSON.stringify(moves.map((m) => ({ id: m.id, vrNo: m.from }))),
    after: JSON.stringify(moves.map((m) => ({ id: m.id, vrNo: m.to }))),
  });

  return moves;
}
