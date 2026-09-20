"use server";

import { redirect } from "next/navigation";
import { auditorScope, endViewAs, getCurrentUser } from "@/server/auth";

export async function endViewAsAction() {
  // Where to land depends on who was looking: an auditor has no console, and
  // /admin would 404 on them at the end of every school.
  const user = await getCurrentUser();
  const auditing = user ? await auditorScope(user.id) : null;
  await endViewAs();
  redirect(auditing ? "/audit" : "/admin");
}
