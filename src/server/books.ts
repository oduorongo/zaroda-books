// No "server-only" here: the seed script imports this too, so the books are
// opened the same way whether they come from the UI or from a seed.
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";
import { chartFor } from "../domain/vote-heads.ts";
import type { AccountType, SchoolLevel } from "../domain/vote-heads.ts";

export type { SchoolLevel };

/** The financial year runs 1 July to 30 June. "2026/27" starts 1 July 2026. */
export function financialYearDates(label: string) {
  const startYear = Number(label.slice(0, 4));
  if (!Number.isInteger(startYear)) throw new Error(`Bad financial year label: ${label}`);
  return { startsOn: `${startYear}-07-01`, endsOn: `${startYear + 1}-06-30` };
}

export const monthsOf = (startsOn: string) => {
  const startYear = Number(startsOn.slice(0, 4));
  return Array.from({ length: 12 }, (_, i) => {
    const month = 7 + i;
    const year = month > 12 ? startYear + 1 : startYear;
    return `${year}-${String(month > 12 ? month - 12 : month).padStart(2, "0")}-01`;
  });
};

/**
 * Opens a school's set of books: the school, the account, its vote heads from
 * the chart of accounts, the financial year and its twelve periods. The chart
 * and the periods are fixed at creation and are never renumbered afterwards.
 */
export async function createBook(input: {
  orgId: string;
  schoolName: string;
  level: SchoolLevel;
  accountType: AccountType;
  fyLabel: string;
  openingCash?: number;
  openingBank?: number;
}) {
  const chart = chartFor(input.level, input.accountType);
  if (!chart) {
    throw new Error(`A ${input.level} school has no ${input.accountType} account.`);
  }

  const [school] = await db.insert(schema.schools).values({
    orgId: input.orgId,
    name: input.schoolName,
    level: input.level,
  }).returning();

  const [account] = await db.insert(schema.accounts).values({
    schoolId: school.id,
    type: input.accountType,
    name: chart.label,
  }).returning();

  const voteHeads = await db.insert(schema.voteHeads).values(
    chart.heads.map((h) => ({
      accountId: account.id, code: h.code, name: h.name, order: h.order,
    })),
  ).returning();

  const { startsOn, endsOn } = financialYearDates(input.fyLabel);
  const [financialYear] = await db.insert(schema.financialYears).values({
    accountId: account.id,
    label: input.fyLabel,
    startsOn,
    endsOn,
    openingCash: input.openingCash ?? 0,
    openingBank: input.openingBank ?? 0,
  }).returning();

  const periods = await db.insert(schema.periods).values(
    monthsOf(startsOn).map((month) => ({
      financialYearId: financialYear.id,
      month,
      status: "open" as const,
    })),
  ).returning();

  // The circular's figures, so the book opens with the rates in force. They
  // are editable: every disbursement is governed by the circular of the day.
  const idByCode = new Map(voteHeads.map((h) => [h.code, h.id]));
  const rates = chart.heads
    .filter((h) => h.perLearner || h.flat)
    .map((h) => ({
      financialYearId: financialYear.id,
      voteHeadId: idByCode.get(h.code)!,
      perLearner: h.perLearner ?? 0,
      flatAmount: h.flat ?? 0,
    }));
  if (rates.length) await db.insert(schema.voteHeadRates).values(rates);

  return { school, account, voteHeads, financialYear, periods, chart };
}

/**
 * Corrects the financial year a book was opened with. The twelve months are
 * rebuilt, so this is only allowed while the book is empty: moving the year
 * under posted entries would leave them filed in months that no longer exist.
 */
