"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/server/platform";
import { markAllSeen, markProblemSeen } from "@/server/problems";

export async function markSeenAction(_prev: string | null, form: FormData) {
  const admin = await requirePlatformAdmin();
  await markProblemSeen(String(form.get("problemId") ?? ""), admin.id);
  revalidatePath("/admin/problems");
  revalidatePath("/admin");
  return null;
}

export async function markAllSeenAction() {
  const admin = await requirePlatformAdmin();
  await markAllSeen(admin.id);
  revalidatePath("/admin/problems");
  revalidatePath("/admin");
}
