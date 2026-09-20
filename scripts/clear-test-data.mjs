/**
 * One-off. Removes the payments and books created while setting Tuma up, so
 * the revenue figures do not open with transactions that were never sales.
 *
 * Only the rows listed below are touched. Nothing is matched by guesswork:
 * every id was read off the database and confirmed before being put here.
 *
 *   node --env-file=.env scripts/clear-test-data.mjs          (preview)
 *   node --env-file=.env scripts/clear-test-data.mjs --apply  (write)
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const apply = process.argv.includes("--apply");

/** Every payment attempt made while configuring the gateway. */
const PAYMENTS = [
  "953c600e-816f-4e36-ab04-f5d93f0ceccc", // failed, KSh 480, pre-credentials
  "cec3deae-66af-43bc-a6f5-ced6bbdfa1ee", // failed, KSh 480, pre-credentials
  "3e37d338-456c-4223-a730-594610c701d0", // sandbox success, KSh 1, UIKGT7Y2XK
  "c8d7bc67-3f95-402d-92b7-d0516922dfb3", // production test, KSh 480, UIKPD72S5Q
];

/** The subscriptions those two successes opened. Both are unbound: no book
 *  was ever opened against them, so nothing is taken away by removing them. */
const SUBSCRIPTIONS = [
  "2102225b-43a1-425f-b68b-1058c08c2d9d", // Zaroda, 2026/27 primary, from the KSh 1 test
  "51b07fd7-acf5-4eb0-a6b3-849bb86e0319", // ONGO ENTERPRISES, 2027/28 primary, from the KSh 480 test
];

/** Books to remove entirely, with their entries, periods and vote heads. */
const ACCOUNTS = [
  "f4c9c8e4-aa03-466c-a119-65d5be4310a9", // Peter Oduor Ongo — "Test" senior, Boarding 2026/27
];

/**
 * Whole tenants to remove: the account shared with Tuma for their review.
 *
 * Guarded — an org holding any book is refused outright. A school's entries
 * are the one thing in here that cannot be reconstructed, so no list of ids
 * gets to destroy them by accident.
 */
const ORGS = [
  "75610a7e-5aab-441d-8929-386b051491c0", // Zaroda — zarodatest@gmail.com, given to Tuma
];

async function describe() {
  for (const id of PAYMENTS) {
    const [r] = await sql`select amount, status, mpesa_receipt from subscription_payments where id = ${id}`;
    console.log(r ? `  payment    KSh ${(r.amount / 100).toFixed(2)} ${r.status} ${r.mpesa_receipt ?? ""}` : `  payment    ${id} already gone`);
  }
  for (const id of SUBSCRIPTIONS) {
    const [r] = await sql`select level, fy_label, school_id from subscriptions where id = ${id}`;
    if (!r) { console.log(`  sub        ${id} already gone`); continue; }
    if (r.school_id) {
      console.log(`  sub        ${r.fy_label} ${r.level} IS BOUND TO A SCHOOL — will be skipped`);
      continue;
    }
    console.log(`  sub        ${r.fy_label} ${r.level} (unbound)`);
  }
  for (const id of ACCOUNTS) {
    const [r] = await sql`
      select a.name, s.name as school, s.id as school_id from accounts a
      join schools s on s.id = a.school_id where a.id = ${id}`;
    if (!r) { console.log(`  book       ${id} already gone`); continue; }
    const [{ n }] = await sql`
      select count(*)::int n from transactions t
      join periods p on p.id = t.period_id
      join financial_years f on f.id = p.financial_year_id
      where f.account_id = ${id}`;
    const [{ others }] = await sql`
      select count(*)::int others from accounts where school_id = ${r.school_id} and id <> ${id}`;
    console.log(`  book       ${r.school} — ${r.name}, ${n} entr${n === 1 ? "y" : "ies"}`
      + (others === 0 ? " (its school goes too — no other books)" : ` (school kept, ${others} other book(s))`));
  }
}

