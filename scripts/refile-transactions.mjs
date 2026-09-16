/**
 * One-off repair. Entries posted before the fix were filed in whichever month
 * the books happened to be open at, not the month their own date falls in.
 * This moves each to the right month. No figure changes: only period_id.
 *
 *   node --env-file=.env scripts/refile-transactions.mjs          (preview)
 *   node --env-file=.env scripts/refile-transactions.mjs --apply  (write)
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const apply = process.argv.includes("--apply");

// The driver hands back Date objects for a date column, so the months are
// compared as text from Postgres rather than in JavaScript.
const rows = await sql`
  select t.id, to_char(t.date, 'YYYY-MM') as date_month, t.kind, t.particulars,
         p.id as period_id, to_char(p.month, 'YYYY-MM') as period_month, p.status,
         p.financial_year_id
  from transactions t
  join periods p on p.id = t.period_id
  order by t.date
`;
const periods = await sql`
  select id, financial_year_id, to_char(month, 'YYYY-MM') as month, status from periods
`;

const moves = [];
const problems = [];

for (const t of rows) {
  const wanted = periods.find(
    (p) => p.financial_year_id === t.financial_year_id && p.month === t.date_month,
  );
  if (!wanted) {
    problems.push(`${t.date_month}  ${t.particulars} — no such month in this financial year`);
    continue;
  }
  if (wanted.id === t.period_id) continue;
  if (t.status === "closed" || wanted.status === "closed") {
    problems.push(`${t.date_month}  ${t.particulars} — a closed month is involved, left alone`);
    continue;
  }
  moves.push({ id: t.id, from: t.period_month, to: wanted.month, t });
  moves[moves.length - 1].toId = wanted.id;
}

console.log(`${rows.length} entries, ${moves.length} filed in the wrong month\n`);
for (const m of moves) {
  console.log(
    `${m.t.date_month}  ${m.t.kind.padEnd(8)} ${String(m.t.particulars).slice(0, 34).padEnd(36)} ${m.from} -> ${m.to}`,
  );
}
if (problems.length) console.log("\nSkipped:\n" + problems.join("\n"));

if (!apply) {
  console.log("\nPreview only. Re-run with --apply to write these changes.");
} else {
  for (const m of moves) {
    await sql`update transactions set period_id = ${m.toId} where id = ${m.id}`;
  }
  console.log(`\nDone. ${moves.length} entries refiled.`);
}
