/**
 * A Ministry auditor's query on a book, and the school's answers to it.
 *
 * Open is the school's turn, answered is the auditor's, closed is settled.
 * Only the auditor closes a query, and a closed query takes nothing more:
 * it is the record of what the audit settled. Queries are never deleted.
 */
export type QueryStatus = "open" | "answered" | "closed";
export type QueryParty = "auditor" | "school";

export const QUERY_STATUS_LABEL: Record<QueryStatus, string> = {
  open: "Open",
  answered: "Answered",
  closed: "Closed",
};

export function statusAfterMessage(
  status: QueryStatus,
  from: QueryParty,
): { status: QueryStatus; error?: undefined } | { status?: undefined; error: string } {
  if (status === "closed") return { error: "This query is closed. Nothing more can be added to it." };
  return { status: from === "school" ? "answered" : "open" };
}

export const closeRefusal = (status: QueryStatus): string | null =>
  status === "closed" ? "This query is already closed." : null;
