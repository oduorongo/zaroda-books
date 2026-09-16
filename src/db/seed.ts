import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema.ts";
import { toCents } from "../domain/money.ts";
import { createBook } from "../server/books.ts";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
const db = drizzle(neon(process.env.DATABASE_URL), { schema });

/**
 * Three FPE disbursements, a banking contra and a payment, split at the rates
 * in the 25 July 2024 circular for Account 1: KSh 144.00 a learner across
 * exercise books, teachers guides, stationery and assessments.
 */
const capitation = (learners: number) => [
  { voteHeadCode: "EXB", amount: toCents(82.69 * learners) },
  { voteHeadCode: "TGR", amount: toCents(31.28 * learners) },
  { voteHeadCode: "STN", amount: toCents(18.77 * learners) },
  { voteHeadCode: "ASS", amount: toCents(11.26 * learners) },
];

const demoTxns = [
  {
    date: "2025-10-03", kind: "receipt" as const, particulars: "MoE capitation, Term 3",
    receiptNo: "001", enrolment: 168,
    cash: toCents(144 * 168), bank: 0,
    allocations: capitation(168),
  },
  {
    date: "2025-10-03", kind: "contra" as const, particulars: "banking",
    from: "cash" as const, to: "bank" as const, amount: toCents(144 * 168),
  },
  {
    date: "2026-01-02", kind: "receipt" as const, particulars: "MoE capitation, Term 1",
    receiptNo: "002", enrolment: 322,
    cash: 0, bank: toCents(144 * 322),
    allocations: capitation(322),
  },
  {
    date: "2026-04-01", kind: "receipt" as const, particulars: "MoE capitation, Term 2",
    receiptNo: "003", enrolment: 110,
    cash: 0, bank: toCents(144 * 110),
    allocations: capitation(110),
  },
  {
    date: "2026-05-14", kind: "payment" as const, particulars: "Exercise books supplier",
    vrNo: "1", chequeNo: "000121", cash: 0, bank: toCents(45000),
    allocations: [{ voteHeadCode: "EXB", amount: toCents(45000) }],
  },
];

async function main() {
  const [org] = await db.insert(schema.orgs)
    .values({ name: "Ong'ora Kakuru Primary School" }).returning();

  const [user] = await db.insert(schema.users).values({
    email: "seed@zaroda.books",
    name: "Seed User",
    passwordHash: "not-set",
  }).returning();

  await db.insert(schema.memberships).values({ orgId: org.id, userId: user.id, role: "owner" });

  const { school, account, voteHeads, periods } = await createBook({
    orgId: org.id,
    schoolName: "Ong'ora Kakuru Primary School",
    level: "primary",
    accountType: "TUITION",
    fyLabel: "2025/26",
    openingCash: 0,
    openingBank: toCents(1903.45),
  });

  const voteHeadIdByCode = new Map(voteHeads.map((h) => [h.code, h.id]));
  const periodIdForMonth = (date: string) => {
    const month = `${date.slice(0, 7)}-01`;
    const period = periods.find((p) => p.month === month);
    if (!period) throw new Error(`No seeded period for ${date}`);
    return period.id;
  };

  for (const t of demoTxns) {
    if (t.kind === "contra") {
      // No dedicated amount column for a contra — the moved amount is stored
      // in both `cash` and `bank`, alongside contraFrom/contraTo.
      await db.insert(schema.transactions).values({
        periodId: periodIdForMonth(t.date),
        date: t.date,
        kind: "contra",
        particulars: t.particulars,
        cash: t.amount,
        bank: t.amount,
        contraFrom: t.from,
        contraTo: t.to,
        createdBy: user.id,
      });
      continue;
    }

    const [txn] = await db.insert(schema.transactions).values({
      periodId: periodIdForMonth(t.date),
      date: t.date,
      kind: t.kind,
      particulars: t.particulars,
      receiptNo: t.kind === "receipt" ? t.receiptNo : undefined,
      vrNo: t.kind === "payment" ? t.vrNo : undefined,
      chequeNo: t.kind === "payment" ? t.chequeNo : undefined,
      cash: t.cash,
      bank: t.bank,
      enrolment: t.kind === "receipt" ? t.enrolment : undefined,
      createdBy: user.id,
    }).returning();

    await db.insert(schema.allocations).values(
      t.allocations.map((a) => {
        const voteHeadId = voteHeadIdByCode.get(a.voteHeadCode);
        if (!voteHeadId) throw new Error(`Unknown vote head code ${a.voteHeadCode}`);
        return { transactionId: txn.id, voteHeadId, amount: a.amount };
      }),
    );
  }

  console.log(`Seeded account ${account.id} (${school.name} — ${account.name}).`);
}

main();
