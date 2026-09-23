import "server-only";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  LETTER_DEFAULTS, TERMS, buildLetter, isCapitationAccount, seesCapitationLetter,
  type AccountType, type LetterDetails, type Receipt, type Term,
} from "@/domain";
import { loadBook } from "@/server/book-context";
import { getFinancialYear, getTxns } from "@/server/queries";

/**
 * The book the letter was opened from, refused as not found to anyone who
 * should not know it exists: an auditor, a freelancer, a person with no
 * position yet, a view-as session, or a book the Ministry does not fund.
 */
export async function loadLetterBook(accountId: string, opts: { write?: boolean } = {}) {
  const book = await loadBook(accountId, opts.write ? { write: true, require: "letter.edit" } : {});
  if (!seesCapitationLetter(book.user.position) || book.user.readOnly) notFound();
  if (!isCapitationAccount(book.school.level, book.account.type as AccountType)) notFound();
  return book;
}

/**
 * One letter covers every capitation book of the school — Operations and
 * Tuition go on the same page — with the receipts each holds this year.
 */
export async function letterBooks(schoolId: string, level: typeof schema.schools.$inferSelect.level) {
  const accounts = await db.select().from(schema.accounts)
    .where(and(eq(schema.accounts.schoolId, schoolId), isNull(schema.accounts.archivedAt)))
    .orderBy(schema.accounts.name);

  return Promise.all(
    accounts
      .filter((a) => isCapitationAccount(level, a.type as AccountType))
      .map(async (account) => {
        const fy = await getFinancialYear(account.id);
        const receipts = (await getTxns(fy.id))
          .filter((t): t is Receipt => t.kind === "receipt")
          .sort((a, b) => a.date.localeCompare(b.date));
        return { account, fy, receipts };
      }),
  );
}

/** Saved details over the defaults. The sub-county is the school's own. */
export async function letterDetailsFor(
  school: typeof schema.schools.$inferSelect,
): Promise<LetterDetails> {
  const [saved] = await db.select().from(schema.letterDetails)
    .where(eq(schema.letterDetails.schoolId, school.id));
  return {
    shortName: saved?.shortName ?? "",
    postalAddress: saved?.postalAddress ?? "",
    town: saved?.town ?? "",
    subCounty: school.subCounty ?? "",
    scdeAddress: saved?.scdeAddress ?? "",
    scdeTown: saved?.scdeTown ?? "",
    ministryName: saved?.ministryName || LETTER_DEFAULTS.ministryName,
    ministryAddress: saved?.ministryAddress || LETTER_DEFAULTS.ministryAddress,
    ministryEmail: saved?.ministryEmail || LETTER_DEFAULTS.ministryEmail,
    signatoryName: saved?.signatoryName ?? "",
    signatoryTitle: saved?.signatoryTitle ?? "",
  };
}

export type SavedDetails = Omit<LetterDetails, "subCounty">;

export async function saveLetterDetails(input: {
  accountId: string;
  details: SavedDetails;
  banks: { accountId: string; number: string; bankName: string; bankBranch: string }[];
}) {
  const { user, school } = await loadLetterBook(input.accountId, { write: true });
  const books = await letterBooks(school.id, school.level);
  const ours = new Set(books.map((b) => b.account.id));

  const values = { ...input.details, updatedAt: new Date(), updatedBy: user.id };
  await db.insert(schema.letterDetails).values({ schoolId: school.id, ...values })
    .onConflictDoUpdate({ target: schema.letterDetails.schoolId, set: values });

  // Only this school's capitation books: the ids arrive from the browser.
  for (const b of input.banks.filter((b) => ours.has(b.accountId))) {
    await db.update(schema.accounts)
      .set({ bankAccountNo: b.number || null, bankName: b.bankName || null, bankBranch: b.bankBranch || null })
      .where(eq(schema.accounts.id, b.accountId));
  }

  await db.insert(schema.auditLog).values({
    orgId: user.orgId, userId: user.id,
    action: "letter.details", entity: "school", entityId: school.id,
    before: null, after: JSON.stringify({ details: input.details, banks: input.banks }),
  });
}

export interface LetterChoice {
  term: Term;
  year: number;
  date: string;
  receiptIds: string[];
}

/** Reads the choice from a query string; null until it is complete. */
export function parseLetterChoice(q: URLSearchParams): LetterChoice | null {
  const term = Number(q.get("term")) as Term;
  const year = Number(q.get("year"));
  const date = q.get("date") ?? "";
  const receiptIds = q.getAll("r");
  if (!TERMS.includes(term) || !(year >= 2000 && year <= 2100)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || receiptIds.length === 0) return null;
  return { term, year, date, receiptIds };
}

/**
 * The letter for the ticked receipts. Each account's amount is what its
 * ticked receipts add to, so the letter cannot say other than the books.
 * A book with nothing ticked is left off.
 */
export async function letterFor(accountId: string, choice: LetterChoice) {
  const { school } = await loadLetterBook(accountId);
  const [books, details] = await Promise.all([
    letterBooks(school.id, school.level),
    letterDetailsFor(school),
  ]);
  const ticked = new Set(choice.receiptIds);

  const accounts = books
    .map(({ account, receipts }) => ({
      name: account.name,
      number: account.bankAccountNo ?? "",
      bankName: account.bankName ?? "",
      bankBranch: account.bankBranch ?? "",
      amount: receipts.filter((r) => ticked.has(r.id)).reduce((s, r) => s + r.cash + r.bank, 0),
    }))
    .filter((a) => a.amount > 0);
  if (accounts.length === 0) notFound();

  const letter = buildLetter({
    level: school.level, term: choice.term, year: choice.year, date: choice.date,
    schoolName: school.name, details, accounts,
  });
  const filename = `${school.name} capitation term ${choice.term} ${choice.year}`
    .replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return { letter, filename };
}
