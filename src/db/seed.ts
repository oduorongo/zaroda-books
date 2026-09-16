import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema.ts";
import { toCents } from "../domain/money.ts";
import { createBook } from "../server/books.ts";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
const db = drizzle(neon(process.env.DATABASE_URL), { schema });

/**
 * The four transactions and one contra from src/demo/ongora-simba.ts, copied
 * here before that module is deleted. Same figures, same dates.
 */
const demoTxns = [
  {
    date: "2025-10-03", kind: "receipt" as const, particulars: "MoE capitation", receiptNo: "001",
    cash: toCents(24269), bank: 0,
    allocations: [
      { voteHeadCode: "TXB", amount: toCents(7282) },
      { voteHeadCode: "TXM", amount: toCents(729) },
      { voteHeadCode: "EXB", amount: toCents(10194) },
      { voteHeadCode: "TGR", amount: toCents(3640) },
      { voteHeadCode: "STN", amount: toCents(2424) },
    ],
  },
  {
    date: "2025-10-03", kind: "contra" as const, particulars: "banking",
    from: "cash" as const, to: "bank" as const, amount: toCents(24269),
  },
  {
    date: "2026-01-02", kind: "receipt" as const, particulars: "MoE capitation", receiptNo: "002",
    cash: 0, bank: toCents(46425.2),
    allocations: [
      { voteHeadCode: "TXB", amount: toCents(3962.4) },
      { voteHeadCode: "TXM", amount: toCents(1826) },
      { voteHeadCode: "EXB", amount: toCents(25481) },
      { voteHeadCode: "TGR", amount: toCents(9096.8) },
      { voteHeadCode: "STN", amount: toCents(6059) },
    ],
  },
  {
    date: "2026-04-01", kind: "receipt" as const, particulars: "MoE capitation", receiptNo: "003",
    cash: 0, bank: toCents(15811.5),
    allocations: [
      { voteHeadCode: "TXM", amount: toCents(830) },
      { voteHeadCode: "EXB", amount: toCents(6640) },
      { voteHeadCode: "TGR", amount: toCents(2490) },
      { voteHeadCode: "STN", amount: toCents(5851.5) },
    ],
  },
  {
    date: "2026-05-14", kind: "payment" as const, particulars: "Stationery supplier",
    vrNo: "1", chequeNo: "000121", cash: 0, bank: toCents(70000),
    allocations: [{ voteHeadCode: "STN", amount: toCents(70000) }],
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
    accountType: "SIMBA",
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
