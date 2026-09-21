"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { chooseOrg, getCurrentUser } from "@/server/auth";

export async function switchOrgAction(orgId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // chooseOrg only records a preference; getCurrentUser refuses to honour one
  // for books the person does not belong to.
  await chooseOrg(orgId);
  revalidatePath("/app", "layout");
}
