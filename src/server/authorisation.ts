import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  AUTH_ROUTES, CODE_MINUTES, LINK_DAYS, MAX_CODES, MAX_CODE_TRIES, authorisationState, codeUsable,
  mayAuthorise, paymentTerms,
  type AuthRoute, type AuthorisationRecord, type AuthorisationState, type Decision, type Payment, type Txn,
} from "@/domain";
import { loadBook } from "@/server/book-context";
import { emailConfigured, emailLayout, sendEmail } from "@/server/email";
import { escapeHtml } from "@/server/audit-mail";
import { getFinancialYear, getTxns, getVoteHeads } from "@/server/queries";
import { SITE_URL } from "@/app/site-url";
import { codeMatches, hashCode, hashToken, newCode, newToken } from "@/server/codes";

/** The head of institution authorising payments. See src/domain/authorisation.ts. */

export interface PaymentStatus {
  payment: Payment;
  terms: string;
  status: AuthorisationState;
}

/** Every payment of the year with where it stands, in voucher order. */
export async function paymentStatuses(txns: Txn[]): Promise<PaymentStatus[]> {
  const payments = txns
    .filter((t): t is Payment => t.kind === "payment")
    .sort((a, b) => Number(a.vrNo ?? 0) - Number(b.vrNo ?? 0));
  if (!payments.length) return [];
  const ids = payments.map((p) => p.id);

  const [rows, created] = await Promise.all([
    db.select().from(schema.paymentAuthorisations)
      .where(inArray(schema.paymentAuthorisations.transactionId, ids))
      .orderBy(schema.paymentAuthorisations.at),
    db.select({ id: schema.transactions.id, createdBy: schema.transactions.createdBy })
      .from(schema.transactions).where(inArray(schema.transactions.id, ids)),
  ]);
  const enteredBy = new Map(created.map((c) => [c.id, c.createdBy]));
  const latest = new Map<string, AuthorisationRecord>();
  for (const r of rows) {
    latest.set(r.transactionId, {
      decision: r.decision, terms: r.terms, route: r.route, reason: r.reason,
      hoiName: r.hoiName, hoiTsc: r.hoiTsc, sentTo: r.sentTo, signedOn: r.signedOn, at: r.at,
      selfAuthorised: r.authorisedBy !== null && r.authorisedBy === enteredBy.get(r.transactionId),
    });
  }

  return payments.map((payment) => {
    const terms = paymentTerms(payment);
    return { payment, terms, status: authorisationState(terms, latest.get(payment.id)) };
  });
}

/** Still wanting the head: never decided, or amended since. */
export const needsHoi = (s: PaymentStatus) => s.status.state === "awaiting" || s.status.state === "changed";

/** Voucher numbers of every payment not authorised as it now stands. */
export async function unauthorisedVouchers(financialYearId: string, upTo?: string): Promise<string[]> {
  return (await paymentStatuses(await getTxns(financialYearId)))
    .filter((s) => !upTo || s.payment.date.slice(0, 7) <= upTo)
    .filter((s) => s.status.state !== "authorised")
    .map((s) => s.payment.vrNo ?? "—");
}

export async function saveAuthorisationSettings(accountId: string, input: {
  route: string; hoiName: string; hoiTsc: string; hoiEmail: string;
}) {
  const { user, school } = await loadBook(accountId, { write: true, require: "school.edit" });
  const route = input.route as AuthRoute;
  if (!AUTH_ROUTES.includes(route)) throw new Error("Choose how the head authorises payments.");
  const next = {
    authRoute: route,
    hoiName: input.hoiName.trim(),
    hoiTsc: input.hoiTsc.trim() || null,
    hoiEmail: input.hoiEmail.trim().toLowerCase() || null,
  };
  if (!next.hoiName) throw new Error("Enter the head of institution's name.");
  if (route === "email" && !next.hoiEmail?.includes("@")) throw new Error("Enter the head's email address.");

  const before = { authRoute: school.authRoute, hoiName: school.hoiName, hoiTsc: school.hoiTsc, hoiEmail: school.hoiEmail };
  await db.batch([
    db.update(schema.schools).set(next).where(eq(schema.schools.id, school.id)),
    db.insert(schema.auditLog).values({
      orgId: user.orgId, userId: user.id, action: "authorisation.settings", entity: "school", entityId: school.id,
      before: JSON.stringify(before), after: JSON.stringify(next),
    }),
  ]);
  return { schoolId: school.id, emailChanged: Boolean(next.hoiEmail) && next.hoiEmail !== school.hoiEmail };
}

