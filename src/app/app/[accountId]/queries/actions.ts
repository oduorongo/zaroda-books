"use server";

import { revalidatePath } from "next/cache";
import { closeQuery, raiseQuery, replyToQuery } from "@/server/audit-queries";

const done = (accountId: string) => revalidatePath(`/app/${accountId}`, "layout");

export async function raiseQueryAction(_prev: string | null, form: FormData): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  try {
    await raiseQuery(accountId, String(form.get("transactionId") ?? "") || null, String(form.get("body") ?? ""));
  } catch (e) {
    return e instanceof Error ? e.message : "The query could not be raised.";
  }
  done(accountId);
  return "Raised.";
}

export async function replyAction(_prev: string | null, form: FormData): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  try {
    await replyToQuery(String(form.get("queryId") ?? ""), String(form.get("body") ?? ""));
  } catch (e) {
    return e instanceof Error ? e.message : "The reply could not be saved.";
  }
  done(accountId);
  return "Sent.";
}

export async function closeAction(_prev: string | null, form: FormData): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  try {
    await closeQuery(String(form.get("queryId") ?? ""));
  } catch (e) {
    return e instanceof Error ? e.message : "The query could not be closed.";
  }
  done(accountId);
  return null;
}
