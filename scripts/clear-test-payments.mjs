/**
 * One-off. Clears the wreckage of setting Tuma up: the subscription opened by
 * a one-shilling sandbox test, and the failed payment rows from before the
 * credentials worked.
 *
 * It only ever touches a subscription that has no book opened against it. One
 * that is bound to a school is left alone and reported — removing it would
 * take away an entitlement someone is using.
 *
 *   node --env-file=.env scripts/clear-test-payments.mjs          (preview)
 *   node --env-file=.env scripts/clear-test-payments.mjs --apply  (write)
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const apply = process.argv.includes("--apply");

// Failed attempts: nothing was ever charged, so nothing is lost with them.
const junk = await sql`
  select id, created_at, amount, level, fy_label
  from subscription_payments where status = 'failed' order by created_at`;

console.log(`Failed payment rows to remove: ${junk.length}`);
for (const r of junk) {
  console.log(`   ${r.created_at.toISOString().slice(0, 19)}  KSh ${(r.amount / 100).toFixed(2)}  ${r.level} ${r.fy_label}`);
}

// The sandbox test: a success for a token amount, which bought nothing real.
const tests = await sql`
  select id, created_at, amount, level, fy_label, mpesa_receipt
  from subscription_payments where status = 'success' and amount < 10000`;

console.log(`\nToken-amount successes to remove: ${tests.length}`);
for (const r of tests) {
  console.log(`   ${r.created_at.toISOString().slice(0, 19)}  KSh ${(r.amount / 100).toFixed(2)}  ${r.level} ${r.fy_label}  ${r.mpesa_receipt ?? ""}`);
}

const levels = [...new Set(tests.map((t) => `${t.level}|${t.fy_label}`))];
const subsToCheck = [];
for (const key of levels) {
  const [level, fyLabel] = key.split("|");
  const rows = await sql`
    select id, level, fy_label, school_id, is_free, paid_at
    from subscriptions where level = ${level} and fy_label = ${fyLabel} and is_free = false`;
  subsToCheck.push(...rows);
}

console.log(`\nSubscriptions opened by those tests: ${subsToCheck.length}`);
const removable = [];
for (const s of subsToCheck) {
  const [{ n }] = await sql`
    select count(*)::int as n from accounts a
    join schools sc on sc.id = a.school_id
    where sc.id = ${s.school_id}`.catch(() => [{ n: 0 }]);
  if (s.school_id) {
    console.log(`   ${s.fy_label} ${s.level}: BOUND to a school with ${n} book(s) — left alone`);
  } else {
    console.log(`   ${s.fy_label} ${s.level}: unbound, no books — will remove`);
    removable.push(s.id);
  }
}

if (apply) {
  for (const r of [...junk, ...tests]) {
    await sql`delete from subscription_payments where id = ${r.id}`;
  }
  for (const id of removable) {
    await sql`delete from subscriptions where id = ${id}`;
  }
  console.log("\nRemoved.");
} else {
  console.log("\nPreview only. Re-run with --apply to write.");
}
