/**
 * One-off repair. An account's type is the key into the chart of accounts, so
 * a type that is not a chart key makes every chart-driven rule skip that book
 * silently — the locked rate boxes, the chart sync, anything added later.
 *
 * The primary tuition book was opened as 'SIMBA', which is what the school
 * calls the account but not what the chart calls it: the chart keys it
 * 'TUITION' and labels it "Tuition (Account 1 — SIMBA)". The displayed name
 * is left alone; only the key changes.
 *
 *   node --env-file=.env scripts/fix-account-types.mjs          (preview)
 *   node --env-file=.env scripts/fix-account-types.mjs --apply  (write)
 */
import { neon } from "@neondatabase/serverless";
import { CHART_OF_ACCOUNTS } from "../src/domain/vote-heads.ts";

const sql = neon(process.env.DATABASE_URL);
const apply = process.argv.includes("--apply");

/** Account types that were never chart keys, and the key they belong under. */
const RENAMES = { SIMBA: "TUITION", GPA: "OPERATIONS" };

const rows = await sql`
  select a.id, a.type, a.name as account, s.name as school, s.level, s.org_id
  from accounts a join schools s on s.id = a.school_id
  order by s.name`;

const fixes = [];
for (const r of rows) {
  const chart = CHART_OF_ACCOUNTS[r.level]?.[r.type];
  if (chart) continue;

  const wanted = RENAMES[r.type];
  if (!wanted || !CHART_OF_ACCOUNTS[r.level]?.[wanted]) {
    console.log(`${r.school} / ${r.account}: type '${r.type}' matches no chart at ${r.level}, and`);
    console.log("  there is no known key for it. Left alone.");
    continue;
  }
  fixes.push({ ...r, wanted });
}

if (!fixes.length) {
  console.log("Every account type is a chart key. Nothing to do.");
  process.exit(0);
}

for (const f of fixes) {
  const chart = CHART_OF_ACCOUNTS[f.level][f.wanted];
  console.log(`${f.school} / ${f.account}`);
  console.log(`  type '${f.type}' -> '${f.wanted}'  (chart: ${chart.label})`);
  console.log(`  the name shown, '${f.account}', is not changed`);
}

console.log(`\n${fixes.length} account type(s) to correct.`);

if (!apply) {
  console.log("\nPreview only. Re-run with --apply to write them.");
  process.exit(0);
}

for (const f of fixes) {
  const [u] = await sql`select user_id from memberships where org_id = ${f.org_id} limit 1`;
  await sql`update accounts set type = ${f.wanted} where id = ${f.id}`;
  await sql`
    insert into audit_log (org_id, user_id, action, entity, entity_id, before, after)
    values (${f.org_id}, ${u?.user_id ?? null}, 'update', 'account', ${f.id},
            ${JSON.stringify({ type: f.type })}, ${JSON.stringify({ type: f.wanted })})`;
  console.log(`corrected ${f.school} / ${f.account}`);
}

console.log(`\nDone. ${fixes.length} corrected.`);
console.log("The chart now applies to these books. Run sync-chart.mjs to see what it would add;");
console.log("it will offer heads the chart has and the book does not, which is a decision to make");
console.log("against the circular, not something to accept blindly.");
