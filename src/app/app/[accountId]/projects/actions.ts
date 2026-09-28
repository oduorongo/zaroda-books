"use server";

import { revalidatePath } from "next/cache";
import { attachProjectLetter, removeProjectLetter } from "@/server/documents";

export async function attachLetterAction(_prev: string | null, form: FormData): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return "Choose the SCDE approval to attach.";
  try {
    await attachProjectLetter(accountId, String(form.get("project") ?? ""), file);
  } catch (e) {
    return e instanceof Error ? e.message : "The approval could not be attached.";
  }
  revalidatePath(`/app/${accountId}`, "layout");
  return null;
}

export async function removeLetterAction(_prev: string | null, form: FormData): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  try {
    await removeProjectLetter(accountId, String(form.get("letterId") ?? ""));
  } catch (e) {
    return e instanceof Error ? e.message : "The approval could not be removed.";
  }
  revalidatePath(`/app/${accountId}`, "layout");
  return null;
}
