import "server-only";
import {
  balancesAfter, buildCashBook, buildCashFlow, buildLedger, buildTrialBalance,
  csvAmount, toCsv,
} from "@/domain";
import { loadBook } from "@/server/book-context";
import {
  before, getEnrolmentInForce, getReceiptEnrolment, getTxns, getVoteHeadRates, inMonth, upTo,
} from "@/server/queries";
import { getReportPeriod, monthKey, monthName } from "@/server/periods";
import { getReconciliation } from "@/server/reconciliation";

export type ReportName =
  | "cash-book" | "ledger" | "trial-balance" | "cash-flow"
  | "receipts" | "payments" | "vote-heads" | "bank-reconciliation";

export type Cell = string | number;

export interface Section {
  heading?: string;
  columns?: string[];
  rows: Cell[][];
  /** Rendered as the closing rule row: the accounting total. */
  total?: Cell[];
  note?: string;
}

/**
 * One report, as data. The CSV and the PDF are both built from this, so a
 * downloaded file can never disagree with the other or with the screen.
 */
export interface ReportDoc {
  title: string;
  school: string;
  account: string;
  fyLabel: string;
  period: string;
  landscape: boolean;
  filename: string;
  sections: Section[];
}

const WIDE: ReportName[] = ["cash-book", "ledger", "payments", "vote-heads"];

