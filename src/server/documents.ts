import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { get, put } from "@vercel/blob";
import { db, schema } from "@/db";
import {
  DOCUMENT_KINDS, documentProblem, infrastructurePaymentProblem, projectKey, statementCoverageProblem, takesProject,
  uncoveredMonths,
  type AccountType,
} from "@/domain";
import { loadBook } from "@/server/book-context";
import { getTxns } from "@/server/queries";
import { requestForToken } from "@/server/authorisation";

/**
 * Supporting documents on payments, and the SCDE approval on infrastructure
 * projects. Files sit in a private blob store: nothing is reachable by its
 * address, and every read comes through here, behind the same check as the
 * book itself. See src/domain/documents.ts.
 */

export const storageReady = (): boolean =>
  Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);

async function store(schoolId: string, file: File) {
  if (!storageReady()) throw new Error("File storage is not set up on Zaroda Books yet.");
  const problem = documentProblem(file);
  if (problem) throw new Error(problem);
  const bytes = Buffer.from(await file.arrayBuffer());
  const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-80) || "document";
  const blobPath = `schools/${schoolId}/${randomUUID()}-${safe}`;
  await put(blobPath, bytes, { access: "private", contentType: file.type, addRandomSuffix: false });
  return {
    blobPath, fileName: file.name.slice(0, 200), contentType: file.type, size: file.size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

/** A stored file, streamed to whoever the caller has already let see it. */
async function stream(blobPath: string, fileName: string) {
  const found = await get(blobPath, { access: "private" });
  if (!found || found.statusCode !== 200) throw new Error("That file could not be found.");
  return new Response(found.stream, {
    headers: {
      "Content-Type": found.blob.contentType,
      "Content-Disposition": `inline; filename="${fileName.replace(/[^\w.-]+/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** The payment, if it is in this book, with whether its month is closed. */
async function paymentIn(fyId: string, transactionId: string) {
  const [row] = await db
    .select({ txn: schema.transactions, period: schema.periods })
    .from(schema.transactions)
    .innerJoin(schema.periods, eq(schema.periods.id, schema.transactions.periodId))
    .where(and(eq(schema.transactions.id, transactionId), eq(schema.periods.financialYearId, fyId)));
  if (!row || row.txn.kind !== "payment") throw new Error("Payment not found.");
  return row;
}

export type PaymentDocument = typeof schema.paymentDocuments.$inferSelect;

/** Documents still attached, by payment. */
export async function documentsFor(transactionIds: string[]) {
  const byTxn = new Map<string, PaymentDocument[]>();
  if (!transactionIds.length) return byTxn;
  const rows = await db.select().from(schema.paymentDocuments)
    .where(and(inArray(schema.paymentDocuments.transactionId, transactionIds), isNull(schema.paymentDocuments.removedAt)))
    .orderBy(schema.paymentDocuments.addedAt);
  for (const r of rows) byTxn.set(r.transactionId, [...(byTxn.get(r.transactionId) ?? []), r]);
  return byTxn;
}

/** A file, or a note that the original is on the paper file (`file` null). */
export async function attachPaymentDocument(accountId: string, transactionId: string, kind: string, file: File | null) {
  const { user, fy, school } = await loadBook(accountId, { write: true, require: "entry.post" });
  if (!(DOCUMENT_KINDS as readonly string[]).includes(kind)) throw new Error("Choose what the document is.");
  await paymentIn(fy.id, transactionId);
  const stored = file ? await store(school.id, file) : null;
  const [doc] = await db.insert(schema.paymentDocuments)
    .values({ transactionId, kind, addedBy: user.id, ...stored })
    .returning();
  await db.insert(schema.auditLog).values({
    orgId: user.orgId, userId: user.id, action: "document.added", entity: "payment_document", entityId: doc.id,
    after: JSON.stringify({ transactionId, kind, onPaper: !stored, sha256: stored?.sha256 ?? null }),
  });
}

/** Taken off the payment, not deleted: the file and the record stay for the trail. */
export async function removePaymentDocument(accountId: string, documentId: string) {
  const { user, fy } = await loadBook(accountId, { write: true, require: "entry.amend" });
  const [doc] = await db.select().from(schema.paymentDocuments).where(eq(schema.paymentDocuments.id, documentId));
  if (!doc || doc.removedAt) throw new Error("Document not found.");
  const { period } = await paymentIn(fy.id, doc.transactionId);
  if (period.status === "closed") throw new Error("This month is closed. Its documents can be added to, not removed.");
  await db.batch([
    db.update(schema.paymentDocuments).set({ removedAt: new Date(), removedBy: user.id })
      .where(eq(schema.paymentDocuments.id, doc.id)),
    db.insert(schema.auditLog).values({
      orgId: user.orgId, userId: user.id, action: "document.removed", entity: "payment_document", entityId: doc.id,
      before: JSON.stringify({ transactionId: doc.transactionId, kind: doc.kind, sha256: doc.sha256 }),
    }),
  ]);
}

export async function openPaymentDocument(accountId: string, documentId: string) {
  const { fy } = await loadBook(accountId);
  const [doc] = await db.select().from(schema.paymentDocuments).where(eq(schema.paymentDocuments.id, documentId));
  if (!doc?.blobPath || doc.removedAt) throw new Error("Document not found.");
  await paymentIn(fy.id, doc.transactionId);
  return stream(doc.blobPath, doc.fileName ?? "document");
}

/** For the head reviewing through the emailed link: only documents of payments on that list. */
export async function openDocumentForToken(token: string, documentId: string) {
  const found = await requestForToken(token);
  if (!found) throw new Error("This link is no longer usable.");
  const [doc] = await db.select().from(schema.paymentDocuments).where(eq(schema.paymentDocuments.id, documentId));
  if (!doc?.blobPath || doc.removedAt || !found.payments.some((s) => s.payment.id === doc.transactionId)) {
    throw new Error("Document not found.");
  }
  return stream(doc.blobPath, doc.fileName ?? "document");
}

export type ProjectLetter = typeof schema.projectLetters.$inferSelect;

/**
 * The school's infrastructure projects, as named on the receipts of every
 * year's infrastructure book, each with its SCDE approval if attached.
 */
export async function schoolProjects(schoolId: string) {
  const [named, letters] = await Promise.all([
    db.selectDistinct({ project: schema.transactions.project })
      .from(schema.transactions)
      .innerJoin(schema.periods, eq(schema.periods.id, schema.transactions.periodId))
      .innerJoin(schema.financialYears, eq(schema.financialYears.id, schema.periods.financialYearId))
      .innerJoin(schema.accounts, eq(schema.accounts.id, schema.financialYears.accountId))
      .where(and(
        eq(schema.accounts.schoolId, schoolId),
        eq(schema.accounts.type, "INFRASTRUCTURE"),
        eq(schema.transactions.kind, "receipt"),
      )),
    db.select().from(schema.projectLetters)
      .where(and(eq(schema.projectLetters.schoolId, schoolId), isNull(schema.projectLetters.removedAt))),
  ]);
  const projects = new Map<string, { key: string; name: string; letter: ProjectLetter | null }>();
  for (const { project } of named) {
    if (!project) continue;
    const key = projectKey(project);
    if (!projects.has(key)) projects.set(key, { key, name: project, letter: null });
  }
  for (const l of letters) {
    const p = projects.get(l.projectKey);
    if (p) p.letter = l;
  }
  return [...projects.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Why this infrastructure payment cannot be posted, or null. */
export async function infrastructureCheck(
  account: { type: string; authorisationExempt: boolean }, schoolId: string, project: string,
) {
  const takes = takesProject(account.type as AccountType);
  const projects = takes ? await schoolProjects(schoolId) : [];
  const found = projects.find((p) => p.key === projectKey(project));
  if (takes && project.trim() && !found && !account.authorisationExempt) {
    return "That project is not named on any receipt of this school. Choose one from the list.";
  }
  return infrastructurePaymentProblem({
    takesProject: takes, exempt: account.authorisationExempt, project, letterAttached: Boolean(found?.letter),
  });
}

/** Payments in an infrastructure book whose project has no SCDE approval attached. */
export async function paymentsWithoutScde(accountId: string, schoolId: string, fyId: string) {
  const projects = await schoolProjects(schoolId);
  const approved = new Set(projects.filter((p) => p.letter).map((p) => p.key));
  return (await getTxns(fyId))
    .flatMap((t) => t.kind === "payment" && !(t.project && approved.has(projectKey(t.project)))
      ? [{ vrNo: t.vrNo ?? "—", project: t.project ?? null }] : []);
}

export async function attachProjectLetter(accountId: string, projectName: string, file: File) {
  const { user, school, account } = await loadBook(accountId, { write: true, require: "entry.post" });
  if (!takesProject(account.type as AccountType)) throw new Error("Projects belong to the infrastructure account.");
  const project = (await schoolProjects(school.id)).find((p) => p.key === projectKey(projectName));
  if (!project) throw new Error("Project not found.");
  if (project.letter) throw new Error("This project's SCDE approval is already attached.");
  const stored = await store(school.id, file);
  const [letter] = await db.insert(schema.projectLetters).values({
    schoolId: school.id, projectKey: project.key, projectName: project.name, addedBy: user.id, ...stored,
  }).returning();
  await db.insert(schema.auditLog).values({
    orgId: user.orgId, userId: user.id, action: "scde.attached", entity: "project_letter", entityId: letter.id,
    after: JSON.stringify({ project: project.name, sha256: stored.sha256 }),
  });
}

/**
 * Only while no payment rests on it: once money has gone out for the project,
 * the approval it went out on stays.
 */
export async function removeProjectLetter(accountId: string, letterId: string) {
  const { user, school } = await loadBook(accountId, { write: true, require: "entry.delete" });
  const [letter] = await db.select().from(schema.projectLetters)
    .where(and(eq(schema.projectLetters.id, letterId), eq(schema.projectLetters.schoolId, school.id)));
  if (!letter || letter.removedAt) throw new Error("Approval not found.");
  const paid = await db.select({ project: schema.transactions.project })
    .from(schema.transactions)
    .innerJoin(schema.periods, eq(schema.periods.id, schema.transactions.periodId))
    .innerJoin(schema.financialYears, eq(schema.financialYears.id, schema.periods.financialYearId))
    .innerJoin(schema.accounts, eq(schema.accounts.id, schema.financialYears.accountId))
    .where(and(eq(schema.accounts.schoolId, school.id), eq(schema.transactions.kind, "payment")));
  if (paid.some((p) => p.project && projectKey(p.project) === letter.projectKey)) {
    throw new Error("Payments have been made for this project on this approval, so it stays attached.");
  }
  await db.batch([
    db.update(schema.projectLetters).set({ removedAt: new Date(), removedBy: user.id })
      .where(eq(schema.projectLetters.id, letter.id)),
    db.insert(schema.auditLog).values({
      orgId: user.orgId, userId: user.id, action: "scde.removed", entity: "project_letter", entityId: letter.id,
      before: JSON.stringify({ project: letter.projectName, sha256: letter.sha256 }),
    }),
  ]);
}

export async function openProjectLetter(accountId: string, letterId: string) {
  const { school } = await loadBook(accountId);
  const [letter] = await db.select().from(schema.projectLetters)
    .where(and(eq(schema.projectLetters.id, letterId), eq(schema.projectLetters.schoolId, school.id)));
  if (!letter || letter.removedAt) throw new Error("Approval not found.");
  return stream(letter.blobPath, letter.fileName);
}

/** The book's closed months, as "yyyy-mm", for knowing where documents may still be removed. */
export async function closedMonths(fyId: string) {
  const rows = await db.select({ month: schema.periods.month }).from(schema.periods)
    .where(and(eq(schema.periods.financialYearId, fyId), eq(schema.periods.status, "closed")));
  return new Set(rows.map((r) => r.month.slice(0, 7)));
}

/** "Receipt (attached), Invoice (on paper file)", for printing. */
export const documentsLine = (docs: PaymentDocument[] | undefined) =>
  docs?.length ? docs.map((d) => `${d.kind} (${d.blobPath ? "attached" : "on paper file"})`).join(", ") : "None";

export type BankStatement = typeof schema.bankStatements.$inferSelect;

/** The book's months, "yyyy-mm", in order. */
async function bookMonths(fyId: string) {
  const rows = await db.select({ month: schema.periods.month }).from(schema.periods)
    .where(eq(schema.periods.financialYearId, fyId));
  return rows.map((r) => r.month.slice(0, 7)).sort();
}

export async function bankStatementsFor(accountId: string) {
  return db.select().from(schema.bankStatements)
    .where(and(eq(schema.bankStatements.accountId, accountId), isNull(schema.bankStatements.removedAt)))
    .orderBy(schema.bankStatements.fromMonth, schema.bankStatements.addedAt);
}

/** Months of the book no attached statement covers. The certificate does not stand in for a statement. */
export async function monthsWithoutStatement(accountId: string, fyId: string) {
  const [months, statements] = await Promise.all([bookMonths(fyId), bankStatementsFor(accountId)]);
  return uncoveredMonths(months, statements.filter((s) => s.kind === "statement")
    .map((s) => ({ from: s.fromMonth, to: s.toMonth })));
}

export async function attachBankStatement(accountId: string, input: {
  kind: string; from: string; to: string; file: File;
}) {
  const { user, fy, school } = await loadBook(accountId, { write: true, require: "entry.post" });
  const months = await bookMonths(fy.id);
  const kind = input.kind === "certificate" ? "certificate" : "statement";
  // The certificate speaks for the balance at the year end, so it sits on the last month.
  const [from, to] = kind === "certificate" ? [months.at(-1)!, months.at(-1)!] : [input.from, input.to];
  const problem = statementCoverageProblem(from, to, months);
  if (problem) throw new Error(problem);
  const stored = await store(school.id, input.file);
  const [row] = await db.insert(schema.bankStatements).values({
    accountId, kind, fromMonth: from, toMonth: to, addedBy: user.id, ...stored,
  }).returning();
  await db.insert(schema.auditLog).values({
    orgId: user.orgId, userId: user.id, action: "statement.added", entity: "bank_statement", entityId: row.id,
    after: JSON.stringify({ kind, from, to, sha256: stored.sha256 }),
  });
}

export async function removeBankStatement(accountId: string, statementId: string) {
  const { user, fy } = await loadBook(accountId, { write: true, require: "entry.amend" });
  const [row] = await db.select().from(schema.bankStatements)
    .where(and(eq(schema.bankStatements.id, statementId), eq(schema.bankStatements.accountId, accountId)));
  if (!row || row.removedAt) throw new Error("Statement not found.");
  const closed = await closedMonths(fy.id);
  if ([...closed].some((m) => row.fromMonth <= m && m <= row.toMonth)) {
    throw new Error("A month this statement covers is closed. It can be added to, not removed.");
  }
  await db.batch([
    db.update(schema.bankStatements).set({ removedAt: new Date(), removedBy: user.id })
      .where(eq(schema.bankStatements.id, row.id)),
    db.insert(schema.auditLog).values({
      orgId: user.orgId, userId: user.id, action: "statement.removed", entity: "bank_statement", entityId: row.id,
      before: JSON.stringify({ kind: row.kind, from: row.fromMonth, to: row.toMonth, sha256: row.sha256 }),
    }),
  ]);
}

export async function openBankStatement(accountId: string, statementId: string) {
  await loadBook(accountId);
  const [row] = await db.select().from(schema.bankStatements)
    .where(and(eq(schema.bankStatements.id, statementId), eq(schema.bankStatements.accountId, accountId)));
  if (!row || row.removedAt) throw new Error("Statement not found.");
  return stream(row.blobPath, row.fileName);
}