async function describeOrgs() {
  for (const id of ORGS) {
    const [o] = await sql`select name from orgs where id = ${id}`;
    if (!o) { console.log(`  org        ${id} already gone`); continue; }
    const [{ books }] = await sql`
      select count(*)::int books from accounts a
      join schools s on s.id = a.school_id where s.org_id = ${id}`;
    const people = await sql`
      select u.email from memberships m join users u on u.id = m.user_id where m.org_id = ${id}`;
    if (books > 0) {
      console.log(`  org        ${o.name} HOLDS ${books} BOOK(S) — will be skipped`);
      continue;
    }
    console.log(`  org        ${o.name} and its user(s): ${people.map((p) => p.email).join(", ")}`);
  }
}

console.log(apply ? "REMOVING:" : "WOULD REMOVE:");
await describe();
await describeOrgs();

if (!apply) {
  console.log("\nPreview only. Re-run with --apply to write.");
  process.exit(0);
}

for (const id of PAYMENTS) {
  await sql`delete from subscription_payments where id = ${id}`;
}

// A bound subscription is left alone even if listed: removing one would take
// an entitlement away from a school that is using it.
for (const id of SUBSCRIPTIONS) {
  await sql`delete from subscriptions where id = ${id} and school_id is null`;
}

for (const id of ACCOUNTS) {
  const [acct] = await sql`select school_id from accounts where id = ${id}`;
  if (!acct) continue;

  // Innermost first: allocations hang off transactions, transactions off
  // periods, periods off the financial year, and the year off the account.
  await sql`
    delete from allocations where transaction_id in (
      select t.id from transactions t
      join periods p on p.id = t.period_id
      join financial_years f on f.id = p.financial_year_id
      where f.account_id = ${id})`;
  await sql`
    delete from transactions where period_id in (
      select p.id from periods p
      join financial_years f on f.id = p.financial_year_id
      where f.account_id = ${id})`;
  await sql`
    delete from periods where financial_year_id in (
      select id from financial_years where account_id = ${id})`;
  await sql`
    delete from vote_head_rates where financial_year_id in (
      select id from financial_years where account_id = ${id})`;
  await sql`delete from financial_years where account_id = ${id}`;
  await sql`update subscription_payments set created_account_id = null where created_account_id = ${id}`;
  await sql`delete from vote_heads where account_id = ${id}`;
  await sql`delete from accounts where id = ${id}`;

  // The school only exists to hold books. With none left it is a dangling
  // name that would still block its own reuse through the name key.
  const [{ left }] = await sql`select count(*)::int left from accounts where school_id = ${acct.school_id}`;
  if (left === 0) {
    await sql`update subscriptions set school_id = null, bound_at = null where school_id = ${acct.school_id}`;
    await sql`delete from enrolments where school_id = ${acct.school_id}`;
    await sql`delete from schools where id = ${acct.school_id}`;
  }
}

for (const id of ORGS) {
  const [{ books }] = await sql`
    select count(*)::int books from accounts a
    join schools s on s.id = a.school_id where s.org_id = ${id}`;
  if (books > 0) continue; // Guarded above; never destroy a book this way.

  const people = await sql`select user_id from memberships where org_id = ${id}`;

  await sql`delete from subscription_payments where org_id = ${id}`;
  await sql`delete from subscriptions where org_id = ${id}`;
  await sql`delete from audit_log where org_id = ${id}`;
  await sql`delete from enrolments where school_id in (select id from schools where org_id = ${id})`;
  await sql`delete from schools where org_id = ${id}`;
  await sql`delete from memberships where org_id = ${id}`;
  await sql`delete from orgs where id = ${id}`;

  // The user goes too, but only if this org was the only one they belonged to
  // — an email is unique, so leaving it behind would block signing up again.
  for (const { user_id: userId } of people) {
    const [{ n }] = await sql`select count(*)::int n from memberships where user_id = ${userId}`;
    if (n > 0) continue;
    await sql`delete from platform_admins where user_id = ${userId}`;
    await sql`update audit_log set user_id = null where user_id = ${userId}`;
    await sql`delete from users where id = ${userId}`;
  }
}

console.log("\nRemoved.");
