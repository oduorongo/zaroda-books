"use server";

import { redirect } from "next/navigation";
import { passwordProblem } from "@/domain";
import { completePasswordReset } from "@/server/password-reset";

export async function resetAction(_prev: string | null, form: FormData): Promise<string | null> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const again = String(form.get("again") ?? "");

  const problem = passwordProblem(password, again);
  if (problem) return problem;

  try {
    await completePasswordReset(token, password);
  } catch (e) {
    return e instanceof Error ? e.message : "The password could not be changed.";
  }
  redirect("/login?reset=1");
}