/** Every change to how the head authorises, oldest first, for the auditor. */
export async function settingsHistory(schoolId: string) {
  const rows = await db
    .select({ log: schema.auditLog, name: schema.users.name })
    .from(schema.auditLog)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.userId))
    .where(and(
      eq(schema.auditLog.entity, "school"),
      eq(schema.auditLog.entityId, schoolId),
      eq(schema.auditLog.action, "authorisation.settings"),
    ))
    .orderBy(schema.auditLog.at);
  return rows.map((r) => ({
    at: r.log.at,
    by: r.name ?? "—",
    after: JSON.parse(r.log.after ?? "{}") as { authRoute: AuthRoute; hoiName: string; hoiTsc: string | null; hoiEmail: string | null },
  }));
}

export async function requestsFor(accountId: string) {
  return db.select().from(schema.authorisationRequests)
    .where(eq(schema.authorisationRequests.accountId, accountId))
    .orderBy(desc(schema.authorisationRequests.createdAt));
}

type Listed = { id: string; terms: string }[];

async function pendingFor(accountId: string) {
  const fy = await getFinancialYear(accountId);
  const pending = (await paymentStatuses(await getTxns(fy.id))).filter(needsHoi);
  if (!pending.length) throw new Error("Every payment is already authorised or held.");
  return pending.map((s): Listed[number] => ({ id: s.payment.id, terms: s.terms }));
}

/** Emails the head a link to every payment still wanting them. */
export async function sendToHoi(accountId: string) {
  const { user, school, account } = await loadBook(accountId, { write: true, require: "entry.post" });
  if (school.authRoute !== "email" || !school.hoiEmail || !school.hoiName) {
    throw new Error("Set the head's email in Book settings, under Authorisation of payments.");
  }
  if (!emailConfigured()) throw new Error("Email is not set up on Zaroda Books yet. Use the paper schedule for now.");

  const listed = await pendingFor(accountId);
  const token = newToken();
  const [req] = await db.insert(schema.authorisationRequests).values({
    accountId, route: "email", payments: JSON.stringify(listed),
    hoiName: school.hoiName, hoiTsc: school.hoiTsc, sentTo: school.hoiEmail,
    tokenHash: hashToken(token), expiresAt: new Date(Date.now() + LINK_DAYS * 86_400_000),
    createdBy: user.id,
  }).returning();
  await db.insert(schema.auditLog).values({
    orgId: user.orgId, userId: user.id, action: "authorisation.sent", entity: "authorisation_request", entityId: req.id,
    after: JSON.stringify({ to: school.hoiEmail, payments: listed.length }),
  });

  const url = `${SITE_URL}/authorise/${token}`;
  const n = listed.length;
  const sent = await sendEmail({
    to: school.hoiEmail,
    subject: `${school.name}: ${n} payment${n === 1 ? "" : "s"} for your authorisation`,
    html: emailLayout({
      heading: "Payments for your authorisation",
      body: `${escapeHtml(user.name)} has entered <strong>${n} payment${n === 1 ? "" : "s"}</strong> in the `
        + `${escapeHtml(account.name)} account of <strong>${escapeHtml(school.name)}</strong>. `
        + "Open the list, then ask for a code to be emailed to you to authorise them.",
      buttonLabel: "Review the payments",
      buttonUrl: url,
      footer: `Sent to ${escapeHtml(school.hoiName)} as head of institution. The link works once and lapses after ${LINK_DAYS} days.`,
    }),
    text: `${user.name} has entered ${n} payment(s) at ${school.name} for your authorisation.\n\nReview them: ${url}\n\n`
      + `The link works once and lapses after ${LINK_DAYS} days.`,
  });
  if (!sent.ok) throw new Error(`The email to the head could not be sent. ${sent.detail ?? ""}`.trim());
  return n;
}

/** The emailed request behind a link, with the payments as they now stand, or null. */
export async function requestForToken(token: string) {
  const [req] = await db.select().from(schema.authorisationRequests)
    .where(eq(schema.authorisationRequests.tokenHash, hashToken(token)));
  if (!req || req.route !== "email" || req.completedAt || req.expiresAt < new Date()) return null;

  const [book] = await db
    .select({ account: schema.accounts, school: schema.schools })
    .from(schema.accounts)
    .innerJoin(schema.schools, eq(schema.schools.id, schema.accounts.schoolId))
    .where(eq(schema.accounts.id, req.accountId));
  const fy = await getFinancialYear(req.accountId);
  const [statuses, heads] = await Promise.all([paymentStatuses(await getTxns(fy.id)), getVoteHeads(req.accountId)]);
  const ids = new Set((JSON.parse(req.payments) as Listed).map((p) => p.id));
  return {
    req, school: book.school, account: book.account, fy, heads,
    payments: statuses.filter((s) => ids.has(s.payment.id) && needsHoi(s)),
  };
}

