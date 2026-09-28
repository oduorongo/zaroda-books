"use server";

import { revalidatePath } from "next/cache";
import { emailQueryCode, replyByToken } from "@/server/audit-queries";

export async function queryCodeAction(_prev: string | null, form: FormData): Promise<string | null> {
  try {
    await emailQueryCode(String(form.get("token") ?? ""));
    return "Sent. Check your email for the six-digit code.";
  } catch (e) {
    return e instanceof Error ? e.message : "The code could not be sent.";
  }
}

export async function answerAction(_prev: string | null, form: FormData): Promise<string | null> {
  const token = String(form.get("token") ?? "");
  try {
    await replyByToken(token, String(form.get("code") ?? ""), String(form.get("body") ?? ""));
  } catch (e) {
    return e instanceof Error ? e.message : "Your answer could not be sent.";
  }
  revalidatePath(`/query/${token}`);
  return "Sent.";
}
