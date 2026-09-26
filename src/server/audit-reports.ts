import "server-only";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  auditorCanSee, buildIpsasYear, compareIpsas, disbursementRows, previousFinancialYear,
  IPSAS_FUND_OF,
  type AccountType, type AccountYear, type Cents, type DisbursementRow, type Grant, type IpsasComparison,
} from "@/domain";
import { requireAuditor } from "@/server/audit";
import { getTxns, receiptProjects } from "@/server/queries";

/**
 * The auditor's reports on a school. Every function starts from the auditor's
 * grant, as src/server/audit.ts does: the school must be in their area and
 * have sent them at least one book.
 */
export async function auditedSchool(schoolId: string) {
  const { user, scope } = await requireAuditor();
  const [school] = await db.select().from(schema.schools).where(eq(schema.schools.id, schoolId));
  if (!school || !auditorCanSee(scope, school)) notFound();
  const accounts = await db.select().from(schema.accounts)
    .where(and(eq(schema.accounts.schoolId, schoolId), isNull(schema.accounts.archivedAt)));
  const sent = accounts.filter((a) => a.auditSentTo === scope.id);
  if (!sent.length) notFound();
  return { user, scope, school, accounts, sent };
}

/** The financial years in the books sent to this auditor, newest first. */
export async function sentYears(accountIds: string[]): Promise<string[]> {
  if (!accountIds.length) return [];
  const rows = await db.selectDistinct({ label: schema.financialYears.label })
    .from(schema.financialYears)
    .where(inArray(schema.financialYears.accountId, accountIds));
  return rows.map((r) => r.label).sort().reverse();
}

type Account = typeof schema.accounts.$inferSelect;

async function accountYear(account: Account, label: string) {
  const [fy] = await db.select().from(schema.financialYears)
    .where(and(eq(schema.financialYears.accountId, account.id), eq(schema.financialYears.label, label)));
  if (!fy) return null;
  const heads = await db.select().from(schema.voteHeads).where(eq(schema.voteHeads.accountId, account.id));
  const book: AccountYear = {
    type: account.type as AccountType,
    heads: heads.map((h) => ({ code: h.code, name: h.name, order: h.order })),
    opening: { cash: fy.openingCash, bank: fy.openingBank },
    txns: await getTxns(fy.id),
  };
  const periods = await db.select({ statementBank: schema.periods.statementBank })
    .from(schema.periods).where(eq(schema.periods.financialYearId, fy.id));
  return { fyId: fy.id, book, statements: periods.filter((p) => p.statementBank !== null).length, months: periods.length };
}

/** A project the infrastructure account received money for, as the school recorded it. */
export interface FundedProject { project: string; amount: Cents; approval: string; status: string }

/** A tuition payment large enough to list under procurement. */
export interface MajorPayment { amount: Cents; payee: string; chequeNo: string }

export interface IpsasYearData {
  label: string;
  comparison: IpsasComparison;
  grants: DisbursementRow[];
  procurement: MajorPayment[];
  /** Infrastructure receipts by project. Receipts posted before projects were asked for have none. */
  projects: FundedProject[];
  unnamedTransfers: Cents;
  /** Bank statements entered per book, as evidence for the reconciliation finding. */
  statements: { account: string; entered: number; months: number }[];
  /** Books kept that year but not sent to this auditor: their figures are left out. */
  notSent: string[];
}

/** Everything a report prints that comes from the books, for the years it covers. */
export interface IpsasData {
  school: string;
  county: string | null;
  subCounty: string | null;
  auditor: string;
  years: IpsasYearData[];
}

const PROCUREMENT_ROWS = 5;

/**
 * Worked from the books each time a draft is opened, and frozen into the
 * report when it is issued.
 *
 * The year covered uses only the books sent to this auditor. Its comparative
 * uses last year's figures from the same books, whether or not that year was
 * itself sent — figures only, per the rule that a comparative needs no access
 * to last year's entries.
 */
