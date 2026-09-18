/**
 * One-off. Books opened before subscriptions existed have no subscription row,
 * so the record of what has been paid for starts empty and the binding that
 * guards it has nothing to stand on. This creates one row per
 * (org, level, financial year) already in use, bound to the school using it.
 *
 * It refuses to guess where two different schools already share a level and
 * year: only one of them can hold that subscription, and which one is a
 * business decision, not a script's.
 *
 *   node --env-file=.env scripts/backfill-subscriptions.mjs          (preview)
 *   node --env-file=.env scripts/backfill-subscriptions.mjs --apply  (write)
 */
import { neon } from "@neondatabase/serverless";
import { schoolNameKey } from "../src/domain/subscription.ts";

const sql = neon(process.env.DATABASE_URL);
const apply = process.argv.includes("--apply");

const books = await sql`
  select s.org_id, s.id as school_id, s.name as school, s.level, s.name_key,
         fy.label as fy, a.name as account
  from accounts a
  join schools s on s.id = a.school_id
  join financial_years fy on fy.account_id = a.id
  order by s.level, fy.label, s.name`;

// Schools opened before the name became the identity have no name key.
const schools = await sql`select id, org_id, name, level, name_key from schools`;
const needKey = schools.filter((s) => !s.name_key);
const keyClashes = [];
const byKey = new Map();
for (const s of schools) {
  const key = `${s.org_id}|${s.level}|${s.name_key ?? schoolNameKey(s.name)}`;
  const other = byKey.get(key);
  if (other) keyClashes.push(`${s.name} and ${other.name} read as the same school (${s.level})`);
  else byKey.set(key, s);
}

if (keyClashes.length) {
  console.log("NOT backfilled — these would collide as one school:");
  for (const c of keyClashes) console.log(`  ${c}`);
  console.log("Rename one of them in Book settings first.\n");
  process.exit(1);
}

if (needKey.length) {
  console.log(`${needKey.length} school(s) need a name key:`);
  for (const s of needKey) console.log(`  ${s.name} (${s.level}) -> ${schoolNameKey(s.name)}`);
  console.log("");
}

const existing = await sql`select org_id, level, fy_label, school_id from subscriptions`;
const held = new Map(existing.map((s) => [`${s.org_id}|${s.level}|${s.fy_label}`, s.school_id]));

const wanted = new Map();
const clashes = [];

for (const b of books) {
  const key = `${b.org_id}|${b.level}|${b.fy}`;
  const alreadyHeld = held.get(key);
  if (alreadyHeld && alreadyHeld !== b.school_id) {
    clashes.push(`${b.school} (${b.level} ${b.fy}) — that subscription is already bound elsewhere`);
    continue;
  }
  if (alreadyHeld) continue;

  const claimed = wanted.get(key);
  if (claimed && claimed.school_id !== b.school_id) {
    clashes.push(`${b.school} and ${claimed.school} both use ${b.level} ${b.fy}`);
    continue;
  }
  wanted.set(key, b);
}

if (clashes.length) {
  console.log("NOT backfilled — one subscription cannot cover two schools:");
  for (const c of clashes) console.log(`  ${c}`);
  console.log("");
}

if (!wanted.size && !needKey.length) {
  console.log("Nothing to backfill.");
  process.exit(0);
}

for (const b of wanted.values()) {
  console.log(`${b.level} ${b.fy} -> ${b.school}`);
}
console.log(`\n${wanted.size} subscription(s) to create.`);

if (!apply) {
  console.log("\nPreview only. Re-run with --apply to write them.");
  process.exit(0);
}

for (const s of needKey) {
  await sql`update schools set name_key = ${schoolNameKey(s.name)} where id = ${s.id}`;
  console.log(`keyed ${s.name}`);
}

for (const b of wanted.values()) {
  await sql`
    insert into subscriptions (org_id, level, fy_label, school_id, bound_at)
    values (${b.org_id}, ${b.level}, ${b.fy}, ${b.school_id}, now())
    on conflict (org_id, level, fy_label) do nothing`;
  console.log(`created ${b.level} ${b.fy} -> ${b.school}`);
}

console.log(`\nDone. ${wanted.size} subscription(s) created.`);
