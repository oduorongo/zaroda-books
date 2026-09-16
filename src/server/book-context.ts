import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { getBookForOrg, getFinancialYear, getVoteHeads } from "@/server/queries";

/** Everything a book's pages need, with the org check already applied. */
export async function loadBook(accountId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { account, school } = await getBookForOrg(accountId, user.orgId);
  const [heads, fy] = await Promise.all([
    getVoteHeads(accountId),
    getFinancialYear(accountId),
  ]);

  return { user, account, school, heads, fy };
}
