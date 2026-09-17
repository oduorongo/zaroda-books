/**
 * Adds vote heads that the circular has but an existing book does not, with
 * their rates for the current financial year. Books copy the chart once, when
 * they are opened, so a head added to the chart later — the junior tuition
 * TGR flat, for one — never reaches a book already in use.
 *
 * It only ever adds. Heads you added yourself, renamed heads and any rate you
 * have edited are left exactly as they are.
 *
 *   node --env-file=.env scripts/sync-chart.mjs          (preview)
 *   node --env-file=.env scripts/sync-chart.mjs --apply  (write)
 */
import { neon } from "@neondatabase/serverless";
import { CHART_OF_ACCOUNTS } from "../src/domain/vote-heads.ts";

const sql = neon(process.env.DATABASE_URL);
const apply = process.argv.includes("--apply");
// Rates are left alone unless asked for: a book may hold figures you edited
// yourself, and the circular of the day governs, not the chart in the code.
const withRates = process.argv.includes("--rates");

const kes = (c) => (Number(c) / 100).toLocaleString("en-KE", { minimumFractionDigits: 2 });

const books = await sql`
  select a.id as account_id, a.type, a.name as account, s.name as school, s.level,
         fy.id as fy_id, fy.label as fy
  from accounts a
  join schools s on s.id = a.school_id
  join financial_years fy on fy.account_id = a.id
  order by s.name, a.name, fy.label
`;

const additions = [];
const changes = [];

for (const b of books) {
  const chart = CHART_OF_ACCOUNTS[b.level]?.[b.type];
  if (!chart) continue;

  const existing = await sql`
    select vh.id, vh.code, vh."order", r.per_learner, r.flat_amount
    from vote_heads vh
    left join vote_head_rates r
      on r.vote_head_id = vh.id and r.financial_year_id = ${b.fy_id}
    where vh.account_id = ${b.account_id}
  `;
  const byCode = new Map(existing.map((h) => [h.code, h]));
  const maxOrder = existing.reduce((a, h) => Math.max(a, h.order), 0);

  let n = 0;
  for (const h of chart.heads) {
    const have = byCode.get(h.code);
    if (!have) {
      // Appended, never renumbered — the books keep the order the bursar knows.
      additions.push({ ...b, head: h, order: maxOrder + ++n });
      continue;
    }
    const wantRate = h.perLearner ?? 0;
    const wantFlat = h.flat ?? 0;
    if (!wantRate && !wantFlat) continue;
    if (Number(have.per_learner ?? 0) === wantRate && Number(have.flat_amount ?? 0) === wantFlat) continue;
    changes.push({
      ...b, head: h, voteHeadId: have.id,
      from: { rate: Number(have.per_learner ?? 0), flat: Number(have.flat_amount ?? 0) },
      to: { rate: wantRate, flat: wantFlat },
    });
  }
}

if (!additions.length && !changes.length) {
  console.log("Every book already matches the chart. Nothing to do.");
  process.exit(0);
}

for (const a of additions) {
  const rate = a.head.perLearner ? `${kes(a.head.perLearner)} per learner` : "";
  const flat = a.head.flat ? `${kes(a.head.flat)} flat` : "";
  console.log(
    `${a.school} · ${a.account} · FY ${a.fy}\n` +
    `    + ${a.head.code}  ${a.head.name}${rate || flat ? `  (${[rate, flat].filter(Boolean).join(", ")})` : ""}`,
  );
}

console.log(`\n${additions.length} vote head(s) to add.`);

if (changes.length) {
  const money = (rate, flat) =>
    [rate ? `${kes(rate)} per learner` : "", flat ? `${kes(flat)} flat` : ""]
      .filter(Boolean).join(", ") || "nothing";
  console.log(`\n${changes.length} rate(s) in a book differ from the chart:`);
  for (const c of changes) {
    console.log(
      `${c.school} · ${c.account} · FY ${c.fy}\n` +
      `    ${c.head.code}  ${money(c.from.rate, c.from.flat)}  ->  ${money(c.to.rate, c.to.flat)}`,
    );
  }
  if (!withRates) {
    console.log("\nRates are left as they are. Add --rates to bring them to the chart too.");
  }
}

if (!apply) {
  console.log("\nPreview only. Re-run with --apply to write the changes.");
  process.exit(0);
}

for (const a of additions) {
  const [head] = await sql`
    insert into vote_heads (account_id, code, name, "order")
    values (${a.account_id}, ${a.head.code}, ${a.head.name}, ${a.order})
    returning id
  `;
  if (a.head.perLearner || a.head.flat) {
    await sql`
      insert into vote_head_rates (financial_year_id, vote_head_id, per_learner, flat_amount)
      values (${a.fy_id}, ${head.id}, ${a.head.perLearner ?? 0}, ${a.head.flat ?? 0})
      on conflict (financial_year_id, vote_head_id) do nothing
    `;
  }
  console.log(`added ${a.head.code} to ${a.school} · ${a.account}`);
}

if (withRates) {
  for (const c of changes) {
    await sql`
      insert into vote_head_rates (financial_year_id, vote_head_id, per_learner, flat_amount)
      values (${c.fy_id}, ${c.voteHeadId}, ${c.to.rate}, ${c.to.flat})
      on conflict (financial_year_id, vote_head_id)
      do update set per_learner = ${c.to.rate}, flat_amount = ${c.to.flat}
    `;
    console.log(`updated ${c.head.code} in ${c.school} · ${c.account}`);
  }
}

console.log(`\nDone. ${additions.length} vote head(s) added${withRates ? `, ${changes.length} rate(s) updated` : ""}.`);
console.log("Open Vote heads in the affected book to check the figures against the circular.");
