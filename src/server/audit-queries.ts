import "server-only";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  auditorCanSee, can, closeRefusal, formatKes, statusAfterMessage,
  type QueryParty, type QueryStatus,
} from "@/domain";
import { auditorScope, getCurrentUser } from "@/server/auth";
import { emailLayout, sendEmail } from "@/server/email";
import { schoolContacts } from "@/server/audit-mail";
import { getBookForOrg } from "@/server/queries";
import { SITE_URL } from "@/app/site-url";

/**
 * Audit queries. Raising, following up and closing a query are the only
 * writes an auditor makes, so each is checked here against the auditor's
 * grant and area rather than through loadBook, whose audit session is
 * read-only. The school answers through its ordinary login.
 */

async function bookOf(accountId: string) {
  const [row] = await db
    .select({ account: schema.accounts, school: schema.schools, fyLabel: schema.financialYears.label })
    .from(schema.accounts)
    .innerJoin(schema.schools, eq(schema.schools.id, schema.accounts.schoolId))
    .leftJoin(schema.financialYears, eq(schema.financialYears.accountId, schema.accounts.id))
    .where(eq(schema.accounts.id, accountId));
  if (!row) throw new Error("Book not found.");
  return row;
}

/** The signed-in auditor, if the book is in their area. */
async function auditorOver(accountId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first.");
  const scope = await auditorScope(user.id);
  const book = await bookOf(accountId);
  if (!scope || !auditorCanSee(scope, book.school) || book.account.auditSentTo !== scope.id) {
    throw new Error("Only the auditor this book was sent to can do that.");
  }
  return { user, book };
}

/** Which side of the query the signed-in person is on, if either. */
async function partyTo(query: typeof schema.auditQueries.$inferSelect) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first.");
  const book = await bookOf(query.accountId);

  const scope = await auditorScope(user.id);
  if (scope && auditorCanSee(scope, book.school) && user.auditing) {
    if (book.account.auditSentTo !== scope.id) throw new Error("This book has been taken back by the school.");
    return { user, book, party: "auditor" as QueryParty };
  }
  if (user.readOnly || user.orgId !== query.orgId || !can(user.role, "auditQuery.answer")) {
    throw new Error("Only the owner, accountant or bursar of these books can answer an audit query.");
  }
  await getBookForOrg(query.accountId, user.orgId, user.bookScope);
  return { user, book, party: "school" as QueryParty };
}

