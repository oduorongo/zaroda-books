import { Fragment } from "react";
import { formatKes, previousFinancialYear, type Balances, type Cents, type IpsasFund, type IpsasRow } from "@/domain";
import type { IpsasContent, IpsasData, IpsasYearData } from "@/server/audit-reports";

/**
 * The IPSAS internal annual audit report, printed. Drafts, issued reports and
 * the school's own copy all render through this, so they cannot differ.
 *
 * Signatures and stamps are never drawn: the lines are left blank for the
 * people concerned to sign and stamp on paper.
 */

const RECEIPT_NOTE: Record<IpsasFund, [number, string]> = {
  tuition: [1, "Capitation grant for tuition"],
  operations: [2, "Capitation grant for operations"],
  infrastructure: [3, "Infrastructure grants"],
  schoolFund: [4, "Parents' contribution / school fund"],
};
const PAYMENT_NOTE: Record<IpsasFund, [number, string]> = {
  tuition: [6, "Payments for tuition"],
  operations: [7, "Payments for operations"],
  infrastructure: [8, "Infrastructure payments"],
  schoolFund: [9, "Boarding and school fund payments"],
};
const FUND_ACCOUNT: Record<IpsasFund, string> = {
  tuition: "Tuition account",
  operations: "Operations account",
  infrastructure: "Infrastructure account",
  schoolFund: "Parents / school fund account",
};
const FUNDS: IpsasFund[] = ["tuition", "operations", "infrastructure", "schoolFund"];

const kes = (c: Cents | null) => (c === null ? "" : c === 0 ? "-" : formatKes(c));
const total = (b: Balances) => b.cash + b.bank;
const sumRows = (rows: IpsasRow[], side: "current" | "prior") =>
  rows.some((r) => r[side] !== null) ? rows.reduce((a, r) => a + (r[side] ?? 0), 0) : null;

function yearEnding(label: string) {
  const end = Number(label.slice(0, 4)) + 1;
  return `30th June ${end}`;
}

const paragraphs = (s: string) =>
  s.split(/\n+/).map((p) => p.trim()).filter(Boolean);

function Bullets({ text, empty }: { text: string; empty?: string }) {
  const items = paragraphs(text);
  if (!items.length) return empty ? <p className="note">{empty}</p> : null;
  return <ul>{items.map((p, i) => <li key={i}>{p}</li>)}</ul>;
}

