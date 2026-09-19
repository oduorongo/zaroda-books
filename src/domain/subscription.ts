import { priceLabel } from "./pricing";
import type { SchoolLevel } from "./vote-heads";

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

/**
 * Whether a book may be opened at all, which is the subscription question plus
 * the free allowance in front of it.
 *
 * A tenant's first school is free: one level, one financial year, every account
 * that school needs. It is granted once per org and never again — a second
 * level, or the same school in a later year, is paid for like any other.
 *
 * An existing subscription always lets the book open, paid or not. The only row
 * that can exist unpaid without the grant is one entered by hand after money
 * changed hands, and a school is not locked out of its own books over the gap
 * between paying and that being recorded.
 */
export type Entitlement =
  | { allowed: true; bindTo: string | null; grantFree: boolean }
  | { allowed: false; reason: string };

export function bookEntitlement(input: {
  subscription: { schoolId: string | null } | undefined;
  freeAllowanceUsed: boolean;
  /** Whether Zaroda has reviewed this org. Gates the free school, nothing else. */
  orgApproved: boolean;
  level: SchoolLevel;
  fyLabel: string;
  schoolId: string;
}): Entitlement {
  if (input.subscription) {
    const decision = subscriptionDecision(input.subscription, input.schoolId);
    return decision.allowed
      ? { allowed: true, bindTo: decision.bindTo, grantFree: false }
      : decision;
  }

  if (!input.freeAllowanceUsed) {
    // Only the free school waits on approval. A subscription, handled above,
    // was entered after payment and is not held a second time.
    if (!input.orgApproved) {
      return {
        allowed: false,
        reason:
          "Your account is with us for review, and your free school opens as soon as "
          + "that is done — usually the same working day. Nothing you have entered is "
          + "lost. Reach us on WhatsApp 0781 230 805 or info@zarodasolutions.com.",
      };
    }
    return { allowed: true, bindTo: input.schoolId, grantFree: true };
  }

  return {
    allowed: false,
    reason:
      `Opening a ${input.level} book for ${input.fyLabel} needs a subscription: `
      + `KSh ${priceLabel(input.level)} for the year, covering every account that `
      + "school keeps at that level. Your free school has already been used. "
      + "Talk to us and we will open it for you.",
  };
}
