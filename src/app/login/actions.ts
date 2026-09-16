"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { endSession, startSession, verifyPassword } from "@/server/auth";

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return "Enter your email and password.";

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return "That email and password do not match.";
  }

  await startSession(user.id);
  redirect("/app");
}

export async function logout() {
  await endSession();
  redirect("/");
}