export async function reportDoc(
  accountId: string,
  report: ReportName,
  asked?: string,
): Promise<ReportDoc> {
  const { heads, fy, school, account } = await loadBook(accountId);
  const txns = await getTxns(fy.id);
  const { period } = await getReportPeriod(fy.id, txns, asked);
  const month = monthKey(period.month);
  const asAt = monthName(period.month);

  let title = "";
  let periodLabel = asAt;
  let sections: Section[] = [];

  if (report === "cash-book") {
    title = "Analysed cash book";
    const opening = balancesAfter(
      { cash: fy.openingCash, bank: fy.openingBank },
      before(txns, month),
    );
    const cb = buildCashBook(opening, inMonth(txns, month), heads);
    const columns = ["Date", "Particulars", "Ref", "Cash", "Bank", "Total", ...heads.map((h) => h.name)];

    const side = (
      heading: string,
      lines: typeof cb.receipts,
      totals: typeof cb.receiptTotals,
      carry: { label: string; cash: number; bank: number },
      carryFirst: boolean,
    ): Section => {
      const carryRow: Cell[] = ["", carry.label, "", csvAmount(carry.cash), csvAmount(carry.bank), "", ...heads.map(() => "")];
      const body: Cell[][] = lines.map((r) => [
        r.date, r.particulars, r.ref ?? "",
        csvAmount(r.cash), csvAmount(r.bank), csvAmount(r.total),
        ...heads.map((h) => csvAmount(r.analysis[h.code] ?? 0)),
      ]);
      return {
        heading,
        columns,
        rows: carryFirst ? [carryRow, ...body] : [...body, carryRow],
        total: ["", "Totals", "",
          csvAmount(totals.cash + carry.cash), csvAmount(totals.bank + carry.bank), csvAmount(totals.total),
          ...heads.map((h) => csvAmount(totals.analysis[h.code] ?? 0))],
      };
    };

    sections = [
      side("Receipts", cb.receipts, cb.receiptTotals,
        { label: "Balance brought down", ...cb.opening }, true),
      side("Payments", cb.payments, cb.paymentTotals,
        { label: "Balance carried down", ...cb.closing }, false),
    ];
  }

  if (report === "ledger") {
    title = "Ledger accounts";
    periodLabel = `Year to date, ${asAt}`;
    const lines = buildLedger(upTo(txns, month), heads);
    const totals = lines.reduce((a, l) => ({ dr: a.dr + l.dr, cr: a.cr + l.cr }), { dr: 0, cr: 0 });
    sections = [{
      columns: ["Code", "Vote head", "Received (Cr)", "Spent (Dr)", "Balance", "Used %"],
      rows: lines.map((l) => [
        l.code, l.name, csvAmount(l.cr), csvAmount(l.dr), csvAmount(l.cr - l.dr),
        l.cr ? `${Math.round((l.dr / l.cr) * 100)}%` : "",
      ]),
      total: ["", "Total", csvAmount(totals.cr), csvAmount(totals.dr), csvAmount(totals.cr - totals.dr), ""],
    }];
  }

  if (report === "trial-balance") {
    title = "Trial balance";
    periodLabel = `As at ${asAt}`;
    const tb = buildTrialBalance(
      asAt, { cash: fy.openingCash, bank: fy.openingBank }, upTo(txns, month), heads,
    );
    sections = [{
      columns: ["Details", "Dr", "Cr"],
      rows: [
        ["Balance brought down — cash", "", csvAmount(tb.openingCash)],
        ["Balance brought down — bank", "", csvAmount(tb.openingBank)],
        ...tb.lines.map((l) => [l.name, csvAmount(l.dr), csvAmount(l.cr)]),
        ["Balance carried down — cash", csvAmount(tb.closingCash), ""],
        ["Balance carried down — bank", csvAmount(tb.closingBank), ""],
      ],
      total: ["Total", csvAmount(tb.totalDr), csvAmount(tb.totalCr)],
      note: tb.balanced
        ? "The book balances. This month can be closed."
        : `Out by ${csvAmount(tb.difference)}. Find the entry before closing.`,
    }];
  }

  if (report === "cash-flow") {
    title = "Cash flow statement";
    periodLabel = `Year to date, ${asAt}`;
    const cf = buildCashFlow(
      asAt, { cash: fy.openingCash, bank: fy.openingBank }, upTo(txns, month),
    );
    sections = [
      {
        columns: ["Details", "Amount"],
        rows: [
          ["Opening balance brought forward", csvAmount(cf.openingTotal)],
          ["Receipts — capitation and other income", csvAmount(cf.receipts)],
          ["Payments — bank", csvAmount(-cf.paymentsBank)],
          ["Payments — cash", csvAmount(-cf.paymentsCash)],
        ],
        total: ["Closing balance — cash and bank", csvAmount(cf.closingTotal)],
      },
      {
        heading: "Where the closing balance sits",
        columns: ["", "Amount"],
        rows: [
          ["Cash at hand", csvAmount(cf.closingCash)],
          ["Balance at bank", csvAmount(cf.closingBank)],
        ],
      },
    ];
  }

  if (report === "receipts") {
    title = "Receipts";
    periodLabel = `FY ${fy.label}`;
    const received = Object.fromEntries(buildLedger(txns, heads).map((l) => [l.code, l.cr]));
    const receipts = txns
      .filter((t) => t.kind === "receipt")
      .sort((a, b) => a.date.localeCompare(b.date));
    const total = receipts.reduce((a, r) => a + (r.kind === "receipt" ? r.cash + r.bank : 0), 0);
    sections = [
      {
        heading: "Receipts posted",
        columns: ["Date", "Receipt no.", "Particulars", "Cash", "Bank", "Total"],
        rows: receipts.map((r) => [
          r.date, (r.kind === "receipt" && r.receiptNo) || "", r.particulars,
          csvAmount(r.kind === "receipt" ? r.cash : 0),
          csvAmount(r.kind === "receipt" ? r.bank : 0),
          csvAmount(r.kind === "receipt" ? r.cash + r.bank : 0),
        ]),
        total: ["", "", "Total received", "", "", csvAmount(total)],
      },
      {
        heading: "Total received per vote head",
        columns: ["Code", "Vote head", "Total received"],
        rows: heads.map((h) => [h.code, h.name, csvAmount(received[h.code] ?? 0)]),
        total: ["", "Total", csvAmount(total)],
      },
    ];
  }

  if (report === "payments") {
    title = "Payments";
    periodLabel = `FY ${fy.label}`;
    const payments = txns
      .filter((t) => t.kind === "payment")
      .sort((a, b) => a.date.localeCompare(b.date));
    sections = [{
      columns: ["Date", "VR no.", "Particulars", "Vote heads", "Cash", "Bank"],
      rows: payments.map((p) => [
        p.date, (p.kind === "payment" && p.vrNo) || "", p.particulars,
        p.kind === "payment"
          ? p.allocations.map((a) => `${a.voteHeadCode} ${csvAmount(a.amount)}`).join("; ")
          : "",
        csvAmount(p.kind === "payment" ? p.cash : 0),
        csvAmount(p.kind === "payment" ? p.bank : 0),
      ]),
      total: ["", "", "Total paid", "",
        csvAmount(payments.reduce((a, p) => a + (p.kind === "payment" ? p.cash : 0), 0)),
        csvAmount(payments.reduce((a, p) => a + (p.kind === "payment" ? p.bank : 0), 0))],
    }];
  }

  if (report === "bank-reconciliation") {
    title = "Bank reconciliation statement";
    const { reconciliation: r } = await getReconciliation(accountId, asked);
    sections = [
      {
        columns: ["Details", "Amount"],
        rows: [
          ["Balance per cash book — bank column", csvAmount(r.perCashBook)],
          ...(r.uncreditedTotal
            ? [["Less deposits not yet credited", csvAmount(-r.uncreditedTotal)] as Cell[]]
            : []),
          ...(r.unpresentedTotal
            ? [["Add cheques not yet presented", csvAmount(r.unpresentedTotal)] as Cell[]]
            : []),
          ["Balance the statement should show", csvAmount(r.expectedStatement)],
          ["Balance per bank statement", csvAmount(r.statementBalance)],
        ],
        total: ["Difference", csvAmount(r.difference)],
        note: r.reconciled
          ? "The book agrees with the statement."
          : "The book and the statement disagree. The entries behind the difference must be read "
            + "off the statement and posted; they are not worked out from the book.",
      },
      ...(r.uncredited.length ? [{
        heading: "Deposits not yet credited by the bank",
        columns: ["Date", "Particulars", "Ref", "Amount"],
        rows: r.uncredited.map((i) => [i.date, i.particulars, i.ref ?? "", csvAmount(i.amount)]),
        total: ["", "", "Total", csvAmount(r.uncreditedTotal)],
      }] : []),
      ...(r.unpresented.length ? [{
        heading: "Cheques not yet presented",
        columns: ["Date", "Particulars", "Cheque no.", "Amount"],
        rows: r.unpresented.map((i) => [i.date, i.particulars, i.ref ?? "", csvAmount(i.amount)]),
        total: ["", "", "Total", csvAmount(r.unpresentedTotal)],
      }] : []),
    ];
  }

  if (report === "vote-heads") {
    title = "Vote heads";
    const rates = await getVoteHeadRates(fy.id);
    const enrolment = await getEnrolmentInForce(fy.id);
    const learners = enrolment?.learners ?? 0;

    // What the circular entitles the school to at the enrolment in force. It is
    // not what was received — a disbursement can fall short — but it is the
    // figure the bursar checks the disbursement against.
    const due = (code: string) =>
      (rates[code]?.perLearner ?? 0) * learners + (rates[code]?.flatAmount ?? 0);

    periodLabel = enrolment
      ? `FY ${fy.label} · ${learners.toLocaleString("en-KE")} learners`
      : `FY ${fy.label}`;

    const received = Object.fromEntries(
      buildLedger(txns, heads).map((l) => [l.code, l.cr]),
    );

    sections = [{
      columns: [
        "#", "Code", "Name", "Rate per learner", "Flat amount", "Learners",
        "Due per disbursement", "Received to date",
      ],
      rows: heads.map((h) => [
        h.order, h.code, h.name,
        rates[h.code]?.perLearner ? csvAmount(rates[h.code].perLearner!) : "",
        rates[h.code]?.flatAmount ? csvAmount(rates[h.code].flatAmount!) : "",
        rates[h.code]?.perLearner && learners ? learners : "",
        due(h.code) ? csvAmount(due(h.code)) : "",
        received[h.code] ? csvAmount(received[h.code]) : "",
      ]),
      total: ["", "", "Total", "", "", "",
        csvAmount(heads.reduce((a, h) => a + due(h.code), 0)),
        csvAmount(heads.reduce((a, h) => a + (received[h.code] ?? 0), 0))],
      note: enrolment
        ? `${learners.toLocaleString("en-KE")} learners, derived from the disbursement receipted `
          + `on ${enrolment.date}${enrolment.receiptNo ? ` (${enrolment.receiptNo})` : ""}. `
          + "The amounts due are what the rates come to at that enrolment, not what was received."
        : "No capitation receipt has been posted yet, so there is no enrolment to work from.",
    }];
  }

  return {
    title,
    school: school.name,
    account: account.name,
    fyLabel: fy.label,
    period: periodLabel,
    landscape: WIDE.includes(report),
    filename: slug(`${school.name} ${account.name} ${title} ${month}`),
    sections,
  };
}

