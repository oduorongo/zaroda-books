/**
 * Who may do what.
 *
 * Roles existed in the schema from the beginning but were enforced nowhere —
 * the word was printed in the sidebar and a viewer could delete payments. In
 * an accounting system that is a segregation-of-duties failure, so the matrix
 * now lives here as an executable rule with a test per role per action.
 *
 * Reading is not in the matrix. Everyone in an org reads its books; what a
 * person may *see* is decided by tenancy, not by role.
 */

export const ROLES = ["owner", "accountant", "bursar", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export type Action =
  | "entry.post"
  | "entry.amend"
  | "entry.delete"
  | "period.close"
  | "period.reopen"
  | "voteHead.manage"
  | "openingBalances.set"
  | "school.edit"
  | "financialYear.change"
  | "book.archive"
  | "book.create"
  | "subscription.pay"
  | "people.manage"
  | "letter.edit"
  | "auditQuery.answer";

const MATRIX: Record<Action, readonly Role[]> = {
  // The daily work of a bursar.
  "entry.post": ["owner", "accountant", "bursar"],
  "entry.amend": ["owner", "accountant", "bursar"],

  // Deleting removes the trail that amending leaves, so it stops at the
  // accountant.
  "entry.delete": ["owner", "accountant"],

  // Closing freezes the figures and carries the balance forward: a sign-off,
  // not a posting.
  "period.close": ["owner", "accountant"],

  // Unfreezing a closed month is the most audit-sensitive act in the app.
  "period.reopen": ["owner"],

  "voteHead.manage": ["owner", "accountant"],
  "openingBalances.set": ["owner", "accountant"],

  // The school's name carries its subscription; the financial year sets which
  // months exist. Both belong to whoever answers for the books.
  "school.edit": ["owner"],
  "financialYear.change": ["owner"],
  "book.archive": ["owner"],
  "book.create": ["owner"],
  "subscription.pay": ["owner"],
  "people.manage": ["owner"],

  // The addresses, signatory and bank details the capitation letter reuses.
  // Whoever posts the receipts keeps them up to date.
  "letter.edit": ["owner", "accountant", "bursar"],

  // Whoever keeps the books answers the auditor for them. A viewer only reads.
  "auditQuery.answer": ["owner", "accountant", "bursar"],
};

/** Unknown roles are refused: a permission check must never default open. */
export const can = (role: Role, action: Action): boolean =>
  MATRIX[action]?.includes(role) ?? false;

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  accountant: "Accountant",
  bursar: "Bursar",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: "Everything, including opening books, reopening closed months and inviting people.",
  accountant: "Posts, amends and deletes entries, closes months, manages vote heads.",
  bursar: "Posts and amends entries. Cannot delete one, or close a month.",
  viewer: "Reads and prints. Changes nothing.",
};
