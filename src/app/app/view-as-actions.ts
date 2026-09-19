"use server";

import { redirect } from "next/navigation";
import { endViewAs } from "@/server/auth";

export async function endViewAsAction() {
  await endViewAs();
  redirect("/admin");
}
