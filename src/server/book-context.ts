import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { getBookForOrg, getFinancialYear, getVoteHeads } from "@/server/queries";

/** Refused rather than silently ignored, so a view-as session cannot post. */
export class ReadOnlyError extends Error {
  constructor() {
    super("You are viewing this school's books as the system owner. Nothing can be posted or changed from here.");
    this.name = "ReadOnlyError";
  }
}

/**
 * Everything a book's pages need, with the org check already applied. Pass
 * `{ write: true }` from anything that is about to change the book: that is
 * where a read-only view-as session is stopped.
 */
export async function loadBook(accountId: string, opts: { write?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (opts.write && user.readOnly) throw new ReadOnlyError();

  const { account, school } = await getBookForOrg(accountId, user.orgId);
  const [heads, fy] = await Promise.all([
    getVoteHeads(accountId),
    getFinancialYear(accountId),
  ]);

  return { user, account, school, heads, fy };
}
