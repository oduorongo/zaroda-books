/**
 * Which set of books a person is looking at, when they belong to more than
 * one.
 *
 * A freelance accountant keeps their own practice and may also be invited to
 * a school that keeps its own books. Until now the session took whichever
 * membership the database happened to return first, so a second one was
 * refused outright rather than left to chance. This is what makes it safe to
 * allow.
 */

export interface Membership {
  id: string;
  orgId: string;
  role: "owner" | "accountant" | "bursar" | "viewer";
  schoolId: string | null;
  createdAt: Date;
}

export function chooseMembership(
  memberships: Membership[],
  preferredOrgId: string | undefined,
): Membership | undefined {
  if (memberships.length === 0) return undefined;

  // The preference is a request, never a grant: it only selects among the
  // memberships the person already holds.
  const asked = preferredOrgId
    ? memberships.find((m) => m.orgId === preferredOrgId)
    : undefined;
  if (asked) return asked;

  // Oldest first, so the same person lands in the same books every time
  // however the rows come back.
  return [...memberships].sort((a, b) => +a.createdAt - +b.createdAt)[0];
}
