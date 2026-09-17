import "server-only";
import {
  balancesAfter, buildCashBook, buildCashFlow, buildLedger, buildTrialBalance,
  csvAmount, toCsv,
} from "@/domain";
import { loadBook } from "@/server/book-context";
import { before, getTxns, getVoteHeadRates, inMonth, upTo } from "@/server/queries";
import { getReportPeriod, monthKey, monthName } from "@/server/periods";

export type ReportName =
  | "cash-book" | "ledger" | "trial-balance" | "cash-flow"
  | "receipts" | "payments" | "vote-heads";

type Rows = (string | number)[][];

/**
 * The CSV is derived from the same builders the page renders, so a downloaded
 * file can never disagree with what the bursar saw on the screen.
 */
export async function reportCsv(
  accountId: string,
  report: ReportName,
  asked?: string,
): Promise<{ filename: string; csv: string }> {
  const { heads, fy, school, account } = await loadBook(accountId);
  const txns = await getTxns(fy.id);
  const { period } = await getReportPeriod(fy.id, txns, asked);
  const month = monthKey(period.month);
  const asAt = monthName(period.month);

  const head = (title: string): Rows => [
    [school.name],
    [`${title} — ${account.name} account, FY ${fy.label}`],
    [asAt],
    [],
  ];

  let title = "";
  let rows: Rows = [];

  if (report === "cash-book") {
    title = "Analysed cash book";
    const opening = balancesAfter(
      { cash: fy.openingCash, bank: fy.openingBank },
      before(txns, month),
    );
    const cb = buildCashBook(opening, inMonth(txns, month), heads);
    const cols = ["Date", "Particulars", "Ref", "Cash", "Bank", "Total", ...heads.map((h) => h.name)];

    const side = (
      label: string,
      lines: typeof cb.receipts,
      totals: typeof cb.receiptTotals,
      carry: { label: string; cash: number; bank: number },
      carryFirst: boolean,
    ): Rows => {
      const carryRow: Rows = [["", carry.label, "", csvAmount(carry.cash), csvAmount(carry.bank), "", ...heads.map(() => "")]];
      const body: Rows = lines.map((r) => [
        r.date, r.particulars, r.ref ?? "",
        csvAmount(r.cash), csvAmount(r.bank), csvAmount(r.total),
        ...heads.map((h) => csvAmount(r.analysis[h.code] ?? 0)),
      ]);
      return [
        [label], cols,
        ...(carryFirst ? carryRow : []), ...body, ...(carryFirst ? [] : carryRow),
        ["", "Totals", "",
          csvAmount(totals.cash + carry.cash), csvAmount(totals.bank + carry.bank), csvAmount(totals.total),
          ...heads.map((h) => csvAmount(totals.analysis[h.code] ?? 0))],
        [],
      ];
    };

    rows = [
      ...head(title),
      ...side("Receipts", cb.receipts, cb.receiptTotals,
        { label: "Balance brought down", ...cb.opening }, true),
      ...side("Payments", cb.payments, cb.paymentTotals,
        { label: "Balance carried down", ...cb.closing }, false),
    ];
  }

  if (report === "ledger") {
    title = "Ledger accounts";
    const lines = buildLedger(upTo(txns, month), heads);
    const totals = lines.reduce((a, l) => ({ dr: a.dr + l.dr, cr: a.cr + l.cr }), { dr: 0, cr: 0 });
    rows = [
      ...head(title),
      ["Code", "Vote head", "Received (Cr)", "Spent (Dr)", "Balance", "Used %"],
      ...lines.map((l) => [
        l.code, l.name, csvAmount(l.cr), csvAmount(l.dr), csvAmount(l.cr - l.dr),
        l.cr ? Math.round((l.dr / l.cr) * 100) : "",
      ]),
      ["", "Total", csvAmount(totals.cr), csvAmount(totals.dr), csvAmount(totals.cr - totals.dr), ""],
    ];
  }

  if (report === "trial-balance") {
    title = "Trial balance";
    const tb = buildTrialBalance(
      asAt, { cash: fy.openingCash, bank: fy.openingBank }, upTo(txns, month), heads,
    );
    rows = [
      ...head(title),
      ["Details", "Dr", "Cr"],
      ["Balance brought down — cash", "", csvAmount(tb.openingCash)],
      ["Balance brought down — bank", "", csvAmount(tb.openingBank)],
      ...tb.lines.map((l) => [l.name, csvAmount(l.dr), csvAmount(l.cr)]),
      ["Balance carried down — cash", csvAmount(tb.closingCash), ""],
      ["Balance carried down — bank", csvAmount(tb.closingBank), ""],
      ["Total", csvAmount(tb.totalDr), csvAmount(tb.totalCr)],
      [],
      [tb.balanced ? "The book balances." : `Out by ${csvAmount(tb.difference)}.`],
    ];
  }

  if (report === "cash-flow") {
    title = "Cash flow statement";
    const cf = buildCashFlow(
      asAt, { cash: fy.openingCash, bank: fy.openingBank }, upTo(txns, month),
    );
    rows = [
      ...head(title),
      ["Details", "Amount"],
      ["Opening balance brought forward", csvAmount(cf.openingTotal)],
      ["Receipts — capitation and other income", csvAmount(cf.receipts)],
      ["Payments — bank", csvAmount(-cf.paymentsBank)],
      ["Payments — cash", csvAmount(-cf.paymentsCash)],
      ["Closing balance — cash and bank", csvAmount(cf.closingTotal)],
      [],
      ["Cash at hand", csvAmount(cf.closingCash)],
      ["Balance at bank", csvAmount(cf.closingBank)],
    ];
  }

  if (report === "receipts") {
    title = "Receipts";
    const received = Object.fromEntries(buildLedger(txns, heads).map((l) => [l.code, l.cr]));
    const receipts = txns
      .filter((t) => t.kind === "receipt")
      .sort((a, b) => a.date.localeCompare(b.date));
    rows = [
      ...head(title),
      ["Receipts posted"],
      ["Date", "Receipt no.", "Particulars", "Cash", "Bank", "Total"],
      ...receipts.map((r) => [
        r.date, (r.kind === "receipt" && r.receiptNo) || "", r.particulars,
        csvAmount(r.kind === "receipt" ? r.cash : 0),
        csvAmount(r.kind === "receipt" ? r.bank : 0),
        csvAmount(r.kind === "receipt" ? r.cash + r.bank : 0),
      ]),
      [],
      ["Total received per vote head"],
      ["Code", "Vote head", "Total received"],
      ...heads.map((h) => [h.code, h.name, csvAmount(received[h.code] ?? 0)]),
    ];
  }

  if (report === "payments") {
    title = "Payments";
    const payments = txns
      .filter((t) => t.kind === "payment")
      .sort((a, b) => a.date.localeCompare(b.date));
    rows = [
      ...head(title),
      ["Date", "VR no.", "Particulars", "Vote heads", "Cash", "Bank"],
      ...payments.map((p) => [
        p.date, (p.kind === "payment" && p.vrNo) || "", p.particulars,
        p.kind === "payment"
          ? p.allocations.map((a) => `${a.voteHeadCode} ${csvAmount(a.amount)}`).join("; ")
          : "",
        csvAmount(p.kind === "payment" ? p.cash : 0),
        csvAmount(p.kind === "payment" ? p.bank : 0),
      ]),
      ["", "", "Total paid", "",
        csvAmount(payments.reduce((a, p) => a + (p.kind === "payment" ? p.cash : 0), 0)),
        csvAmount(payments.reduce((a, p) => a + (p.kind === "payment" ? p.bank : 0), 0))],
    ];
  }

  if (report === "vote-heads") {
    title = "Vote heads";
    const rates = await getVoteHeadRates(fy.id);
    rows = [
      ...head(title),
      ["#", "Code", "Name", "Rate per learner", "Flat amount"],
      ...heads.map((h) => [
        h.order, h.code, h.name,
        rates[h.code]?.perLearner ? csvAmount(rates[h.code].perLearner!) : "",
        rates[h.code]?.flatAmount ? csvAmount(rates[h.code].flatAmount!) : "",
      ]),
    ];
  }

  const slug = `${school.name} ${account.name} ${title} ${month}`
    .replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

  return { filename: `${slug}.csv`, csv: toCsv(rows) };
}

/** Excel on Windows needs the BOM to read the em dashes as UTF-8. */
export const csvResponse = ({ filename, csv }: { filename: string; csv: string }) =>
  new Response(`﻿${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