export async function emailCode(token: string) {
  const found = await requestForToken(token);
  if (!found) throw new Error("This link is no longer usable.");
  const { req, school } = found;
  if (req.codesSent >= MAX_CODES) throw new Error("Too many codes have been sent for this link. Ask for the payments to be sent again.");

  const code = newCode();
  await db.update(schema.authorisationRequests)
    .set({ codeHash: hashCode(req.id, code), codeIssuedAt: new Date(), codeTries: 0, codesSent: req.codesSent + 1 })
    .where(eq(schema.authorisationRequests.id, req.id));

  const sent = await sendEmail({
    to: req.sentTo!,
    subject: `Your authorisation code: ${code}`,
    html: emailLayout({
      heading: `Your code is ${code}`,
      body: `Enter it on the page listing the payments of <strong>${escapeHtml(school.name)}</strong> to authorise them. `
        + `It works for ${CODE_MINUTES} minutes.`,
      buttonLabel: "Back to the payments",
      buttonUrl: `${SITE_URL}/authorise/${token}`,
      footer: "If you did not ask for this code, ignore this email. Nothing is authorised without it.",
    }),
    text: `Your authorisation code is ${code}. It works for ${CODE_MINUTES} minutes.`,
  });
  if (!sent.ok) throw new Error("The code could not be emailed. Try again in a moment.");
}

/**
 * The head's decisions through the emailed link. The link is spent once
 * used; payments left undecided go in the next one.
 */
export async function decideByEmail(token: string, code: string, decisions: Decision[]) {
  const found = await requestForToken(token);
  if (!found) throw new Error("This link is no longer usable.");
  const { req, school, payments } = found;

  if (!codeUsable({ issuedAt: req.codeIssuedAt, tries: req.codeTries, now: new Date() })) {
    throw new Error("Ask for a new code: the last one has lapsed or been tried too often.");
  }
  if (!codeMatches(req.codeHash, req.id, code)) {
    await db.update(schema.authorisationRequests).set({ codeTries: req.codeTries + 1 })
      .where(eq(schema.authorisationRequests.id, req.id));
    const left = MAX_CODE_TRIES - req.codeTries - 1;
    throw new Error(left > 0 ? `That code is not right. ${left} tr${left === 1 ? "y" : "ies"} left.` : "That code is not right. Ask for a new one.");
  }
  if (!decisions.length) throw new Error("Tick the payments you authorise, or give a reason for holding one back.");
  assertCurrent(decisions, payments);

  await db.batch([
    ...decisions.map((d) => db.insert(schema.paymentAuthorisations).values({
      transactionId: d.id, requestId: req.id, decision: d.decision, terms: d.terms, reason: d.reason,
      route: "email" as const, hoiName: req.hoiName, hoiTsc: req.hoiTsc, sentTo: req.sentTo,
    })),
    db.update(schema.authorisationRequests).set({ completedAt: new Date() })
      .where(eq(schema.authorisationRequests.id, req.id)),
    db.insert(schema.auditLog).values({
      orgId: school.orgId, userId: null, action: "authorisation.decided", entity: "authorisation_request", entityId: req.id,
      after: JSON.stringify({ route: "email", sentTo: req.sentTo, decisions: decisions.map(({ id, decision, reason }) => ({ id, decision, reason })) }),
    }),
  ] as unknown as Parameters<typeof db.batch>[0]);
}

/** Refuses a decision on a payment that has changed since the head was shown it. */
function assertCurrent(decisions: Decision[], payments: PaymentStatus[]) {
  const byId = new Map(payments.map((s) => [s.payment.id, s]));
  for (const d of decisions) {
    const s = byId.get(d.id);
    if (!s) throw new Error("A payment on this list has been removed or decided since the page was opened. Reload the page.");
    if (s.terms !== d.terms) {
      throw new Error(`VR ${s.payment.vrNo ?? ""} was amended after this page was opened. Reload the page and look again.`);
    }
  }
}

