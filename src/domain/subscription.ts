/**
 * ZARODA BOOKS is sold as one payment per financial year per school level,
 * covering every book that level needs. The subscription is therefore keyed on
 * (org, level, financial year) — but the first school it is used for binds it,
 * and that binding is never released.
 *
 * The binding is the whole guard. Emptying a book, archiving it, or deleting
 * every entry leaves the binding standing, so a subscription cannot be freed by
 * copying the figures onto paper and starting again for a different school.
 */
export type SubscriptionDecision =
  | { allowed: true; /** The school to bind to, or null if already bound. */ bindTo: string | null }
  | { allowed: false; reason: string };

export function subscriptionDecision(
  subscription: { schoolId: string | null } | undefined,
  schoolId: string,
): SubscriptionDecision {
  if (!subscription) return { allowed: true, bindTo: schoolId };
  if (subscription.schoolId === null) return { allowed: true, bindTo: schoolId };
  if (subscription.schoolId === schoolId) return { allowed: true, bindTo: null };

  return {
    allowed: false,
    reason:
      "This year's subscription for this school level is already used by another school. "
      + "One payment covers every book for one school at one level, for one financial year. "
      + "A second school needs its own subscription.",
  };
}

/**
 * A school's identity within an org, now that NEMIS has been withdrawn and
 * KEMIS issues no school code. The name is all there is, so it is compared
 * with case, spacing and punctuation taken out — "Ong'ora Kakuru" and "Ongora
 * Kakuru" are one school, not two subscriptions.
 *
 * This only decides whether two books are the same school. Renaming is what
 * the guard has to hold, and that is refused once entries are posted.
 */
export const schoolNameKey = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
