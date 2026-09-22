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
 * A tenant's first BOOK is free: one account, at one level, for one financial
 * year, granted once per org and never again. A second book at that same
 * level needs the subscription — and paying absorbs the free one, so the
 * subscription then covers every account at that level as it always did.
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
  subscription: { schoolId: string | null; paidAt: Date | null; isFree: boolean } | undefined;
  freeAllowanceUsed: boolean;
  /** Whether Zaroda has reviewed this org. Gates the free school, nothing else. */
  orgApproved: boolean;
  level: SchoolLevel;
  fyLabel: string;
  schoolId: string;
}): Entitlement {
  if (input.subscription) {
    const decision = subscriptionDecision(input.subscription, input.schoolId);
    if (!decision.allowed) return decision;

    // The free grant is one book, not a whole level. Paying absorbs it: the
    // subscription then covers every account at that level, the free one
    // included, so nobody is left with a book outside what they bought.
    //
    // A row with isFree && !paidAt can only exist because the free book was
    // already granted — the database allows at most one such row per org
    // (subscriptions_one_free_per_org), so the row's mere existence is the
    // whole proof, and does not need a second, racy count of open books.
    const freeAndSpent = input.subscription.isFree && input.subscription.paidAt === null;
    if (freeAndSpent) return needsSubscription(input.level, input.fyLabel);

    return { allowed: true, bindTo: decision.bindTo, grantFree: false };
  }

  if (!input.freeAllowanceUsed) {
    // Only the free school waits on approval. A subscription, handled above,
    // was entered after payment and is not held a second time.
    // Accounts are approved the moment they are created. This only bites
    // where Zaroda has put one on hold.
    if (!input.orgApproved) {
      return {
        allowed: false,
        reason:
          "These books are on hold. Reach us on WhatsApp 0781 230 805 or "
          + "support@zarodabooks.com and we will sort it out. Nothing you have "
          + "entered is lost.",
      };
    }
    return { allowed: true, bindTo: input.schoolId, grantFree: true };
  }

  return needsSubscription(input.level, input.fyLabel);
}

/** One wording for the one reason a book is refused on money. */
function needsSubscription(level: SchoolLevel, fyLabel: string): Entitlement {
  return { allowed: false, reason: needsSubscriptionMessage(level, fyLabel) };
}

/**
 * Exported so the server can raise the same message when a race for the free
 * grant is caught at the database's unique index rather than at this check.
 */
export function needsSubscriptionMessage(level: SchoolLevel, fyLabel: string): string {
  return (
    `Opening this ${level} book for ${fyLabel} needs a subscription: `
    + `KSh ${priceLabel(level)} for the year, covering every account this school `
    + "keeps at that level. Your one free book has already been opened."
  );
}

export type SubscriptionStatus = "paid" | "unpaid" | "free";

/**
 * What the three states in the owner console actually write.
 *
 * The subtle one is paid-over-free: `isFree` is the record that the org's one
 * free book was spent here, so payment must not clear it. Clearing it would
 * make the allowance look unused and hand them a second free book.
 */
export function subscriptionStateFor(
  status: SubscriptionStatus,
  current: { isFree: boolean },
): { paidAt: Date | null; isFree: boolean } {
  switch (status) {
    case "paid":
      // Absorbed, not erased: still the free grant, now paid for.
      return { paidAt: new Date(), isFree: current.isFree };
    case "unpaid":
      // Owed. A row that is owed is by definition not the free one.
      return { paidAt: null, isFree: false };
    case "free":
      return { paidAt: null, isFree: true };
  }
}
