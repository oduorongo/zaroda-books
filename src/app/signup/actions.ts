"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashPassword, startSession } from "@/server/auth";

export async function signup(_prev: string | null, form: FormData): Promise<string | null> {
  const name = String(form.get("name") ?? "").trim();
  const practice = String(form.get("practice") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!name || !email || !password) return "Fill in your name, email and password.";
  if (password.length < 10) return "The password must be at least 10 characters.";

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (existing) return "That email already has an account. Log in instead.";

  const [org] = await db.insert(schema.orgs).values({ name: practice || name }).returning();
  const [user] = await db.insert(schema.users).values({
    email, name, passwordHash: hashPassword(password),
  }).returning();
  await db.insert(schema.memberships).values({ orgId: org.id, userId: user.id, role: "owner" });

  await startSession(user.id);
  redirect("/app");
}
