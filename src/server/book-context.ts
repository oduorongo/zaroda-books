import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { ROLE_LABEL, can, type Action, type Role } from "@/domain";
import { getBookForOrg, getFinancialYear, getVoteHeads } from "@/server/queries";

/** Refused rather than silently ignored, so a view-as session cannot post. */
export class ReadOnlyError extends Error {
  constructor() {
    super("You are viewing this school's books as the system owner. Nothing can be posted or changed from here.");
    this.name = "ReadOnlyError";
  }
}

/** What a role may not do. Shown to the person, so it names the role. */
export class ForbiddenError extends Error {
  constructor(role: Role, what: string) {
    super(`A ${ROLE_LABEL[role].toLowerCase()} cannot ${what}. Ask the owner of these books.`);
    this.name = "ForbiddenError";
  }
}

const WHAT: Record<Action, string> = {
  "entry.post": "post entries",
  "entry.amend": "amend an entry",
  "entry.delete": "delete an entry",
  "period.close": "close a month",
  "period.reopen": "reopen a closed month",
  "voteHead.manage": "change the vote heads",
  "openingBalances.set": "set the opening balances",
  "school.edit": "change the school",
  "financialYear.change": "change the financial year",
  "book.archive": "archive a book",
  "book.create": "open a book",
  "subscription.pay": "pay the subscription",
  "people.manage": "manage who has access",
};

/**
 * Everything a book's pages need, with the org check already applied.
 *
 * Pass `{ write: true }` from anything about to change the book — that stops
 * a read-only session — and `{ require: "entry.delete" }` where the action is
 * one only some roles may take. Every write already routes through here, so
 * this is the one place the matrix has to be applied.
 */
export async function loadBook(
  accountId: string,
  opts: { write?: boolean; require?: Action } = {},
) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (opts.write && user.readOnly) throw new ReadOnlyError();
  if (opts.require && !can(user.role, opts.require)) {
    throw new ForbiddenError(user.role, WHAT[opts.require]);
  }

  const { account, school } = await getBookForOrg(accountId, user.orgId, user.bookScope);
  const [heads, fy] = await Promise.all([
    getVoteHeads(accountId),
    getFinancialYear(accountId),
  ]);

  return { user, account, school, heads, fy };
}