export async function changeFinancialYear(input: {
  accountId: string;
  userId: string;
  orgId: string;
  fyLabel: string;
}) {
  const [fy] = await db
    .select()
    .from(schema.financialYears)
    .where(eq(schema.financialYears.accountId, input.accountId));
  if (!fy) throw new Error("This book has no financial year.");
  if (fy.label === input.fyLabel) return;

  const periods = await db
    .select()
    .from(schema.periods)
    .where(eq(schema.periods.financialYearId, fy.id));

  if (periods.some((p) => p.status === "closed"))
    throw new Error("A month of this book is closed. Reopen it before changing the year.");

  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.transactions)
    .where(inArray(schema.transactions.periodId, periods.map((p) => p.id)));

  if (count > 0)
    throw new Error(
      `This book already has ${count} entr${count === 1 ? "y" : "ies"} posted. `
      + "The financial year sets which months exist, so it can only be corrected "
      + "while the book is empty. Delete the entries first, or open a new book.",
    );

  const { startsOn, endsOn } = financialYearDates(input.fyLabel);

  const writes = [
    db.update(schema.financialYears)
      .set({ label: input.fyLabel, startsOn, endsOn })
      .where(eq(schema.financialYears.id, fy.id)),
    db.delete(schema.periods).where(eq(schema.periods.financialYearId, fy.id)),
    db.insert(schema.periods).values(
      monthsOf(startsOn).map((month) => ({
        financialYearId: fy.id,
        month,
        status: "open" as const,
      })),
    ),
    db.insert(schema.auditLog).values({
      orgId: input.orgId,
      userId: input.userId,
      action: "update",
      entity: "financial_year",
      entityId: fy.id,
      before: JSON.stringify({ label: fy.label, startsOn: fy.startsOn, endsOn: fy.endsOn }),
      after: JSON.stringify({ label: input.fyLabel, startsOn, endsOn }),
    }),
  ] as const;
  await db.batch(writes as unknown as Parameters<typeof db.batch>[0]);
}

/**
 * Hides a book without destroying it. Every entry, period and vote head stays
 * exactly where it is, so a year an auditor asks for later can still be
 * produced, and a book that has been opened stays on the record however the
 * subscription is billed. Archiving is not a way to un-open a book.
 */
export async function archiveBook(input: {
  accountId: string;
  orgId: string;
  userId: string;
}) {
  const [row] = await db
    .select({ account: schema.accounts, school: schema.schools })
    .from(schema.accounts)
    .innerJoin(schema.schools, eq(schema.accounts.schoolId, schema.schools.id))
    .where(and(
      eq(schema.accounts.id, input.accountId),
      eq(schema.schools.orgId, input.orgId),
    ));
  if (!row) throw new Error("Book not found.");
  if (row.account.archivedAt) return;

  await db.batch([
    db.update(schema.accounts)
      .set({ archivedAt: new Date(), archivedBy: input.userId })
      .where(eq(schema.accounts.id, input.accountId)),
    db.insert(schema.auditLog).values({
      orgId: input.orgId,
      userId: input.userId,
      action: "archive",
      entity: "account",
      entityId: input.accountId,
      before: JSON.stringify({ school: row.school.name, account: row.account.name }),
    }),
  ] as unknown as Parameters<typeof db.batch>[0]);
}

export async function restoreBook(input: {
  accountId: string;
  orgId: string;
  userId: string;
}) {
  const [row] = await db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .innerJoin(schema.schools, eq(schema.accounts.schoolId, schema.schools.id))
    .where(and(
      eq(schema.accounts.id, input.accountId),
      eq(schema.schools.orgId, input.orgId),
    ));
  if (!row) throw new Error("Book not found.");

  await db.batch([
    db.update(schema.accounts)
      .set({ archivedAt: null, archivedBy: null })
      .where(eq(schema.accounts.id, input.accountId)),
    db.insert(schema.auditLog).values({
      orgId: input.orgId,
      userId: input.userId,
      action: "restore",
      entity: "account",
      entityId: input.accountId,
    }),
  ] as unknown as Parameters<typeof db.batch>[0]);
}

/** Archived books, for the list that offers them back. */
export async function getArchivedBooks(orgId: string) {
  return db
    .select({ account: schema.accounts, school: schema.schools })
    .from(schema.accounts)
    .innerJoin(schema.schools, eq(schema.accounts.schoolId, schema.schools.id))
    .where(and(eq(schema.schools.orgId, orgId), isNotNull(schema.accounts.archivedAt)))
    .orderBy(schema.schools.name);
}
