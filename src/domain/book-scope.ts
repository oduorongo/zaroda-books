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
 * - `area` — a Ministry auditor, by county or sub-county.
 *
 * Tenancy still comes first: the org check happens before any of this, and
 * this only ever narrows.
 */
export type BookScope =
  | { kind: "org" }
  | { kind: "school"; schoolId: string }
  | { kind: "area"; county: string; subCounty: string | null };

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
