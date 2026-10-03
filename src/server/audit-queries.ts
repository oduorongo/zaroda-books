import "server-only";
import { and, asc, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  CODE_MINUTES, MAX_CODES, MAX_CODE_TRIES, auditorCanSee, closeRefusal, codeUsable, formatKes, queryPartyFor,
  reminderDue, statusAfterMessage,
  type QueryAddressee, type QueryParty, type QueryStatus,
} from "@/domain";
import { auditorScope, getCurrentUser } from "@/server/auth";
import { emailLayout, sendEmail } from "@/server/email";
import { schoolContacts } from "@/server/audit-mail";
import { getBookForOrg } from "@/server/queries";
import { codeMatches, hashCode, hashToken, newCode, newToken } from "@/server/codes";
import { SITE_URL } from "@/app/site-url";

/**
 * Audit queries. Raising, following up and closing a query are the only
 * writes an auditor makes, so each is checked here against the auditor's
 * grant and area rather than through loadBook, whose audit session is
 * read-only. The school answers through its ordinary login.
 *
 * A query may be addressed to the head of institution. The head hears of
 * every query, and answers those addressed to them: signed in, or through
 * an emailed link and code when they have no account. The bookkeeper may
 * add to a head's query, but only the head's reply is the head's answer.
 */

type Query = typeof schema.auditQueries.$inferSelect;

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
type Book = Awaited<ReturnType<typeof bookOf>>;

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
async function partyTo(query: Query) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first.");
  const book = await bookOf(query.accountId);

  const scope = await auditorScope(user.id);
  if (scope && auditorCanSee(scope, book.school) && user.auditing) {
    if (book.account.auditSentTo !== scope.id) throw new Error("This book has been taken back by the school.");
    return { user, book, party: "auditor" as QueryParty };
  }
  const party = user.readOnly || user.orgId !== query.orgId ? null : queryPartyFor(user, query.addressedTo);
  if (!party) {
    throw new Error(query.addressedTo === "hoi"
      ? "Only the head of institution, or whoever keeps these books, can answer this query."
      : "Only the owner, accountant or bursar of these books can answer this audit query.");
  }
  await getBookForOrg(query.accountId, user.orgId, user.bookScope);
  return { user, book, party };
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
async function tell(to: string[], input: {
  subject: string; heading: string; body: string; linkPath: string; buttonLabel?: string; footer?: string;
}) {
  const url = `${SITE_URL}${input.linkPath}`;
  const buttonLabel = input.buttonLabel ?? "Open the queries";
  for (const address of to) {
    try {
      await sendEmail({
        to: address,
        subject: input.subject,
        html: emailLayout({
          heading: input.heading,
          body: input.body,
          buttonLabel,
          buttonUrl: url,
          footer: input.footer ?? "Sent by Zaroda Books because an audit query concerns you.",
        }),
        text: `${input.body.replace(/<br>/g, "\n").replace(/<[^>]+>/g, "")}\n\n${buttonLabel}: ${url}`,
      });
    } catch {
      // sendEmail records its own problems.
    }
  }
}

/**
 * The head hears of every query on the school's books. Each email carries
 * its own link to the query, so a head with no account can read it, and
 * answer when it is addressed to them. Nothing is sent when the school has
 * not recorded the head's email; the queries page says so.
 */
async function tellHoi(query: Query, book: Book, input: { subject: string; heading: string; body: string }) {
  const { hoiEmail, hoiName, hoiTsc } = book.school;
  if (!hoiEmail || !hoiName) return;
  const token = newToken();
  await db.insert(schema.queryLinks).values({
    queryId: query.id, tokenHash: hashToken(token), sentTo: hoiEmail, hoiName, hoiTsc,
  });
  const forHead = query.addressedTo === "hoi";
  await tell([hoiEmail], {
    ...input,
    body: input.body + "<br><br>" + (forHead
      ? "The auditor has asked for <strong>your</strong> answer, as head of institution."
      : "For your information, as head of institution. Whoever keeps the books will answer it."),
    linkPath: `/query/${token}`,
    buttonLabel: forHead ? "Read and answer" : "Read the query",
    footer: `Sent to ${escape(hoiName)} as head of institution of ${escape(book.school.name)}. `
      + "The link works until the auditor closes the query.",
  });
}

const bookName = (b: Book) =>
  `${b.school.name} — ${b.account.name}${b.fyLabel ? ` ${b.fyLabel}` : ""}`;

const ADDRESSEES: QueryAddressee[] = ["school", "hoi"];

