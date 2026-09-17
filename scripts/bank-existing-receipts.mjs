/**
 * One-off conversion. Receipts posted before the banking rule went in were
 * entered straight to bank. The school receives every shilling in cash and
 * banks it, so each of those becomes a cash receipt plus a banking contra on
 * the same date. Closing balances do not move: only the route the money took.
 *
 *   node --env-file=.env scripts/bank-existing-receipts.mjs          (preview)
 *   node --env-file=.env scripts/bank-existing-receipts.mjs --apply  (write)
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const apply = process.argv.includes("--apply");

const kes = (c) => (Number(c) / 100).toLocaleString("en-KE", { minimumFractionDigits: 2 });

// Only receipts still sitting in the bank column, and only those without a
// banking contra already — so the script is safe to run twice.
const rows = await sql`
  select t.id, to_char(t.date, 'YYYY-MM-DD') as date, t.particulars, t.receipt_no,
         t.cash, t.bank, t.period_id, t.created_by, p.status, s.name as school
  from transactions t
  join periods p on p.id = t.period_id
  join financial_years fy on fy.id = p.financial_year_id
  join accounts a on a.id = fy.account_id
  join schools s on s.id = a.school_id
  where t.kind = 'receipt'
    and t.bank > 0
    and not exists (select 1 from transactions b where b.banked_from = t.id)
  order by s.name, t.date
`;

if (!rows.length) {
  console.log("Nothing to convert — every receipt is already entered in cash.");
  process.exit(0);
}

let closed = 0;
for (const r of rows) {
  const total = Number(r.cash) + Number(r.bank);
  if (r.status === "closed") closed += 1;
  console.log(
    `${r.school}  ${r.date}  ${(r.receipt_no ?? "").padEnd(10)} ${kes(total).padStart(14)}` +
    `${r.status === "closed" ? "  (closed month)" : ""}`,
  );
}

console.log(`\n${rows.length} receipt(s) to convert${closed ? `, ${closed} in closed months` : ""}.`);

if (!apply) {
  console.log("\nPreview only. Re-run with --apply to write the changes.");
  process.exit(0);
}

for (const r of rows) {
  const total = Number(r.cash) + Number(r.bank);
  const [contra] = await sql`
    insert into transactions
      (period_id, date, kind, particulars, cash, bank, contra_from, contra_to,
       banked_from, created_by)
    values
      (${r.period_id}, ${r.date}, 'contra',
       ${`Banking — ${r.receipt_no || r.particulars}`},
       ${total}, ${total}, 'cash', 'bank', ${r.id}, ${r.created_by})
    returning id
  `;
  await sql`update transactions set cash = ${total}, bank = 0 where id = ${r.id}`;
  console.log(`converted ${r.date}  ${kes(total).padStart(14)}  contra ${contra.id}`);
}

console.log(`\nDone. ${rows.length} receipt(s) converted.`);
console.log("Check a trial balance: the closing cash and bank should be unchanged.");
