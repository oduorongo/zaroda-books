"use server";

import { redirect } from "next/navigation";
import { acceptInvite } from "@/server/people";

export async function acceptAction(_prev: string | null, form: FormData): Promise<string | null> {
  try {
    await acceptInvite(String(form.get("code") ?? ""));
  } catch (e) {
    return e instanceof Error ? e.message : "That invitation could not be taken up.";
  }
  redirect("/app");
}