export async function raiseQuery(accountId: string, transactionId: string | null, body: string, addressedTo: string) {
  const text = body.trim();
  if (!text) throw new Error("Write the query.");
  const to = ADDRESSEES.includes(addressedTo as QueryAddressee) ? addressedTo as QueryAddressee : "school";
  const { user, book } = await auditorOver(accountId);
  const subject = await subjectOf(accountId, transactionId);

  const [query] = await db.insert(schema.auditQueries).values({
    orgId: book.school.orgId,
    accountId,
    transactionId,
    subject,
    raisedBy: user.id,
    addressedTo: to,
  }).returning();
  await db.batch([
    db.insert(schema.auditQueryMessages).values({ queryId: query.id, userId: user.id, fromAuditor: true, body: text }),
    db.insert(schema.auditLog).values({
      orgId: book.school.orgId, userId: user.id, action: "audit.query", entity: "audit_query",
      entityId: query.id, after: JSON.stringify({ subject, body: text, addressedTo: to }),
    }),
  ] as unknown as Parameters<typeof db.batch>[0]);

  const mail = {
    subject: `Audit query on ${book.school.name}`,
    heading: to === "hoi" ? "The auditor has a query for the head of institution" : "The auditor has raised a query",
    body: `<strong>${escape(user.name)}</strong>, Ministry auditor, has raised a query on `
      + `<strong>${escape(bookName(book))}</strong>.<br><br>`
      + `<em>${escape(subject)}</em><br>${escape(text)}`,
  };
  await tell(await schoolContacts(book.school.orgId, book.school.id), { ...mail, linkPath: `/app/${accountId}/queries` });
  await tellHoi(query, book, mail);
  return query.id;
}

/** Records a message and moves the query on, then tells whoever is waiting on it. */
async function addMessage(query: Query, book: Book, from: {
  party: QueryParty; userId: string | null; name: string; via?: string;
}, text: string) {
  const next = statusAfterMessage(query.status, from.party, query.addressedTo);
  if (next.error) throw new Error(next.error);

  await db.batch([
    db.insert(schema.auditQueryMessages).values({
      queryId: query.id, userId: from.userId, fromAuditor: from.party === "auditor", body: text,
      fromHoi: from.party === "hoi", authorName: from.party === "hoi" ? from.name : null, via: from.via ?? null,
    }),
    db.update(schema.auditQueries).set({ status: next.status }).where(eq(schema.auditQueries.id, query.id)),
    db.insert(schema.auditLog).values({
      orgId: query.orgId, userId: from.userId, action: "audit.reply", entity: "audit_query",
      entityId: query.id, before: JSON.stringify({ status: query.status }),
      after: JSON.stringify({ status: next.status, from: from.party, via: from.via ?? null, body: text }),
    }),
  ] as unknown as Parameters<typeof db.batch>[0]);

  const who = from.party === "hoi" ? `${from.name}, head of institution,` : from.name;
  const mail = {
    subject: from.party === "auditor"
      ? `The auditor has replied on ${book.school.name}`
      : `${book.school.name} has ${from.party === "hoi" ? "answered" : "added to"} your audit query`,
    heading: from.party === "auditor" ? "The auditor has replied"
      : from.party === "hoi" ? "The head of institution has answered"
      : query.addressedTo === "hoi" ? "The school has added information" : "The school has answered",
    body: `<strong>${escape(who)}</strong> on <strong>${escape(bookName(book))}</strong>:<br><br>`
      + `<em>${escape(query.subject)}</em><br>${escape(text)}`,
  };
  const [auditor] = await db.select({ email: schema.users.email }).from(schema.users)
    .where(eq(schema.users.id, query.raisedBy));
  if (from.party !== "auditor" && auditor) await tell([auditor.email], { ...mail, linkPath: "/audit" });
  if (from.party !== "school") {
    await tell(await schoolContacts(query.orgId, book.school.id), { ...mail, linkPath: `/app/${query.accountId}/queries` });
  }
  if (from.party !== "hoi") await tellHoi(query, book, mail);
}

export async function replyToQuery(queryId: string, body: string) {
  const text = body.trim();
  if (!text) throw new Error("Write a reply.");
  const [query] = await db.select().from(schema.auditQueries).where(eq(schema.auditQueries.id, queryId));
  if (!query) throw new Error("Query not found.");
  const { user, book, party } = await partyTo(query);
  await addMessage(query, book, { party, userId: user.id, name: user.name, via: party === "hoi" ? "signed in" : undefined }, text);
}

