"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getCurrentUser, revokeSession, revokeSessions } from "@/server/auth";

export async function signOutDeviceAction(_prev: string | null, form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await revokeSession(user.id, String(form.get("sessionId") ?? ""));
  revalidatePath("/app/devices");
  return null;
}

/** Everything except the device doing the asking. */
export async function signOutOthersAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const token = (await cookies()).get("zb_session")?.value;
  await revokeSessions(user.id, token);
  revalidatePath("/app/devices");
}