/** A printed schedule of every payment still wanting the head, to be signed. */
export async function preparePaperSchedule(accountId: string) {
  const { user, school } = await loadBook(accountId, { write: true, require: "entry.post" });
  if (school.authRoute !== "paper" || !school.hoiName) {
    throw new Error("Set the head's name in Book settings, under Authorisation of payments.");
  }
  const listed = await pendingFor(accountId);
  const [req] = await db.insert(schema.authorisationRequests).values({
    accountId, route: "paper", payments: JSON.stringify(listed),
    hoiName: school.hoiName, hoiTsc: school.hoiTsc,
    expiresAt: new Date(Date.now() + 365 * 86_400_000), createdBy: user.id,
  }).returning();
  return req.id;
}

/** A schedule, with its payments exactly as printed on it. */
export async function paperSchedule(accountId: string, requestId: string) {
  const [req] = await db.select().from(schema.authorisationRequests)
    .where(and(
      eq(schema.authorisationRequests.id, requestId),
      eq(schema.authorisationRequests.accountId, accountId),
      eq(schema.authorisationRequests.route, "paper"),
    ));
  if (!req) return null;
  const fy = await getFinancialYear(accountId);
  const vr = new Map((await getTxns(fy.id)).map((t) => [t.id, t.kind === "payment" ? t.vrNo : undefined]));
  const lines = (JSON.parse(req.payments) as Listed).map((p) => ({
    id: p.id, terms: p.terms, vrNo: vr.get(p.id), removed: !vr.has(p.id),
    ...(JSON.parse(p.terms) as { date: string; payee: string; narration: string; cash: number; bank: number; lines: [string, number][] }),
  }));
  return { req, lines };
}

/**
 * Records the head's signature on a printed schedule. The decisions stand on
 * the terms as printed, so a payment amended since shows as such.
 */
export async function recordSignedSchedule(accountId: string, requestId: string, signedOn: string, decisions: Decision[]) {
  const { user } = await loadBook(accountId, { write: true, require: "entry.post" });
  const found = await paperSchedule(accountId, requestId);
  if (!found) throw new Error("Schedule not found.");
  const { req, lines } = found;
  if (req.completedAt) throw new Error("This schedule has already been recorded.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(signedOn)) throw new Error("Enter the date the head signed the schedule.");
  const today = new Date().toISOString().slice(0, 10);
  if (signedOn > today) throw new Error("The date signed cannot be in the future.");
  if (signedOn < req.createdAt.toISOString().slice(0, 10)) throw new Error("The date signed is before the schedule was printed.");

  const printed = new Map(lines.filter((l) => !l.removed).map((l) => [l.id, l.terms]));
  const chosen = decisions.filter((d) => printed.has(d.id));
  if (!chosen.length) throw new Error("Tick the payments the head signed for, or give a reason for any held back.");

  await db.batch([
    ...chosen.map((d) => db.insert(schema.paymentAuthorisations).values({
      transactionId: d.id, requestId: req.id, decision: d.decision, terms: printed.get(d.id)!, reason: d.reason,
      route: "paper" as const, hoiName: req.hoiName, hoiTsc: req.hoiTsc, signedOn, recordedBy: user.id,
    })),
    db.update(schema.authorisationRequests).set({ completedAt: new Date(), signedOn })
      .where(eq(schema.authorisationRequests.id, req.id)),
    db.insert(schema.auditLog).values({
      orgId: user.orgId, userId: user.id, action: "authorisation.decided", entity: "authorisation_request", entityId: req.id,
      after: JSON.stringify({ route: "paper", signedOn, decisions: chosen.map(({ id, decision, reason }) => ({ id, decision, reason })) }),
    }),
  ] as unknown as Parameters<typeof db.batch>[0]);
}

/** The head, signed in, deciding in the app. */
export async function authoriseSignedIn(accountId: string, decisions: Decision[]) {
  const { user, fy } = await loadBook(accountId, { write: true });
  if (!mayAuthorise(user.role, user.position)) throw new Error("Only the head of institution can authorise payments.");
  if (!decisions.length) throw new Error("Tick the payments you authorise, or give a reason for holding one back.");
  assertCurrent(decisions, await paymentStatuses(await getTxns(fy.id)));

  await db.batch([
    ...decisions.map((d) => db.insert(schema.paymentAuthorisations).values({
      transactionId: d.id, decision: d.decision, terms: d.terms, reason: d.reason,
      route: "login" as const, hoiName: user.name, authorisedBy: user.id, recordedBy: user.id,
    })),
    db.insert(schema.auditLog).values({
      orgId: user.orgId, userId: user.id, action: "authorisation.decided", entity: "account", entityId: accountId,
      after: JSON.stringify({ route: "login", decisions: decisions.map(({ id, decision, reason }) => ({ id, decision, reason })) }),
    }),
  ] as unknown as Parameters<typeof db.batch>[0]);
}

