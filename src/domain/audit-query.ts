import { can, type Role } from "./permissions";
import type { Position } from "./positions";
import { mayAuthorise } from "./authorisation";

/**
 * A Ministry auditor's query on a book, and the school's answers to it.
 *
 * Open is the school's turn, answered is the auditor's, closed is settled.
 * Only the auditor closes a query, and a closed query takes nothing more:
 * it is the record of what the audit settled. Queries are never deleted.
 */
export type QueryStatus = "open" | "answered" | "closed";
export type QueryParty = "auditor" | "school" | "hoi";
/** Who the auditor wants the answer from: whoever keeps the books, or the head of institution. */
export type QueryAddressee = "school" | "hoi";

export const QUERY_STATUS_LABEL: Record<QueryStatus, string> = {
  open: "Open",
  answered: "Answered",
  closed: "Closed",
};

export function statusAfterMessage(
  status: QueryStatus,
  from: QueryParty,
  addressedTo: QueryAddressee = "school",
): { status: QueryStatus; error?: undefined } | { status?: undefined; error: string } {
  if (status === "closed") return { error: "This query is closed. Nothing more can be added to it." };
  if (from === "auditor") return { status: "open" };
  // On a query for the head, only the head answers; the bookkeeper may add
  // information without it counting as the head's answer.
  if (addressedTo === "hoi") return { status: from === "hoi" ? "answered" : status };
  return { status: "answered" };
}

/**
 * Which side a signed-in person answers on: the head on a query addressed
 * to them, the bookkeeper otherwise. An authoriser is there for the head's
 * queries only.
 */
export function queryPartyFor(
  who: { role: Role; position: Position | null },
  addressedTo: QueryAddressee,
): QueryParty | null {
  if (addressedTo === "hoi" && mayAuthorise(who.role, who.position)) return "hoi";
  return can(who.role, "auditQuery.answer") ? "school" : null;
}

export const REMINDER_DAYS = 7;

/** A query waiting on the head is chased every seven days it sits unanswered. */
export function reminderDue(q: { lastActivity: Date; remindedAt: Date | null; now: Date }): boolean {
  const since = Math.max(+q.lastActivity, q.remindedAt ? +q.remindedAt : 0);
  return +q.now - since >= REMINDER_DAYS * 86_400_000;
}

export const closeRefusal = (status: QueryStatus): string | null =>
  status === "closed" ? "This query is already closed." : null;