export async function ipsasData(schoolId: string, labels: string[], grantId: string, auditor: string): Promise<IpsasData> {
  const [school] = await db.select().from(schema.schools).where(eq(schema.schools.id, schoolId));
  const accounts = await db.select().from(schema.accounts)
    .where(and(eq(schema.accounts.schoolId, schoolId), isNull(schema.accounts.archivedAt)));

  const years: IpsasYearData[] = [];
  for (const label of [...labels].sort()) {
    const current: AccountYear[] = [];
    const statements: IpsasYearData["statements"] = [];
    const notSent: string[] = [];
    const grants: Grant[] = [];
    const procurement: MajorPayment[] = [];
    const projects = new Map<string, FundedProject>();
    let unnamedTransfers = 0;

    for (const a of accounts) {
      const y = await accountYear(a, label);
      if (!y) continue;
      if (a.auditSentTo !== grantId) { notSent.push(a.name); continue; }
      current.push(y.book);
      statements.push({ account: a.name, entered: y.statements, months: y.months });
      const fund = IPSAS_FUND_OF[y.book.type];
      if (fund === "infrastructure") {
        const named = await receiptProjects(y.fyId);
        for (const t of [...y.book.txns].sort((a, b) => a.date.localeCompare(b.date))) {
          if (t.kind !== "receipt") continue;
          const p = named.get(t.id);
          if (!p?.project) { unnamedTransfers += t.cash + t.bank; continue; }
          const was = projects.get(p.project);
          // The latest receipt's approval and status speak for the project.
          projects.set(p.project, {
            project: p.project,
            amount: (was?.amount ?? 0) + t.cash + t.bank,
            approval: p.approval ?? "",
            status: p.status ?? "",
          });
        }
      }
      for (const t of y.book.txns) {
        if (t.kind === "receipt" && (fund === "tuition" || fund === "operations")) {
          grants.push({ fund, date: t.date, amount: t.cash + t.bank });
        }
        if (t.kind === "payment" && fund === "tuition") {
          procurement.push({ amount: t.cash + t.bank, payee: t.particulars, chequeNo: t.chequeNo ?? "" });
        }
      }
    }

    // The same books as the year beside it, so the comparative and the check
    // on the fund brought forward compare like with like.
    const priorLabel = previousFinancialYear(label);
    const prior: AccountYear[] = [];
    if (priorLabel) {
      for (const a of accounts.filter((x) => x.auditSentTo === grantId)) {
        const y = await accountYear(a, priorLabel);
        if (y) prior.push(y.book);
      }
    }

    years.push({
      label,
      comparison: compareIpsas(buildIpsasYear(current), prior.length ? buildIpsasYear(prior) : null),
      grants: disbursementRows(grants),
      procurement: procurement.sort((a, b) => b.amount - a.amount).slice(0, PROCUREMENT_ROWS),
      projects: [...projects.values()],
      unnamedTransfers,
      statements,
      notSent,
    });
  }

  return { school: school.name, county: school.county, subCounty: school.subCounty, auditor, years };
}

/** What the auditor writes. Everything else on the report comes from the books. */
export interface IpsasContent {
  summary: string;
  objectives: string;
  scope: string;
  methodology: string;
  strengths: string;
  weaknesses: string;
  effectiveness: string;
  recommendations: { issue: string; comments: string; who: string; timeframe: string }[];
}

export const IPSAS_DEFAULTS: IpsasContent = {
  summary:
    "The internal audit covered the financial records and internal control systems of the school "
    + "for the period under review, in line with the International Public Sector Accounting "
    + "Standards (IPSAS).",
  objectives:
    "To give management assurance on how the school's key risks are managed, and independent, "
    + "objective advice to help it discharge its duties and responsibilities.",
  scope:
    "The audit followed a risk-based work plan and examined, on a test basis, evidence of "
    + "compliance with the laws and regulations that apply to IPSAS financial reporting. The "
    + "matters reported are those of significant risk; other matters or weaknesses may exist "
    + "that were not identified.",
  methodology:
    "Examination of the relevant documents.\n"
    + "Interviews with the head of institution, the bursar and stores personnel.\n"
    + "Confirmation of balances with the bank.\n"
    + "Physical verification and observation.",
  strengths: "",
  weaknesses: "",
  effectiveness:
    "The recommendations below are made to strengthen controls and reduce risk, not to conclude "
    + "that the school failed to observe them. No material weakness was found that would lead us "
    + "to conclude that internal control, risk management and governance were not effective.",
  recommendations: [],
};

export const parseContent = (json: string): IpsasContent => ({ ...IPSAS_DEFAULTS, ...JSON.parse(json || "{}") });

/** One report of this auditor's, or not found. */
export async function myReport(reportId: string) {
  const { user, scope } = await requireAuditor();
  const [report] = await db.select().from(schema.auditReports)
    .where(and(eq(schema.auditReports.id, reportId), eq(schema.auditReports.authoredBy, user.id)));
  if (!report) notFound();
  return { user, scope, report };
}

/** This auditor's reports on one school, newest first. */
export async function reportsOn(schoolId: string, userId: string) {
  return db.select().from(schema.auditReports)
    .where(and(eq(schema.auditReports.schoolId, schoolId), eq(schema.auditReports.authoredBy, userId)))
    .orderBy(desc(schema.auditReports.createdAt));
}

/**
 * The figures a report prints: frozen once issued, worked afresh while a
 * draft. A book the school has since taken back drops out of a draft and is
 * listed as not sent.
 */
export async function reportFigures(
  report: typeof schema.auditReports.$inferSelect,
  auditorName: string,
): Promise<IpsasData> {
  if (report.snapshot) return JSON.parse(report.snapshot);
  return ipsasData(report.schoolId, JSON.parse(report.years ?? "[]"), report.auditorId, auditorName);
}

/**
 * The school's side: its issued reports, whoever wrote them. Drafts stay the
 * auditor's. The caller has already checked the book belongs to this session.
 */
export async function issuedReportsOn(schoolId: string) {
  return db.select().from(schema.auditReports)
    .where(and(eq(schema.auditReports.schoolId, schoolId), eq(schema.auditReports.status, "issued")))
    .orderBy(desc(schema.auditReports.issuedAt));
}
