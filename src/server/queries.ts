import "server-only";
import { db, schema } from "@/db";
import { eq, inArray } from "drizzle-orm";
import type { Txn, VoteHead } from "@/domain";

export async function getAccountAndSchool(accountId: string) {
  const [row] = await db
    .select({ account: schema.accounts, school: schema.schools })
    .from(schema.accounts)
    .innerJoin(schema.schools, eq(schema.accounts.schoolId, schema.schools.id))
    .where(eq(schema.accounts.id, accountId));
  if (!row) throw new Error("Account not found.");
  return row;
}

/** The one seeded account, for pages that need somewhere to link to. */
export async function getFirstAccount() {
  const [row] = await db
    .select({ account: schema.accounts, school: schema.schools })
    .from(schema.accounts)
    .innerJoin(schema.schools, eq(schema.accounts.schoolId, schema.schools.id))
    .limit(1);
  if (!row) throw new Error("No account seeded yet.");
  return row;
}

export async function getVoteHeads(accountId: string): Promise<VoteHead[]> {
  const heads = await db
    .select()
    .from(schema.voteHeads)
    .where(eq(schema.voteHeads.accountId, accountId))
    .orderBy(schema.voteHeads.order);
  return heads.map((h) => ({ code: h.code, name: h.name, order: h.order }));
}

export async function getFinancialYear(accountId: string) {
  const [fy] = await db
    .select()
    .from(schema.financialYears)
    .where(eq(schema.financialYears.accountId, accountId));
  if (!fy) throw new Error("No financial year seeded for this account.");
  return fy;
}

/** All transactions for a financial year, in the domain engine's Txn shape. */
export async function getTxns(financialYearId: string): Promise<Txn[]> {
  const periods = await db
    .select({ id: schema.periods.id })
    .from(schema.periods)
    .where(eq(schema.periods.financialYearId, financialYearId));
  const periodIds = periods.map((p) => p.id);
  if (periodIds.length === 0) return [];

  const rows = await db
    .select()
    .from(schema.transactions)
    .where(inArray(schema.transactions.periodId, periodIds));

  const allocationRows = await db
    .select({ allocation: schema.allocations, voteHead: schema.voteHeads })
    .from(schema.allocations)
    .innerJoin(schema.voteHeads, eq(schema.allocations.voteHeadId, schema.voteHeads.id))
    .where(inArray(schema.allocations.transactionId, rows.map((r) => r.id)));

  const allocationsByTxn = new Map<string, { voteHeadCode: string; amount: number }[]>();
  for (const { allocation, voteHead } of allocationRows) {
    const list = allocationsByTxn.get(allocation.transactionId) ?? [];
    list.push({ voteHeadCode: voteHead.code, amount: allocation.amount });
    allocationsByTxn.set(allocation.transactionId, list);
  }

  return rows.map((t): Txn => {
    if (t.kind === "contra") {
      return {
        id: t.id,
        date: t.date,
        particulars: t.particulars,
        kind: "contra",
        from: t.contraFrom!,
        to: t.contraTo!,
        // The moved amount is stored in both `cash` and `bank` — see src/db/seed.ts.
        amount: t.cash,
        chequeNo: t.chequeNo ?? undefined,
      };
    }
    const allocations = allocationsByTxn.get(t.id) ?? [];
    if (t.kind === "receipt") {
      return {
        id: t.id, date: t.date, particulars: t.particulars,
        kind: "receipt", receiptNo: t.receiptNo ?? undefined,
        cash: t.cash, bank: t.bank, allocations,
      };
    }
    return {
      id: t.id, date: t.date, particulars: t.particulars,
      kind: "payment", vrNo: t.vrNo ?? undefined, chequeNo: t.chequeNo ?? undefined,
      cash: t.cash, bank: t.bank, allocations,
    };
  });
}

export const inMonth = (txns: Txn[], month: string) => txns.filter((t) => t.date.startsWith(month));
export const upTo = (txns: Txn[], month: string) => txns.filter((t) => t.date <= `${month}-31`);
