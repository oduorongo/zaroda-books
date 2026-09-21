"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { endSession, startSession, verifyPassword } from "@/server/auth";
import { describeWait } from "@/domain";
import {
  checkLoginAllowed, clearLoginFailures, recordLoginFailure,
} from "@/server/login-throttle";

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return "Enter your email and password.";

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  // Checked before the password is even looked at, so a blocked address
  // cannot keep guessing and cannot learn anything from how long we take.
  const throttle = await checkLoginAllowed(email, ip);
  if (throttle.blocked) {
    return (
      "Too many attempts. Try again "
      + `${describeWait(throttle.retryAfterSeconds)}, `
      + "or reset your password."
    );
  }

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!user || !verifyPassword(password, user.passwordHash)) {
    await recordLoginFailure(email, ip);
    return "That email and password do not match.";
  }

  await clearLoginFailures(email);
  await startSession(user.id);
  redirect("/app");
}

export async function logout() {
  await endSession();
  redirect("/");
}
