import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { getOrgBooks } from "@/server/queries";

export default async function AppIndex() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const books = await getOrgBooks(user.orgId);
  redirect(books.length ? `/app/${books[0].account.id}/receipts` : "/app/new");
}