/**
 * The acknowledgement of one capitation receipt: the enrolment used and the
 * per-head split, the figures the Ministry asks back for.
 */
export async function acknowledgementDoc(
  accountId: string,
  transactionId: string,
): Promise<ReportDoc> {
  const { heads, fy, school, account } = await loadBook(accountId);
  const txns = await getTxns(fy.id);
  const txn = txns.find((t) => t.id === transactionId);
  if (!txn || txn.kind !== "receipt") throw new Error("Receipt not found.");

  const enrolment = await getReceiptEnrolment(transactionId);
  const nameOf = (code: string) => heads.find((h) => h.code === code)?.name ?? code;
  const total = txn.cash + txn.bank;

  return {
    title: "Acknowledgement of receipt",
    school: school.name,
    account: account.name,
    fyLabel: fy.label,
    period: txn.date,
    landscape: false,
    filename: slug(`${school.name} acknowledgement ${txn.receiptNo || txn.date}`),
    sections: [
      {
        columns: ["Details", ""],
        rows: [
          ["Date received", txn.date],
          ["Receipt no.", txn.receiptNo ?? "—"],
          ["Particulars", txn.particulars],
          ["Amount received", csvAmount(total)],
          ["Enrolment used", enrolment ?? "—"],
        ],
      },
      {
        heading: "Distribution per vote head",
        columns: ["Code", "Vote head", "Amount"],
        rows: txn.allocations.map((a) => [a.voteHeadCode, nameOf(a.voteHeadCode), csvAmount(a.amount)]),
        total: ["", "Total", csvAmount(total)],
        note: "The enrolment shown was derived from the amount disbursed and the per-learner "
          + "rates in the circular in force. Signed ______________________ on ______________.",
      },
    ],
  };
}

