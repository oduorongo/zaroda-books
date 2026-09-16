import "server-only";
import { randomUUID } from "node:crypto";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { validateTransaction } from "@/domain";
import type { NewTxn, Txn } from "@/domain";

/**
 * The only way a transaction enters the system. Validation happens here, in the
 * same call as the insert, so no route can bypass it.
 */
export async function createTransaction(input: {
  periodId: string;
  accountId: string;
  userId: string;
  orgId: string;
  txn: NewTxn;
  enrolment?: number;
}) {
  const period = await db.query.periods.findFirst({
    where: eq(schema.periods.id, input.periodId),
  });
  if (!period) throw new Error("Period not found.");
  if (period.status === "closed") throw new Error("This month is closed. Reopen it to post.");

  const heads = await db.query.voteHeads.findMany({
    where: eq(schema.voteHeads.accountId, input.accountId),
  });

  const id = randomUUID();
  const candidate = { ...input.txn, id } as Txn;
  const errors = validateTransaction(candidate, heads.map((h) => h.code));
  if (errors.length) throw new Error(errors.join(" "));

  const t = input.txn;
  const row = {
    id,
    periodId: input.periodId,
    date: t.date,
    kind: t.kind,
    particulars: t.particulars,
    receiptNo: t.kind === "receipt" ? t.receiptNo : undefined,
    vrNo: t.kind === "payment" ? t.vrNo : undefined,
    chequeNo: t.kind !== "receipt" ? t.chequeNo : undefined,
    // A contra has no cash/bank pair of its own — the moved amount is stored in
    // both columns, alongside contraFrom/contraTo. See src/db/seed.ts.
    cash: t.kind === "contra" ? t.amount : t.cash,
    bank: t.kind === "contra" ? t.amount : t.bank,
    enrolment: t.kind === "receipt" ? input.enrolment : undefined,
    contraFrom: t.kind === "contra" ? t.from : undefined,
    contraTo: t.kind === "contra" ? t.to : undefined,
    createdBy: input.userId,
  };

  const idByCode = new Map(heads.map((h) => [h.code, h.id]));
  const allocationRows = t.kind === "contra" ? [] : t.allocations.map((a) => {
    const voteHeadId = idByCode.get(a.voteHeadCode);
    if (!voteHeadId) throw new Error(`Unknown vote head code ${a.voteHeadCode}`);
    return { transactionId: id, voteHeadId, amount: a.amount };
  });

  const audit = {
    orgId: input.orgId,
    userId: input.userId,
    action: "create",
    entity: "transaction",
    entityId: id,
    after: JSON.stringify(candidate),
  };

  // The Neon HTTP driver has no interactive transactions; `batch` is Neon's
  // atomic multi-statement call, so the transaction, its allocations and the
  // audit row still land together or not at all.
  const writes = [
    db.insert(schema.transactions).values(row),
    ...(allocationRows.length ? [db.insert(schema.allocations).values(allocationRows)] : []),
    db.insert(schema.auditLog).values(audit),
  ] as const;
  await db.batch(writes as unknown as Parameters<typeof db.batch>[0]);

  return id;
}