/** The auditor changes whose answer they want. The head is told when it becomes theirs. */
export async function readdressQuery(queryId: string, addressedTo: string) {
  const to = addressedTo as QueryAddressee;
  if (!ADDRESSEES.includes(to)) throw new Error("Choose who the query is for.");
  const [query] = await db.select().from(schema.auditQueries).where(eq(schema.auditQueries.id, queryId));
  if (!query) throw new Error("Query not found.");
  const { user, book } = await auditorOver(query.accountId);
  if (query.status === "closed") throw new Error("This query is closed.");
  if (query.addressedTo === to) return;

  await db.batch([
    db.update(schema.auditQueries).set({ addressedTo: to }).where(eq(schema.auditQueries.id, queryId)),
    db.insert(schema.auditLog).values({
      orgId: query.orgId, userId: user.id, action: "audit.readdress", entity: "audit_query", entityId: queryId,
      before: JSON.stringify({ addressedTo: query.addressedTo }), after: JSON.stringify({ addressedTo: to }),
    }),
  ] as unknown as Parameters<typeof db.batch>[0]);

  const mail = {
    subject: `Audit query on ${book.school.name}`,
    heading: to === "hoi" ? "The auditor wants the head of institution's answer" : "The auditor wants the school's answer",
    body: `<strong>${escape(user.name)}</strong> has addressed a query on <strong>${escape(bookName(book))}</strong> to `
      + `${to === "hoi" ? "the head of institution" : "whoever keeps the books"}.<br><br><em>${escape(query.subject)}</em>`,
  };
  await tell(await schoolContacts(query.orgId, book.school.id), { ...mail, linkPath: `/app/${query.accountId}/queries` });
  if (to === "hoi") await tellHoi({ ...query, addressedTo: to }, book, mail);
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

  const mail = {
    subject: `Audit query closed on ${book.school.name}`,
    heading: "The auditor has closed a query",
    body: `<strong>${escape(user.name)}</strong> has closed the query on <strong>${escape(bookName(book))}</strong>:<br><br>`
      + `<em>${escape(query.subject)}</em><br>Nothing more is needed on it.`,
  };
  await tell(await schoolContacts(query.orgId, book.school.id), { ...mail, linkPath: `/app/${query.accountId}/queries` });
  const { hoiEmail } = book.school;
  if (hoiEmail) await tell([hoiEmail], { ...mail, linkPath: "/", buttonLabel: "Zaroda Books" });
}

/**
 * Once the head's email is recorded, every open query already waiting on
 * the head is sent to them — they could not have heard of it before.
 */
export async function sendOpenQueriesToHoi(schoolId: string) {
  const open = await db.select({ q: schema.auditQueries }).from(schema.auditQueries)
    .innerJoin(schema.accounts, eq(schema.accounts.id, schema.auditQueries.accountId))
    .where(and(eq(schema.accounts.schoolId, schoolId), eq(schema.auditQueries.addressedTo, "hoi"), ne(schema.auditQueries.status, "closed")));
  for (const { q } of open) {
    const book = await bookOf(q.accountId);
    await tellHoi(q, book, {
      subject: `Audit query on ${book.school.name}`,
      heading: "The auditor has a query for the head of institution",
      body: `An audit query on <strong>${escape(bookName(book))}</strong> is waiting for your answer.<br><br><em>${escape(q.subject)}</em>`,
    });
  }
}

/** A book's queries with their conversations, open first. */
export async function queriesForAccount(accountId: string) {
  const queries = await db.select().from(schema.auditQueries)
    .where(eq(schema.auditQueries.accountId, accountId))
    .orderBy(desc(schema.auditQueries.raisedAt));
  if (!queries.length) return [];
  const messages = await messagesOf(queries.map((q) => q.id));

  const order: Record<QueryStatus, number> = { open: 0, answered: 1, closed: 2 };
  return queries
    .map((q) => ({ ...q, messages: messages.filter((m) => m.queryId === q.id) }))
    .sort((a, b) => order[a.status] - order[b.status]);
}

async function messagesOf(queryIds: string[]) {
  const rows = await db
    .select({ m: schema.auditQueryMessages, name: schema.users.name })
    .from(schema.auditQueryMessages)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditQueryMessages.userId))
    .where(inArray(schema.auditQueryMessages.queryId, queryIds))
    .orderBy(asc(schema.auditQueryMessages.at));
  return rows.map((r) => ({ ...r.m, name: r.m.authorName ?? r.name ?? "—" }));
}

/** The query behind an emailed link, while it is open, with what the head needs to answer it. */
export async function queryForToken(token: string) {
  const [link] = await db.select().from(schema.queryLinks).where(eq(schema.queryLinks.tokenHash, hashToken(token)));
  if (!link) return null;
  const [query] = await db.select().from(schema.auditQueries).where(eq(schema.auditQueries.id, link.queryId));
  if (!query || query.status === "closed") return null;
  const book = await bookOf(query.accountId);
  const [messages, docs] = await Promise.all([
    messagesOf([query.id]),
    query.transactionId
      ? db.select().from(schema.paymentDocuments).where(eq(schema.paymentDocuments.transactionId, query.transactionId))
      : [],
  ]);
  return { link, query, book, messages, docs: docs.filter((d) => !d.removedAt) };
}