/** One payment voucher: what was paid, out of which column, against which votes. */
export async function paymentVoucherDoc(
  accountId: string,
  transactionId: string,
): Promise<ReportDoc> {
  const { heads, fy, school, account } = await loadBook(accountId);
  const txns = await getTxns(fy.id);
  const txn = txns.find((t) => t.id === transactionId);
  if (!txn || txn.kind !== "payment") throw new Error("Payment not found.");

  const nameOf = (code: string) => heads.find((h) => h.code === code)?.name ?? code;
  const total = txn.cash + txn.bank;

  return {
    title: "Payment voucher",
    school: school.name,
    account: account.name,
    fyLabel: fy.label,
    period: txn.date,
    landscape: false,
    filename: slug(`${school.name} payment voucher ${txn.vrNo || txn.date}`),
    sections: [
      {
        columns: ["Details", ""],
        rows: [
          ["Date paid", txn.date],
          ["Voucher no.", txn.vrNo ?? "—"],
          ["Cheque no.", txn.chequeNo ?? "—"],
          ["Particulars", txn.particulars],
          ["Paid from", txn.cash > 0 ? "Cash" : "Bank"],
          ["Amount paid", csvAmount(total)],
        ],
      },
      {
        heading: "Charged to",
        columns: ["Code", "Vote head", "Amount"],
        rows: txn.allocations.map((a) => [a.voteHeadCode, nameOf(a.voteHeadCode), csvAmount(a.amount)]),
        total: ["", "Total", csvAmount(total)],
        note: "Certified that the goods or services were received and the expenditure is a proper "
          + "charge against the votes shown. Signed ______________________ on ______________.",
      },
    ],
  };
}

const slug = (s: string) =>
  s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

/** The same document, flattened for a spreadsheet. */
export function docToCsv(doc: ReportDoc): { filename: string; csv: string } {
  const rows: Cell[][] = [
    [doc.school],
    [`${doc.title} — ${doc.account} account, FY ${doc.fyLabel}`],
    [doc.period],
    [],
  ];
  for (const s of doc.sections) {
    if (s.heading) rows.push([s.heading]);
    if (s.columns) rows.push(s.columns);
    rows.push(...s.rows);
    if (s.total) rows.push(s.total);
    if (s.note) rows.push([], [s.note]);
    rows.push([]);
  }
  return { filename: `${doc.filename}.csv`, csv: toCsv(rows) };
}

/** Excel on Windows needs the BOM to read the em dashes as UTF-8. */
export const csvResponse = ({ filename, csv }: { filename: string; csv: string }) =>
  new Response(`﻿${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