function SignOff({ lines }: { lines: string[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.6rem 2.5rem", marginTop: "2rem" }}>
      {lines.map((l) => (
        <Fragment key={l}>
          <div>Name ....................................................<br /><strong>{l}</strong></div>
          <div>Signature ..............................<br /><br />Date ....................................</div>
        </Fragment>
      ))}
    </div>
  );
}

function Head({ year, prior }: { year: IpsasYearData; prior: string }) {
  return (
    <thead>
      <tr><th>Details</th><th className="n">{year.label}<br />KES</th><th className="n">{prior}<br />KES</th></tr>
    </thead>
  );
}

function Note({ n, title, rows, year, prior }: {
  n: number; title: string; rows: IpsasRow[]; year: IpsasYearData; prior: string;
}) {
  return (
    <table style={{ marginBottom: "1.25rem" }}>
      <thead>
        <tr><th>{n}. {title}</th><th className="n">{year.label}<br />KES</th><th className="n">{prior}<br />KES</th></tr>
      </thead>
      <tbody>
        {rows.length === 0 && <tr><td className="note">Nil</td><td className="n">-</td><td className="n">{year.comparison.prior ? "-" : ""}</td></tr>}
        {rows.map((r) => (
          <tr key={r.code}><td>{r.name}</td><td className="n">{kes(r.current)}</td><td className="n">{kes(r.prior)}</td></tr>
        ))}
        <tr className="total"><td>Total</td><td className="n">{kes(sumRows(rows, "current") ?? 0)}</td><td className="n">{kes(sumRows(rows, "prior"))}</td></tr>
      </tbody>
    </table>
  );
}

function NilNote({ n, title, items, year, prior }: { n: number; title: string; items: string[]; year: IpsasYearData; prior: string }) {
  const p = year.comparison.prior ? "-" : "";
  return (
    <table style={{ marginBottom: "1.25rem" }}>
      <thead><tr><th>{n}. {title}</th><th className="n">{year.label}<br />KES</th><th className="n">{prior}<br />KES</th></tr></thead>
      <tbody>
        {items.map((i) => <tr key={i}><td>{i}</td><td className="n">-</td><td className="n">{p}</td></tr>)}
        <tr className="total"><td>Total</td><td className="n">-</td><td className="n">{p}</td></tr>
      </tbody>
    </table>
  );
}

function BalanceNote({ n, title, side, year, prior }: {
  n: number; title: string; side: "cash" | "bank"; year: IpsasYearData; prior: string;
}) {
  const c = year.comparison;
  return (
    <table style={{ marginBottom: "1.25rem" }}>
      <thead><tr><th>{n}. {title}</th><th className="n">{year.label}<br />KES</th><th className="n">{prior}<br />KES</th></tr></thead>
      <tbody>
        {FUNDS.map((f) => (
          <tr key={f}>
            <td>{FUND_ACCOUNT[f]}</td>
            <td className="n">{kes(c.current.closing[f][side])}</td>
            <td className="n">{kes(c.prior ? c.prior.closing[f][side] : null)}</td>
          </tr>
        ))}
        <tr className="total">
          <td>Total</td>
          <td className="n">{kes(c.current.closingTotal[side])}</td>
          <td className="n">{kes(c.prior ? c.prior.closingTotal[side] : null)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function Statements({ school, year }: { school: string; year: IpsasYearData }) {
  const c = year.comparison;
  const prior = c.prior ? previousFinancialYear(year.label) ?? "" : "—";
  const fundTotal = (side: "receipts" | "payments", f: IpsasFund) => ({
    current: sumRows(c[side][f], "current") ?? 0,
    prior: sumRows(c[side][f], "prior"),
  });
  const p = (v: Cents) => (c.prior ? v : null);

  return (
    <section className="ipsas-year">
      <h2 style={{ textAlign: "center" }}>{school}</h2>
      <h3 style={{ textAlign: "center" }}>Notes to the financial statements for the period ending {yearEnding(year.label)}</h3>

      {FUNDS.map((f) => (
        <Note key={f} n={RECEIPT_NOTE[f][0]} title={RECEIPT_NOTE[f][1]} rows={c.receipts[f]} year={year} prior={prior} />
      ))}
      <NilNote n={5} title="KPEEL account" items={["Grants for construction of classrooms"]} year={year} prior={prior} />
      {FUNDS.map((f) => (
        <Note key={f} n={PAYMENT_NOTE[f][0]} title={PAYMENT_NOTE[f][1]} rows={c.payments[f]} year={year} prior={prior} />
      ))}
      <NilNote n={10} title="KPEEL expenditures" items={["Classroom construction"]} year={year} prior={prior} />
      <BalanceNote n={11} title="Bank accounts" side="bank" year={year} prior={prior} />
      <BalanceNote n={12} title="Cash in hand" side="cash" year={year} prior={prior} />
      <NilNote n={13} title="Short term investments" items={["Cooperative shares", "Fixed deposit", "Equity stock"]} year={year} prior={prior} />
      <NilNote n={14} title="Accounts receivable" items={["Fees arrears", "Other non-fees receivables", "Salary advances"]} year={year} prior={prior} />
      <NilNote n={15} title="Accounts payable" items={["Trade creditors", "Prepaid fees", "Excess fees"]} year={year} prior={prior} />
      <table style={{ marginBottom: "1.25rem" }}>
        <thead><tr><th>16. Fund balance brought forward</th><th className="n">{year.label}<br />KES</th><th className="n">{prior}<br />KES</th></tr></thead>
        <tbody>
          <tr><td>Bank balances</td><td className="n">{kes(c.current.openingTotal.bank)}</td><td className="n">{kes(c.prior ? c.prior.openingTotal.bank : null)}</td></tr>
          <tr><td>Cash balances</td><td className="n">{kes(c.current.openingTotal.cash)}</td><td className="n">{kes(c.prior ? c.prior.openingTotal.cash : null)}</td></tr>
          <tr className="total"><td>Total</td><td className="n">{kes(total(c.current.openingTotal))}</td><td className="n">{kes(c.prior ? total(c.prior.openingTotal) : null)}</td></tr>
        </tbody>
      </table>
      {c.broughtForwardDifference !== null && c.broughtForwardDifference !== 0 && (
        <p className="error">
          The fund brought forward differs from the prior year&apos;s closing cash and bank by{" "}
          {formatKes(c.broughtForwardDifference)}. The books were not carried forward in full.
        </p>
      )}

      <h3 style={{ textAlign: "center", marginTop: "2rem" }}>Statement of receipts and payments for the period ending {yearEnding(year.label)}</h3>
      <table>
        <thead><tr><th>Receipts</th><th className="n">Notes</th><th className="n">{year.label}<br />KES</th><th className="n">{prior}<br />KES</th></tr></thead>
        <tbody>
          {FUNDS.map((f) => {
            const t = fundTotal("receipts", f);
            return <tr key={f}><td>{RECEIPT_NOTE[f][1]}</td><td className="n">{RECEIPT_NOTE[f][0]}</td><td className="n">{kes(t.current)}</td><td className="n">{kes(t.prior)}</td></tr>;
          })}
          <tr><td>KPEEL grants</td><td className="n">5</td><td className="n">-</td><td className="n">{kes(p(0))}</td></tr>
          <tr className="total"><td>Total receipts</td><td /><td className="n">{kes(c.current.totalReceipts)}</td><td className="n">{kes(c.prior?.totalReceipts ?? null)}</td></tr>
          <tr><th colSpan={4}>Payments</th></tr>
          {FUNDS.map((f) => {
            const t = fundTotal("payments", f);
            return <tr key={f}><td>{PAYMENT_NOTE[f][1]}</td><td className="n">{PAYMENT_NOTE[f][0]}</td><td className="n">{kes(t.current)}</td><td className="n">{kes(t.prior)}</td></tr>;
          })}
          <tr><td>KPEEL payments</td><td className="n">10</td><td className="n">-</td><td className="n">{kes(p(0))}</td></tr>
          <tr className="total"><td>Total payments</td><td /><td className="n">{kes(c.current.totalPayments)}</td><td className="n">{kes(c.prior?.totalPayments ?? null)}</td></tr>
          <tr className="total"><td>Surplus / (deficit)</td><td /><td className="n">{kes(c.current.surplus)}</td><td className="n">{kes(c.prior?.surplus ?? null)}</td></tr>
        </tbody>
      </table>
      <SignOff lines={["Chairman (BOM)", "Head teacher / Secretary (BOM)"]} />

      <h3 style={{ textAlign: "center", marginTop: "2rem" }}>Statement of financial assets and liabilities as at {yearEnding(year.label)}</h3>
      <table>
        <thead><tr><th>Financial assets</th><th className="n">Notes</th><th className="n">{year.label}<br />KES</th><th className="n">{prior}<br />KES</th></tr></thead>
        <tbody>
          <tr><td>Bank balances</td><td className="n">11</td><td className="n">{kes(c.current.closingTotal.bank)}</td><td className="n">{kes(c.prior?.closingTotal.bank ?? null)}</td></tr>
          <tr><td>Cash balances</td><td className="n">12</td><td className="n">{kes(c.current.closingTotal.cash)}</td><td className="n">{kes(c.prior?.closingTotal.cash ?? null)}</td></tr>
          <tr><td>Short term investments</td><td className="n">13</td><td className="n">-</td><td className="n">{kes(p(0))}</td></tr>
          <tr className="total"><td>Total cash and cash equivalents</td><td /><td className="n">{kes(total(c.current.closingTotal))}</td><td className="n">{kes(c.prior ? total(c.prior.closingTotal) : null)}</td></tr>
          <tr><td>Accounts receivable</td><td className="n">14</td><td className="n">-</td><td className="n">{kes(p(0))}</td></tr>
          <tr className="total"><td>Total financial assets</td><td /><td className="n">{kes(total(c.current.closingTotal))}</td><td className="n">{kes(c.prior ? total(c.prior.closingTotal) : null)}</td></tr>
          <tr><th colSpan={4}>Financial liabilities</th></tr>
          <tr><td>Accounts payable</td><td className="n">15</td><td className="n">-</td><td className="n">{kes(p(0))}</td></tr>
          <tr className="total"><td>Net financial assets</td><td /><td className="n">{kes(total(c.current.closingTotal))}</td><td className="n">{kes(c.prior ? total(c.prior.closingTotal) : null)}</td></tr>
          <tr><th colSpan={4}>Represented by</th></tr>
          <tr><td>Accumulated fund brought forward</td><td className="n">16</td><td className="n">{kes(total(c.current.openingTotal))}</td><td className="n">{kes(c.prior ? total(c.prior.openingTotal) : null)}</td></tr>
          <tr><td>Surplus / (deficit) for the year</td><td /><td className="n">{kes(c.current.surplus)}</td><td className="n">{kes(c.prior?.surplus ?? null)}</td></tr>
          <tr className="total"><td>Net financial position</td><td /><td className="n">{kes(total(c.current.openingTotal) + c.current.surplus)}</td><td className="n">{kes(c.prior ? total(c.prior.openingTotal) + c.prior.surplus : null)}</td></tr>
        </tbody>
      </table>
      <SignOff lines={["Chairman (BOM)", "Head teacher / Secretary (BOM)"]} />

      <h3 style={{ textAlign: "center", marginTop: "2rem" }}>Statement of cash flows for the period ending {yearEnding(year.label)}</h3>
      <table>
        <thead><tr><th>Cash flows from operating activities</th><th className="n">Notes</th><th className="n">{year.label}<br />KES</th><th className="n">{prior}<br />KES</th></tr></thead>
        <tbody>
          <tr><th colSpan={4}>Receipts</th></tr>
          {FUNDS.map((f) => {
            const t = fundTotal("receipts", f);
            return <tr key={f}><td>{RECEIPT_NOTE[f][1]}</td><td className="n">{RECEIPT_NOTE[f][0]}</td><td className="n">{kes(t.current)}</td><td className="n">{kes(t.prior)}</td></tr>;
          })}
          <tr className="total"><td>Total receipts</td><td /><td className="n">{kes(c.current.totalReceipts)}</td><td className="n">{kes(c.prior?.totalReceipts ?? null)}</td></tr>
          <tr><th colSpan={4}>Payments</th></tr>
          {FUNDS.map((f) => {
            const t = fundTotal("payments", f);
            return <tr key={f}><td>{PAYMENT_NOTE[f][1]}</td><td className="n">{PAYMENT_NOTE[f][0]}</td><td className="n">{kes(t.current)}</td><td className="n">{kes(t.prior)}</td></tr>;
          })}
          <tr className="total"><td>Total payments</td><td /><td className="n">{kes(c.current.totalPayments)}</td><td className="n">{kes(c.prior?.totalPayments ?? null)}</td></tr>
          <tr className="total"><td>Net cash flow from operating activities</td><td /><td className="n">{kes(c.current.surplus)}</td><td className="n">{kes(c.prior?.surplus ?? null)}</td></tr>
          <tr><td>Net cash flow from investing activities</td><td /><td className="n">-</td><td className="n">{kes(p(0))}</td></tr>
          <tr><td>Net cash flow from financing activities</td><td /><td className="n">-</td><td className="n">{kes(p(0))}</td></tr>
          <tr><td>Net increase / (decrease) in cash and cash equivalents</td><td /><td className="n">{kes(c.current.surplus)}</td><td className="n">{kes(c.prior?.surplus ?? null)}</td></tr>
          <tr><td>Cash and cash equivalents at the beginning of the year</td><td /><td className="n">{kes(total(c.current.openingTotal))}</td><td className="n">{kes(c.prior ? total(c.prior.openingTotal) : null)}</td></tr>
          <tr className="total"><td>Cash and cash equivalents at the end of the year</td><td /><td className="n">{kes(total(c.current.closingTotal))}</td><td className="n">{kes(c.prior ? total(c.prior.closingTotal) : null)}</td></tr>
        </tbody>
      </table>
    </section>
  );
}

export function IpsasReport({ data, content, issuedAt }: {
  data: IpsasData; content: IpsasContent; issuedAt: Date | null;
}) {
  const labels = data.years.map((y) => y.label);
  const first = labels[0];
  const last = labels[labels.length - 1];
  const ending = labels.map((l) => yearEnding(l).replace("30th June ", "")).join(" and ");
  const place = [data.subCounty && `${data.subCounty} sub-county`, data.county && `${data.county} county`].filter(Boolean).join(", ");

  return (
    <article className="ipsas-report">
      <header style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <h1 style={{ marginBottom: ".4rem" }}>{data.school}</h1>
        {place && <p style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>{place}</p>}
        <h2 style={{ marginTop: "2rem" }}>
          Internal annual audit report for {labels.length > 1 ? `${labels.length} years` : "the year"} ending 30th June, {ending}
        </h2>
        {!issuedAt && <p className="error no-print">Draft. Figures are worked from the books each time this page opens.</p>}
      </header>

      <h2>1. Executive summary</h2>
      <Bullets text={content.summary} />

      <h2>2. Background</h2>
      {place && <><h3>i) School location</h3><p>The institution is located in {place}.</p></>}
      <h3>ii) Grants for the period under review</h3>
      <table>
        <thead><tr><th>Year</th><th>Disbursement</th><th className="n">Tuition (KES)</th><th className="n">Operations (KES)</th><th className="n">Total (KES)</th></tr></thead>
        <tbody>
          {data.years.map((y) => y.grants.map((g, i) => (
            <tr key={`${y.label}-${i}`}>
              {i === 0 && <td rowSpan={y.grants.length}><strong>{y.label}</strong></td>}
              <td>Disbursement {i + 1}</td>
              <td className="n">{g.tuition === null ? "nil" : formatKes(g.tuition)}</td>
              <td className="n">{g.operations === null ? "nil" : formatKes(g.operations)}</td>
              <td className="n"><strong>{formatKes(g.total)}</strong></td>
            </tr>
          )))}
          <tr className="total">
            <td colSpan={2}>Total</td>
            <td className="n">{formatKes(data.years.reduce((a, y) => a + y.grants.reduce((x, g) => x + (g.tuition ?? 0), 0), 0))}</td>
            <td className="n">{formatKes(data.years.reduce((a, y) => a + y.grants.reduce((x, g) => x + (g.operations ?? 0), 0), 0))}</td>
            <td className="n">{formatKes(data.years.reduce((a, y) => a + y.grants.reduce((x, g) => x + g.total, 0), 0))}</td>
          </tr>
        </tbody>
      </table>

      <h2>3. Objectives of the engagement</h2>
      <Bullets text={content.objectives} />

      <h2>4. Scope of the engagement</h2>
      <p>The audit covered the period 1st July {first.slice(0, 4)} to {yearEnding(last)}.</p>
      <Bullets text={content.scope} />

      <h2>5. Methodology</h2>
      <ol>{paragraphs(content.methodology).map((m, i) => <li key={i}>{m}</li>)}</ol>

      <h2>6. Findings</h2>
      <h3>Areas of strength</h3>
      <Bullets text={content.strengths} empty="None recorded." />

      <h3>Maintenance and improvement fund</h3>
      <table>
        <thead><tr><th>Year</th>{data.years.map((y) => <th key={y.label}>{y.label}</th>)}</tr></thead>
        <tbody>
          <tr><td><strong>Approved project</strong></td>{data.years.map((y) => <td key={y.label}>{content.projects[y.label]?.project || "—"}</td>)}</tr>
          <tr><td><strong>Amount transferred</strong></td>{data.years.map((y) => <td key={y.label} className="n">{kes(sumRows(y.comparison.receipts.infrastructure, "current") ?? 0)}</td>)}</tr>
          <tr><td><strong>SCDE approval</strong></td>{data.years.map((y) => <td key={y.label}>{content.projects[y.label]?.approval || "—"}</td>)}</tr>
          <tr><td><strong>Expenditure incurred</strong></td>{data.years.map((y) => <td key={y.label} className="n">{kes(sumRows(y.comparison.payments.infrastructure, "current") ?? 0)}</td>)}</tr>
          <tr><td><strong>Project status</strong></td>{data.years.map((y) => <td key={y.label}>{content.projects[y.label]?.status || "—"}</td>)}</tr>
        </tbody>
      </table>

      <h3>Procurement of instructional materials</h3>
      <p>The largest tuition account payments:</p>
      <table>
        <thead><tr><th>Year</th><th className="n">Amount (KES)</th><th>Payee</th><th>Cheque no.</th></tr></thead>
        <tbody>
          {data.years.flatMap((y) => y.procurement.map((m, i) => (
            <tr key={`${y.label}-${i}`}><td>{y.label}</td><td className="n">{formatKes(m.amount)}</td><td>{m.payee}</td><td className="mono">{m.chequeNo || "—"}</td></tr>
          )))}
        </tbody>
      </table>

      <h3>Bank statements entered in the books</h3>
      <table>
        <thead><tr><th>Year</th><th>Account</th><th className="n">Months with a statement balance</th></tr></thead>
        <tbody>
          {data.years.flatMap((y) => y.statements.map((s) => (
            <tr key={`${y.label}-${s.account}`}><td>{y.label}</td><td>{s.account}</td><td className="n">{s.entered} of {s.months}</td></tr>
          )))}
        </tbody>
      </table>

      <h3>Areas of weakness</h3>
      <Bullets text={content.weaknesses} empty="None recorded." />

      <h3>Report on effectiveness of internal control, risk management and governance</h3>
      <Bullets text={content.effectiveness} />

      <h2>7. Recommendation matrix</h2>
      <table>
        <thead><tr><th>#</th><th>Audit issue</th><th>Management comments</th><th>Who is responsible</th><th>Time frame</th></tr></thead>
        <tbody>
          {content.recommendations.length === 0 && <tr><td colSpan={5} className="note">None recorded.</td></tr>}
          {content.recommendations.map((r, i) => (
            <tr key={i}><td>{i + 1}.</td><td>{r.issue}</td><td>{r.comments}</td><td>{r.who}</td><td>{r.timeframe}</td></tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: "1.5rem" }}>This report has been discussed and agreed with the management, and follow-up will be done at an appropriate time.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2.5rem", marginTop: "2.5rem" }}>
        <div>
          ....................................................<br />
          <strong>{data.auditor}</strong><br />Schools Auditor
          <div className="note" style={{ marginTop: ".5rem" }}>Official stamp</div>
        </div>
        <div>Date {issuedAt ? issuedAt.toLocaleDateString("en-KE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "...................................."}</div>
      </div>

      {data.years.some((y) => y.notSent.length > 0) && (
        <p className="note" style={{ marginTop: "1.5rem" }}>
          {data.years.filter((y) => y.notSent.length).map((y) =>
            `${y.label}: ${y.notSent.join(", ")} not sent for audit, and left out of the figures.`).join(" ")}
        </p>
      )}

      {data.years.map((y) => (
        <div key={y.label} style={{ breakBefore: "page", marginTop: "3rem" }}>
          <Statements school={data.school} year={y} />
        </div>
      ))}
    </article>
  );
}