export async function emailQueryCode(token: string) {
  const found = await queryForToken(token);
  if (!found) throw new Error("This link is no longer usable.");
  const { link, book } = found;
  if (link.codesSent >= MAX_CODES) throw new Error("Too many codes have been sent for this link. Use the link in a later email.");
  const code = newCode();
  await db.update(schema.queryLinks)
    .set({ codeHash: hashCode(link.id, code), codeIssuedAt: new Date(), codeTries: 0, codesSent: link.codesSent + 1 })
    .where(eq(schema.queryLinks.id, link.id));
  const sent = await sendEmail({
    to: link.sentTo,
    subject: `Your code to answer the audit query: ${code}`,
    html: emailLayout({
      heading: `Your code is ${code}`,
      body: `Enter it with your answer to the audit query on <strong>${escape(book.school.name)}</strong>. `
        + `It works for ${CODE_MINUTES} minutes.`,
      buttonLabel: "Back to the query",
      buttonUrl: `${SITE_URL}/query/${token}`,
      footer: "If you did not ask for this code, ignore this email. Nothing is sent without it.",
    }),
    text: `Your code is ${code}. It works for ${CODE_MINUTES} minutes.`,
  });
  if (!sent.ok) throw new Error("The code could not be emailed. Try again in a moment.");
}

/** The head answering through the emailed link. */
export async function replyByToken(token: string, code: string, body: string) {
  const text = body.trim();
  if (!text) throw new Error("Write your answer.");
  const found = await queryForToken(token);
  if (!found) throw new Error("This link is no longer usable.");
  const { link, query, book } = found;
  if (query.addressedTo !== "hoi") {
    throw new Error("This query is for whoever keeps the books. You have it for your information.");
  }
  if (!codeUsable({ issuedAt: link.codeIssuedAt, tries: link.codeTries, now: new Date() })) {
    throw new Error("Ask for a new code: the last one has lapsed or been tried too often.");
  }
  // Claimed and checked in one statement: see decideByEmail.
  const t = schema.queryLinks;
  const [claimed] = await db.update(t).set({ codeTries: sql`${t.codeTries} + 1` })
    .where(and(eq(t.id, link.id), lt(t.codeTries, MAX_CODE_TRIES)))
    .returning({ tries: t.codeTries });
  if (!claimed) throw new Error("Ask for a new code: the last one has lapsed or been tried too often.");
  if (!codeMatches(link.codeHash, link.id, code)) {
    const left = MAX_CODE_TRIES - claimed.tries;
    throw new Error(left > 0 ? `That code is not right. ${left} tr${left === 1 ? "y" : "ies"} left.` : "That code is not right. Ask for a new one.");
  }
  await db.update(schema.queryLinks).set({ codeHash: null }).where(eq(schema.queryLinks.id, link.id));
  await addMessage(query, book, {
    party: "hoi", userId: null,
    name: `${link.hoiName}${link.hoiTsc ? ` (TSC ${link.hoiTsc})` : ""}`,
    via: `code emailed to ${link.sentTo}`,
  }, text);
}

/** A supporting document of the queried payment, for the head reading by link. */
export async function queryDocumentForToken(token: string, documentId: string) {
  const found = await queryForToken(token);
  const doc = found?.docs.find((d) => d.id === documentId);
  if (!doc?.blobPath) throw new Error("Document not found.");
  return doc;
}

/**
 * Chases the head on queries waiting on them. Run daily; each query is
 * chased once a week at most. Returns how many were chased.
 */
export async function remindHoiOfQueries(now = new Date()) {
  const waiting = await db.select().from(schema.auditQueries)
    .where(and(eq(schema.auditQueries.addressedTo, "hoi"), eq(schema.auditQueries.status, "open")));
  let chased = 0;
  for (const q of waiting) {
    const messages = await messagesOf([q.id]);
    const lastActivity = messages.at(-1)?.at ?? q.raisedAt;
    if (!reminderDue({ lastActivity, remindedAt: q.remindedAt, now })) continue;
    const book = await bookOf(q.accountId);
    const days = Math.floor((+now - +lastActivity) / 86_400_000);
    const mail = {
      subject: `Reminder: audit query waiting on the head of ${book.school.name}`,
      heading: "An audit query is waiting for the head's answer",
      body: `A query on <strong>${escape(bookName(book))}</strong> has waited ${days} days for the head of institution's answer.`
        + `<br><br><em>${escape(q.subject)}</em>`,
    };
    await db.update(schema.auditQueries).set({ remindedAt: now }).where(eq(schema.auditQueries.id, q.id));
    await tellHoi(q, book, mail);
    await tell(await schoolContacts(q.orgId, book.school.id), { ...mail, linkPath: `/app/${q.accountId}/queries` });
    chased++;
  }
  return chased;
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
