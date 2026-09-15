import "server-only";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { validateTransaction } from "@/domain";
import type { Txn } from "@/domain";

/**
 * The only way a transaction enters the system. Validation happens here, in the
 * same call as the insert, so no route can bypass it.
 */
export async function createTransaction(input: {
  periodId: string;
  accountId: string;
  userId: string;
  orgId: string;
  txn: Omit<Txn, "id">;
}) {
  const period = await db.query.periods.findFirst({
    where: eq(schema.periods.id, input.periodId),
  });
  if (!period) throw new Error("Period not found.");
  if (period.status === "closed") throw new Error("This month is closed. Reopen it to post.");

  const heads = await db.query.voteHeads.findMany({
    where: eq(schema.voteHeads.accountId, input.accountId),
  });

  const candidate = { ...input.txn, id: "pending" } as Txn;
  const errors = validateTransaction(candidate, heads.map((h) => h.code));
  if (errors.length) throw new Error(errors.join(" "));

  // TODO: wrap insert + allocations + audit entry in one transaction.
  throw new Error("Not implemented — see ARCHITECTURE.md, step 4.");
}
