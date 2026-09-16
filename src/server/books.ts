// No "server-only" here: the seed script imports this too, so the books are
// opened the same way whether they come from the UI or from a seed.
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";
import { CHART_OF_ACCOUNTS } from "../domain/vote-heads.ts";
import type { AccountType } from "../domain/vote-heads.ts";

export type SchoolLevel = "primary" | "junior" | "senior";

/** The financial year runs 1 July to 30 June. "2026/27" starts 1 July 2026. */
export function financialYearDates(label: string) {
  const startYear = Number(label.slice(0, 4));
  if (!Number.isInteger(startYear)) throw new Error(`Bad financial year label: ${label}`);
  return { startsOn: `${startYear}-07-01`, endsOn: `${startYear + 1}-06-30` };
}

const monthsOf = (startsOn: string) => {
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
  const heads = CHART_OF_ACCOUNTS[input.accountType];
  if (!heads) throw new Error(`Unknown account type: ${input.accountType}`);

  const [school] = await db.insert(schema.schools).values({
    orgId: input.orgId,
    name: input.schoolName,
    level: input.level,
  }).returning();

  const [account] = await db.insert(schema.accounts).values({
    schoolId: school.id,
    type: input.accountType,
    name: input.accountType,
  }).returning();

  const voteHeads = await db.insert(schema.voteHeads).values(
    heads.map((h) => ({ accountId: account.id, code: h.code, name: h.name, order: h.order })),
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

  return { school, account, voteHeads, financialYear, periods };
}
