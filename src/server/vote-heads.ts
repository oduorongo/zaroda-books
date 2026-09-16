import "server-only";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Appends a head of the school's own. Existing heads are never renumbered —
 * the order is the chart of accounts and the books are read against it.
 */
export async function addVoteHead(accountId: string, code: string, name: string) {
  const existing = await db
    .select()
    .from(schema.voteHeads)
    .where(eq(schema.voteHeads.accountId, accountId));

  if (existing.some((h) => h.code === code)) {
    throw new Error(`This account already has a vote head coded ${code}.`);
  }

  const order = existing.reduce((a, h) => Math.max(a, h.order), 0) + 1;
  const [head] = await db
    .insert(schema.voteHeads)
    .values({ accountId, code, name, order })
    .returning();
  return head;
}
