/**
 * What a sub-county auditor may see.
 *
 * This is the whole boundary. An auditor is the first thing other than Zaroda
 * itself allowed to read across orgs, and this function decides every school
 * they reach — so it is pure, it lives here, and it is tested before anything
 * calls it.
 *
 * It answers only "is this school in their area". Whether they may write is
 * settled elsewhere, and the answer there is always no.
 */

export interface AuditScope {
  county: string;
  /** Null means the whole county. */
  subCounty: string | null;
}

export interface Placed {
  county: string | null;
  subCounty: string | null;
}

/** Names are typed by hand in two different forms, so compare them loosely. */
const same = (a: string | null, b: string | null): boolean =>
  a !== null && b !== null && a.trim().toLowerCase() === b.trim().toLowerCase();

export function auditorCanSee(scope: AuditScope, school: Placed): boolean {
  // A school with no county is in nobody's area. Defaulting the other way
  // would hand every unplaced school to whichever auditor asked first.
  if (!school.county) return false;
  if (!same(scope.county, school.county)) return false;
  if (scope.subCounty === null) return true;
  return same(scope.subCounty, school.subCounty);
}

export const describeAuditScope = (scope: AuditScope): string =>
  scope.subCounty
    ? `${scope.subCounty}, ${scope.county} County`
    : `All of ${scope.county} County`;
