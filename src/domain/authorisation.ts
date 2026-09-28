/**
 * The head of institution authorising payments.
 *
 * Whoever keeps the books — often a freelancer — never authorises for the
 * head. The head does it one of three ways, chosen per school: a link and
 * code sent to their email, a printed schedule they sign, or signing in as
 * an authoriser. Each voucher prints which.
 *
 * What was authorised is kept as the payment's terms, not a flag, so an
 * amendment afterwards shows as such instead of silently keeping the approval.
 */

import type { Payment } from "./types";
import type { Role } from "./permissions";
import type { Position } from "./positions";

export const AUTH_ROUTES = ["email", "paper", "login"] as const;
export type AuthRoute = (typeof AUTH_ROUTES)[number];

export const AUTH_ROUTE_LABEL: Record<AuthRoute, string> = {
  email: "By email link and code",
  paper: "By signed paper schedule",
  login: "The head signs in as authoriser",
};

export const CODE_MINUTES = 15;
export const MAX_CODE_TRIES = 5;
/** Codes one link may ask for, so the link cannot be used to guess for ever. */
export const MAX_CODES = 5;
export const LINK_DAYS = 7;

/** Everything that makes the payment, except its voucher number, which renumbering changes. */
export function paymentTerms(p: Pick<Payment, "date" | "particulars" | "narration" | "chequeNo" | "project" | "cash" | "bank" | "allocations">): string {
  const lines = p.allocations
    .map((a) => [a.voteHeadCode, a.amount] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify({
    date: p.date, payee: p.particulars, narration: p.narration ?? "", cheque: p.chequeNo ?? "", project: p.project ?? "",
    cash: p.cash, bank: p.bank, lines,
  });
}

export interface AuthorisationRecord {
  decision: "authorised" | "held";
  terms: string;
  route: AuthRoute;
  reason: string | null;
  hoiName: string;
  hoiTsc: string | null;
  /** The address the code went to. Email route only. */
  sentTo: string | null;
  /** The date the head signed the schedule. Paper route only. */
  signedOn: string | null;
  at: Date;
  /** The head entered the payment and authorised it too. */
  selfAuthorised: boolean;
}

export type AuthorisationState =
  | { state: "awaiting" }
  | { state: "authorised"; record: AuthorisationRecord }
  | { state: "held"; reason: string }
  | { state: "changed" };

/** Where a payment stands, from its current terms and the latest decision on it. */
export function authorisationState(terms: string, latest: AuthorisationRecord | undefined): AuthorisationState {
  if (!latest) return { state: "awaiting" };
  if (latest.decision === "held") {
    return latest.terms === terms ? { state: "held", reason: latest.reason ?? "" } : { state: "awaiting" };
  }
  return latest.terms === terms ? { state: "authorised", record: latest } : { state: "changed" };
}

/**
 * The invited authoriser, or a head who keeps their own books. Position is
 * chosen at signup, so it counts only alongside ownership of the books.
 */
export const mayAuthorise = (role: Role, position: Position | null): boolean =>
  role === "authoriser" || (role === "owner" && position === "hoi");

export function authorisationLine(r: AuthorisationRecord): string {
  const who = `${r.hoiName} (Head of institution${r.hoiTsc ? `, TSC ${r.hoiTsc}` : ""})`;
  const when = r.at.toLocaleString("en-KE", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi",
  });
  if (r.route === "paper") return `Authorised on a signed schedule dated ${r.signedOn}, by ${who}`;
  if (r.route === "email") return `Authorised by ${who}, by code emailed to ${r.sentTo}, ${when}`;
  return `Authorised by ${who}, signed in, ${when}`
    + (r.selfAuthorised ? ". Entered and authorised by the same person" : "");
}

/**
 * The voucher's authorisation line, whatever the state. An amended payment
 * says so. An exempt book went for audit before the head's authorisation was
 * kept here, so its payments were authorised on paper, if at all.
 */
export function voucherAuthorisationText(s: AuthorisationState | undefined, exempt = false): string {
  if (exempt && s?.state !== "authorised") {
    return "Sent for audit before Zaroda Books kept the head of institution's authorisation. See the signed voucher.";
  }
  if (!s || s.state === "awaiting") return "Not authorised by the head of institution.";
  if (s.state === "changed") return "Amended after it was authorised. Not authorised as it stands.";
  if (s.state === "held") return `Held back by the head of institution: ${s.reason}`;
  return `${authorisationLine(s.record)}.`;
}

export function codeUsable(c: { issuedAt: Date | null; tries: number; now: Date }): boolean {
  if (!c.issuedAt || c.tries >= MAX_CODE_TRIES) return false;
  return c.now.getTime() - c.issuedAt.getTime() <= CODE_MINUTES * 60 * 1000;
}

export interface Decision {
  id: string;
  /** The terms the head was shown, so a payment amended meanwhile is refused. */
  terms: string;
  decision: "authorised" | "held";
  reason: string | null;
}

/** Ticked is authorised; unticked with a reason is held; unticked without one is left for later. */
export function readDecisions(ids: string[], get: (key: string) => string | null): Decision[] {
  return ids.flatMap((id): Decision[] => {
    const terms = get(`terms_${id}`) ?? "";
    if (get(`ok_${id}`)) return [{ id, terms, decision: "authorised", reason: null }];
    const reason = (get(`reason_${id}`) ?? "").trim();
    return reason ? [{ id, terms, decision: "held", reason }] : [];
  });
}

/** Why the books cannot go for audit yet, or null. Takes the voucher numbers not authorised. */
export function auditBlockReason(unauthorised: string[]): string | null {
  if (!unauthorised.length) return null;
  const n = unauthorised.length;
  return `${n} payment${n === 1 ? " is" : "s are"} not yet authorised by the head of institution: `
    + `VR ${unauthorised.join(", ")}.`;
}
