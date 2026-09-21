"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashPassword, startSession } from "@/server/auth";
import { isSubCountyOf } from "@/domain";
import { notifyNewTenant } from "@/server/notify";

export async function signup(_prev: string | null, form: FormData): Promise<string | null> {
  const name = String(form.get("name") ?? "").trim();
  const practice = String(form.get("practice") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  const county = String(form.get("county") ?? "").trim();
  const subCounty = String(form.get("subCounty") ?? "").trim();

  if (!name || !email || !password) return "Fill in your name, email and password.";
  if (password.length < 10) return "The password must be at least 10 characters.";
  // Checked as a pair, not as two fields: the browser can be made to post any
  // combination, and a mismatched one would land in the coverage figures.
  if (!isSubCountyOf(county, subCounty)) return "Choose your county and sub-county.";

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (existing) return "That email already has an account. Log in instead.";

  const [org] = await db.insert(schema.orgs)
    .values({
      name: practice || name,
      county,
      subCounty,
      // Approved on creation. The column stays so an account can still be
      // put on hold from the console, but nobody now waits to be let in.
      approvedAt: new Date(),
    })
    .returning();
  const [user] = await db.insert(schema.users).values({
    email, name, passwordHash: hashPassword(password),
  }).returning();
  await db.insert(schema.memberships).values({ orgId: org.id, userId: user.id, role: "owner" });

  // Before the redirect, because redirect() throws to unwind. Awaited, but
  // notifyOwner swallows its own failures: a signup must not fail because we
  // could not send ourselves a note.
  await notifyNewTenant({
    orgId: org.id,
    orgName: org.name,
    personName: name,
    email,
    county,
    subCounty,
  });

  await startSession(user.id);
  redirect("/app");
}
