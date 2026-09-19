/**
 * Makes an existing account a system owner of Zaroda Books: it may see every
 * org, manage subscriptions, and open any tenant's books read only.
 *
 * Deliberately not a form anywhere in the app. The only way in is this script,
 * run by someone who already holds the database URL.
 *
 *   node --env-file=.env scripts/grant-platform-admin.mjs you@example.com
 *   node --env-file=.env scripts/grant-platform-admin.mjs you@example.com --revoke
 *   node --env-file=.env scripts/grant-platform-admin.mjs --list
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const args = process.argv.slice(2);
const revoke = args.includes("--revoke");
const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();

if (args.includes("--list")) {
  const rows = await sql`
    select u.email, u.name, pa.created_at
    from platform_admins pa join users u on u.id = pa.user_id
    order by pa.created_at
  `;
  if (rows.length === 0) console.log("No system owners yet.");
  for (const r of rows) console.log(`${r.email}  ${r.name}  granted ${r.created_at.toISOString().slice(0, 10)}`);
  process.exit(0);
}

if (!email) {
  console.error("Give the email address of the account. See the top of this file.");
  process.exit(1);
}

const [user] = await sql`select id, name, email from users where email = ${email}`;
if (!user) {
  console.error(`No account with the email ${email}. Sign up first, then run this.`);
  process.exit(1);
}

if (revoke) {
  await sql`delete from platform_admins where user_id = ${user.id}`;
  console.log(`Revoked. ${user.email} is an ordinary user again, and any view-as session ends now.`);
} else {
  await sql`
    insert into platform_admins (user_id) values (${user.id})
    on conflict (user_id) do nothing
  `;
  console.log(`${user.name} <${user.email}> is now a system owner. Open /admin.`);
}
