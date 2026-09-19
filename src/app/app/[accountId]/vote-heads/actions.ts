"use server";

import { revalidatePath } from "next/cache";
import { loadBook } from "@/server/book-context";
import { addVoteHead } from "@/server/vote-heads";

export async function addVoteHeadAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  await loadBook(accountId, { write: true });

  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const name = String(form.get("name") ?? "").trim();

  if (!/^[A-Z0-9]{2,6}$/.test(code)) return "The code is 2 to 6 letters or digits, such as SEC.";
  if (!name) return "Give the vote head a name.";

  try {
    await addVoteHead(accountId, code, name);
  } catch (e) {
    return (e as Error).message;
  }

  revalidatePath(`/app/${accountId}/vote-heads`);
  return null;
}
