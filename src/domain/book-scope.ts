import { auditorCanSee, describeAuditScope } from "./audit-scope";

/**
 * Which schools a session may reach, inside the org it is already scoped to.
 *
 * Three kinds, and they are not variations of one idea:
 *
 * - `org` — a member of the practice. Every school it keeps.
 * - `school` — a member tied to one school. A freelancer holding thirty
 *   schools can give each school's bursar their own books and nobody else's;
 *   without this, inviting one school's staff exposes all thirty.
 * - `area` — a Ministry auditor, by county or sub-county, and then only the
 *   books a school has sent them (see `bookAllows`).
 *
 * Tenancy still comes first: the org check happens before any of this, and
 * this only ever narrows.
 */
export type BookScope =
  | { kind: "org" }
  | { kind: "school"; schoolId: string }
  | { kind: "area"; grantId: string; county: string; subCounty: string | null };

export interface ScopedSchool {
  id: string;
  county: string | null;
  subCounty: string | null;
}

export function scopeAllows(scope: BookScope, school: ScopedSchool): boolean {
  switch (scope.kind) {
    case "org":
      return true;
    case "school":
      // By identity, not by place: a school with no county set is still the
      // school this person belongs to.
      return scope.schoolId === school.id;
    case "area":
      return auditorCanSee(scope, school);
  }
}

/**
 * Whether a session may open this book. For an auditor the school must be in
 * their area and the book sent to their grant: a school sends its books once
 * the year is closed, and taking them back — by reopening a month — hides them
 * again. The school's own people are not affected.
 */
export function bookAllows(
  scope: BookScope,
  school: ScopedSchool,
  account: { auditSentTo: string | null },
): boolean {
  if (!scopeAllows(scope, school)) return false;
  return scope.kind !== "area" || account.auditSentTo === scope.grantId;
}

/** A line naming the limit, or null when there is none to mention. */
export function describeScope(scope: BookScope): string | null {
  switch (scope.kind) {
    case "org":
      return null;
    case "school":
      // The caller knows the school's name; this only says a limit applies.
      return "One school only";
    case "area":
      return describeAuditScope(scope);
  }
}