/** "VR 23 · 2025-03-11 · KEPSHA · 41,000.00" — the entry as it stood when queried. */
async function subjectOf(accountId: string, transactionId: string | null) {
  if (!transactionId) return "The book as a whole";
  const [row] = await db
    .select({ t: schema.transactions, accountId: schema.financialYears.accountId })
    .from(schema.transactions)
    .innerJoin(schema.periods, eq(schema.periods.id, schema.transactions.periodId))
    .innerJoin(schema.financialYears, eq(schema.financialYears.id, schema.periods.financialYearId))
    .where(eq(schema.transactions.id, transactionId));
  if (!row || row.accountId !== accountId) throw new Error("That entry is not in this book.");
  const t = row.t;
  const ref = t.kind === "payment" ? `VR ${t.vrNo ?? "—"}`
    : t.kind === "receipt" ? `Receipt ${t.receiptNo || "—"}`
    : "Transfer";
  const amount = t.kind === "contra" ? t.cash : t.cash + t.bank;
  return `${ref} · ${t.date} · ${t.particulars} · ${formatKes(amount)}`;
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Never throws: a query must not fail to save because an email did. */
async function tell(to: string[], input: { subject: string; heading: string; body: string; linkPath: string }) {
  const url = `${SITE_URL}${input.linkPath}`;
  for (const address of to) {
    try {
      await sendEmail({
        to: address,
        subject: input.subject,
        html: emailLayout({
          heading: input.heading,
          body: input.body,
          buttonLabel: "Open the queries",
          buttonUrl: url,
          footer: "Sent by Zaroda Books because an audit query concerns you.",
        }),
        text: `${input.body.replace(/<[^>]+>/g, "")}\n\nOpen the queries: ${url}`,
      });
    } catch {
      // sendEmail records its own problems.
    }
  }
}


const bookName = (b: Awaited<ReturnType<typeof bookOf>>) =>
  `${b.school.name} — ${b.account.name}${b.fyLabel ? ` ${b.fyLabel}` : ""}`;

export async function raiseQuery(accountId: string, transactionId: string | null, body: string) {
  const text = body.trim();
  if (!text) throw new Error("Write the query.");
  const { user, book } = await auditorOver(accountId);
  const subject = await subjectOf(accountId, transactionId);

  const [query] = await db.insert(schema.auditQueries).values({
    orgId: book.school.orgId,
    accountId,
    transactionId,
    subject,
    raisedBy: user.id,
  }).returning();
  await db.batch([
    db.insert(schema.auditQueryMessages).values({ queryId: query.id, userId: user.id, fromAuditor: true, body: text }),
    db.insert(schema.auditLog).values({
      orgId: book.school.orgId, userId: user.id, action: "audit.query", entity: "audit_query",
      entityId: query.id, after: JSON.stringify({ subject, body: text }),
    }),
  ] as unknown as Parameters<typeof db.batch>[0]);

  await tell(await schoolContacts(book.school.orgId, book.school.id), {
    subject: `Audit query on ${book.school.name}`,
    heading: "The auditor has raised a query",
    body: `<strong>${escape(user.name)}</strong>, Ministry auditor, has raised a query on `
      + `<strong>${escape(bookName(book))}</strong>.<br><br>`
      + `<em>${escape(subject)}</em><br>${escape(text)}`,
    linkPath: `/app/${accountId}/queries`,
  });
  return query.id;
}

export async function replyToQuery(queryId: string, body: string) {
  const text = body.trim();
  if (!text) throw new Error("Write a reply.");
  const [query] = await db.select().from(schema.auditQueries).where(eq(schema.auditQueries.id, queryId));
  if (!query) throw new Error("Query not found.");
  const { user, book, party } = await partyTo(query);

  const next = statusAfterMessage(query.status, party);
  if (next.error) throw new Error(next.error);

  await db.batch([
    db.insert(schema.auditQueryMessages).values({ queryId, userId: user.id, fromAuditor: party === "auditor", body: text }),
    db.update(schema.auditQueries).set({ status: next.status }).where(eq(schema.auditQueries.id, queryId)),
    db.insert(schema.auditLog).values({
      orgId: query.orgId, userId: user.id, action: "audit.reply", entity: "audit_query",
      entityId: queryId, before: JSON.stringify({ status: query.status }),
      after: JSON.stringify({ status: next.status, from: party, body: text }),
    }),
  ] as unknown as Parameters<typeof db.batch>[0]);

  const [auditor] = await db.select({ email: schema.users.email }).from(schema.users)
    .where(eq(schema.users.id, query.raisedBy));
  await tell(party === "school" ? (auditor ? [auditor.email] : []) : await schoolContacts(query.orgId, book.school.id), {
    subject: party === "school"
      ? `${book.school.name} has answered your audit query`
      : `The auditor has replied on ${book.school.name}`,
    heading: party === "school" ? "The school has answered" : "The auditor has replied",
    body: `<strong>${escape(user.name)}</strong> on <strong>${escape(bookName(book))}</strong>:<br><br>`
      + `<em>${escape(query.subject)}</em><br>${escape(text)}`,
    linkPath: `/app/${query.accountId}/queries`,
  });
}

export async function closeQuery(queryId: string) {
  const [query] = await db.select().from(schema.auditQueries).where(eq(schema.auditQueries.id, queryId));
  if (!query) throw new Error("Query not found.");
  const { user, book } = await auditorOver(query.accountId);
  const refusal = closeRefusal(query.status);
  if (refusal) throw new Error(refusal);

  await db.batch([
    db.update(schema.auditQueries).set({ status: "closed", closedBy: user.id, closedAt: new Date() })
      .where(eq(schema.auditQueries.id, queryId)),
    db.insert(schema.auditLog).values({
      orgId: query.orgId, userId: user.id, action: "audit.close", entity: "audit_query",
      entityId: queryId, before: JSON.stringify({ status: query.status }),
      after: JSON.stringify({ status: "closed" }),
    }),
  ] as unknown as Parameters<typeof db.batch>[0]);

  await tell(await schoolContacts(query.orgId, book.school.id), {
    subject: `Audit query closed on ${book.school.name}`,
    heading: "The auditor has closed a query",
    body: `<strong>${escape(user.name)}</strong> has closed the query on <strong>${escape(bookName(book))}</strong>:<br><br>`
      + `<em>${escape(query.subject)}</em><br>Nothing more is needed on it.`,
    linkPath: `/app/${query.accountId}/queries`,
  });
}

/** A book's queries with their conversations, open first. */
export async function queriesForAccount(accountId: string) {
  const queries = await db.select().from(schema.auditQueries)
    .where(eq(schema.auditQueries.accountId, accountId))
    .orderBy(desc(schema.auditQueries.raisedAt));
  if (!queries.length) return [];

  const messages = await db
    .select({ m: schema.auditQueryMessages, name: schema.users.name })
    .from(schema.auditQueryMessages)
    .innerJoin(schema.users, eq(schema.users.id, schema.auditQueryMessages.userId))
    .where(inArray(schema.auditQueryMessages.queryId, queries.map((q) => q.id)))
    .orderBy(asc(schema.auditQueryMessages.at));

  const order: Record<QueryStatus, number> = { open: 0, answered: 1, closed: 2 };
  return queries
    .map((q) => ({ ...q, messages: messages.filter((m) => m.m.queryId === q.id).map((m) => ({ ...m.m, name: m.name })) }))
    .sort((a, b) => order[a.status] - order[b.status]);
}

/** Entries of a book with a query still unsettled, for the ⚑ in the lists. */
export async function queriedEntries(accountId: string) {
  const rows = await db.select({ id: schema.auditQueries.transactionId }).from(schema.auditQueries)
    .where(and(eq(schema.auditQueries.accountId, accountId), ne(schema.auditQueries.status, "closed")));
  return new Set(rows.map((r) => r.id).filter((id): id is string => Boolean(id)));
}

/** Queries waiting on this side, per book: open for the school, answered for the auditor. */
export async function waitingCounts(accountIds: string[], auditing: boolean) {
  if (!accountIds.length) return {};
  const rows = await db.select({ accountId: schema.auditQueries.accountId }).from(schema.auditQueries)
    .where(and(
      inArray(schema.auditQueries.accountId, accountIds),
      eq(schema.auditQueries.status, auditing ? "answered" : "open"),
    ));
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.accountId] = (counts[r.accountId] ?? 0) + 1;
  return counts;
}

/** Unsettled queries on a book, for the warning on closing the year. */
export async function unsettledCount(accountId: string) {
  const rows = await db.select({ id: schema.auditQueries.id }).from(schema.auditQueries)
    .where(and(eq(schema.auditQueries.accountId, accountId), ne(schema.auditQueries.status, "closed")));
  return rows.length;
}

/** Everything an auditor has raised, newest first, for their audit page. */
export async function queriesRaisedBy(userId: string) {
  return db
    .select({
      q: schema.auditQueries, schoolId: schema.schools.id, school: schema.schools.name,
      account: schema.accounts.name, sentTo: schema.accounts.auditSentTo,
    })
    .from(schema.auditQueries)
    .innerJoin(schema.accounts, eq(schema.accounts.id, schema.auditQueries.accountId))
    .innerJoin(schema.schools, eq(schema.schools.id, schema.accounts.schoolId))
    .where(eq(schema.auditQueries.raisedBy, userId))
    .orderBy(desc(schema.auditQueries.raisedAt));
}
