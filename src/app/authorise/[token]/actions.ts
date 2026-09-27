"use server";

import { readDecisions } from "@/domain";
import { decideByEmail, emailCode } from "@/server/authorisation";

export async function emailCodeAction(_prev: string | null, form: FormData): Promise<string | null> {
  try {
    await emailCode(String(form.get("token") ?? ""));
    return "Sent. Check your email for the six-digit code.";
  } catch (e) {
    return e instanceof Error ? e.message : "The code could not be sent.";
  }
}

export type DecideState = { error?: string; done?: { authorised: number; held: number } } | null;

export async function decideAction(_prev: DecideState, form: FormData): Promise<DecideState> {
  const decisions = readDecisions(
    String(form.get("ids") ?? "").split(",").filter(Boolean),
    (k) => form.get(k) as string | null,
  );
  try {
    await decideByEmail(String(form.get("token") ?? ""), String(form.get("code") ?? ""), decisions);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The authorisation could not be saved." };
  }
  return {
    done: {
      authorised: decisions.filter((d) => d.decision === "authorised").length,
      held: decisions.filter((d) => d.decision === "held").length,
    },
  };
}
