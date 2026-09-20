/**
 * One-off. The callback parser originally looked for `mpesa_receipt` and the
 * like, but Tuma sends `mpesa_receipt_number`, so successful payments recorded
 * no receipt number. The number is the evidence the money arrived, so it is
 * recovered here from the callback body, which was stored verbatim.
 *
 *   node --env-file=.env scripts/backfill-mpesa-receipts.mjs          (preview)
 *   node --env-file=.env scripts/backfill-mpesa-receipts.mjs --apply  (write)
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const apply = process.argv.includes("--apply");

const rows = await sql`
  select id, created_at, amount, callback_raw
  from subscription_payments
  where status = 'success' and mpesa_receipt is null and callback_raw is not null`;

if (rows.length === 0) {
  console.log("Nothing to backfill — every successful payment already has its receipt.");
  process.exit(0);
}

for (const r of rows) {
  let receipt = null;
  try {
    const b = JSON.parse(r.callback_raw);
    receipt = b.mpesa_receipt_number ?? b.mpesa_receipt ?? b.MpesaReceiptNumber
      ?? b.receipt_number ?? b.data?.mpesa_receipt_number ?? null;
  } catch { /* body was not json */ }

  if (!receipt) {
    console.log(`${r.id}  no receipt found in the stored callback — left alone`);
    continue;
  }
  console.log(`${r.id}  KSh ${(r.amount / 100).toFixed(2)}  ->  ${receipt}`);
  if (apply) {
    await sql`update subscription_payments set mpesa_receipt = ${receipt} where id = ${r.id}`;
  }
}

console.log(apply ? "\nWritten." : "\nPreview only. Re-run with --apply to write.");
