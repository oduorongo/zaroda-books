import { formatKes, type Cents, type IpsasLine, type PeriodStatement } from "@/domain";
import { BOOKS_CHECKLIST, type PrimaryAccountData, type PrimaryContent, type PrimaryData } from "@/server/audit-reports";
import { longDate } from "./clearance-memo";
import { SignOff } from "./ipsas-report";

/**
 * The audited financial statements of a primary school, one set per account,
 * for the period the auditor set. Signatures and stamps are left blank.
 */

const kes = (c: Cents | null) => (c === null ? "" : c === 0 ? "-" : c < 0 ? `(${formatKes(-c)})` : formatKes(c));

/** "2025" for a period inside one calendar year, "2025/26" across two. */
function label(from: string, to: string) {
  return from.slice(0, 4) === to.slice(0, 4) ? to.slice(0, 4) : `${from.slice(0, 4)}/${to.slice(2, 4)}`;
}

const paragraphs = (s: string) => s.split(/\n+/).map((p) => p.trim()).filter(Boolean);

/** Current and prior lines side by side, by vote head. */
function merge(current: IpsasLine[], prior: IpsasLine[] | null) {
  const rows = current.map((l) => ({ name: l.name, current: l.amount, prior: prior ? prior.find((p) => p.code === l.code)?.amount ?? 0 : null }));
  for (const p of prior ?? []) if (!current.some((l) => l.code === p.code)) rows.push({ name: p.name, current: 0, prior: p.amount });
  return rows;
}

const total = (s: PeriodStatement) => s.closing.cash + s.closing.bank;

function Heading({ school, title, account }: { school: string; title: string; account: string }) {
  return (
    <div style={{ textAlign: "center", marginBottom: "1rem" }}>
      <h2 style={{ marginBottom: ".3rem", textTransform: "uppercase" }}>{school}</h2>
      <div style={{ fontWeight: 600, textDecoration: "underline", textTransform: "uppercase" }}>{title}</div>
      <div style={{ fontWeight: 600, textDecoration: "underline", textTransform: "uppercase" }}>{account}</div>
    </div>
  );
}

function AccountStatements({ school, a, cur, pri }: { school: string; a: PrimaryAccountData; cur: string; pri: string }) {
  const c = a.current;
  const p = a.prior;
  const head = (title: string) => (
    <thead><tr><th>{title}</th><th className="n">{cur}<br />KES</th><th className="n">{pri}<br />KES</th></tr></thead>
  );

  return (
    <>
      <div style={{ breakBefore: "page", marginTop: "3rem" }}>
        <Heading school={school} title={`Statement of financial position as at ${longDate(c.to)}`} account={a.account} />
        <table>
          {head("Liabilities")}
          <tbody>
            <tr><td>Accumulated fund</td><td className="n">{kes(total(c))}</td><td className="n">{kes(p ? total(p) : null)}</td></tr>
            <tr className="total"><td /><td className="n">{kes(total(c))}</td><td className="n">{kes(p ? total(p) : null)}</td></tr>
          </tbody>
        </table>
        <table style={{ marginTop: "1rem" }}>
          {head("Assets")}
          <tbody>
            <tr><td>Cash and bank</td><td className="n">{kes(total(c))}</td><td className="n">{kes(p ? total(p) : null)}</td></tr>
            <tr className="total"><td /><td className="n">{kes(total(c))}</td><td className="n">{kes(p ? total(p) : null)}</td></tr>
          </tbody>
        </table>
        <SignOff lines={["Chairman (BOM)", "Head teacher / Secretary (BOM)"]} />
      </div>

      <div style={{ breakBefore: "page", marginTop: "3rem" }}>
        <Heading school={school} title={`Notes to the accounts as at ${longDate(c.to)}`} account={a.account} />
        <table>
          {head("Accumulated fund")}
          <tbody>
            <tr><td>Balance brought forward</td><td className="n">{kes(c.broughtForward.cash + c.broughtForward.bank)}</td><td className="n">{kes(p ? p.broughtForward.cash + p.broughtForward.bank : null)}</td></tr>
            <tr><td>Add: surplus / (deficit)</td><td className="n">{kes(c.surplus)}</td><td className="n">{kes(p?.surplus ?? null)}</td></tr>
            <tr className="total"><td /><td className="n">{kes(total(c))}</td><td className="n">{kes(p ? total(p) : null)}</td></tr>
          </tbody>
        </table>
        <table style={{ marginTop: "1rem" }}>
          {head("Cash and bank")}
          <tbody>
            <tr><td>Cash at bank</td><td className="n">{kes(c.closing.bank)}</td><td className="n">{kes(p?.closing.bank ?? null)}</td></tr>
            <tr><td>Cash at hand</td><td className="n">{kes(c.closing.cash)}</td><td className="n">{kes(p?.closing.cash ?? null)}</td></tr>
            <tr className="total"><td /><td className="n">{kes(total(c))}</td><td className="n">{kes(p ? total(p) : null)}</td></tr>
          </tbody>
        </table>
        {c.carriedDifference !== 0 && (
          <p className="error">
            A later year&apos;s opening balance in this book was not carried forward: the books differ by{" "}
            {formatKes(Math.abs(c.carriedDifference))} from the cash and bank worked through the period.
          </p>
        )}
      </div>

      <div style={{ breakBefore: "page", marginTop: "3rem" }}>
        <Heading school={school} title={`Income and expenditure account for the period ending ${longDate(c.to)}`} account={a.account} />
        <table>
          {head("Income")}
          <tbody>
            {merge(c.income, p?.income ?? null).map((r) => (
              <tr key={r.name}><td>{r.name}</td><td className="n">{kes(r.current)}</td><td className="n">{kes(r.prior)}</td></tr>
            ))}
            <tr className="total"><td>Total</td><td className="n">{kes(c.totalIncome)}</td><td className="n">{kes(p?.totalIncome ?? null)}</td></tr>
          </tbody>
        </table>
        <table style={{ marginTop: "1rem" }}>
          {head("Expenditure")}
          <tbody>
            {merge(c.expenditure, p?.expenditure ?? null).map((r) => (
              <tr key={r.name}><td>{r.name}</td><td className="n">{kes(r.current)}</td><td className="n">{kes(r.prior)}</td></tr>
            ))}
            <tr className="total"><td>Total expenditure</td><td className="n">{kes(c.totalExpenditure)}</td><td className="n">{kes(p?.totalExpenditure ?? null)}</td></tr>
            <tr className="total"><td>Surplus / (deficit)</td><td className="n">{kes(c.surplus)}</td><td className="n">{kes(p?.surplus ?? null)}</td></tr>
            <tr className="total"><td>Total</td><td className="n">{kes(c.totalIncome)}</td><td className="n">{kes(p?.totalIncome ?? null)}</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

export function PrimaryStatements({ data, content, issuedAt }: {
  data: PrimaryData; content: PrimaryContent; issuedAt: Date | null;
}) {
  const cur = label(data.from, data.to);
  const pri = label(data.priorFrom, data.priorTo);
  const place = [data.subCounty && `${data.subCounty} sub-county`, data.county && `${data.county} county`].filter(Boolean).join(", ");
  const uncovered = data.accounts.filter((a) => !a.current.complete);
  const tuition = data.accounts.find((a) => a.type === "TUITION")?.account ?? "Tuition account";
  const operations = data.accounts.find((a) => a.type === "OPERATIONS")?.account ?? "Operations account";
  const dated = issuedAt ? longDate(issuedAt) : "....................................";
  const signature = (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2.5rem", marginTop: "2.5rem" }}>
      <div>
        ....................................................<br />
        <strong>{data.auditor}</strong><br />Schools Auditor
        <div className="note" style={{ marginTop: ".4rem" }}>Official stamp</div>
      </div>
      <div>Date {dated}</div>
    </div>
  );

  return (
    <article>
      <header style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <h1 style={{ textTransform: "uppercase" }}>{data.school}</h1>
        {place && <p style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>{place}</p>}
        <h2 style={{ marginTop: "2rem", textTransform: "uppercase" }}>
          Audited financial statements for the period ending {longDate(data.to)}
        </h2>
        {!issuedAt && <p className="error no-print">Draft. Figures are worked from the books each time this page opens.</p>}
        {uncovered.length > 0 && (
          <p className="error">
            The books do not cover the whole period from {longDate(data.from)} to {longDate(data.to)} for{" "}
            {uncovered.map((a) => a.account).join(" and ")}. The statements cannot be issued for days the
            books do not hold; set a period inside the books.
          </p>
        )}
      </header>

      <section style={{ breakBefore: "page" }}>
        <h2 style={{ textAlign: "center", textTransform: "uppercase" }}>{data.school}</h2>
        <h3 style={{ textAlign: "center" }}>Audit certificate — {cur}</h3>
        {paragraphs(content.certificate).map((p, i) => <p key={i}>{p}</p>)}
        <p>
          In our opinion and subject to the audit report attached, proper books of account have been
          kept by the school and the financial statements, which are in agreement therewith, give a true
          and fair view of the state of affairs of <strong><em>{data.school}</em></strong> as
          at <strong>{longDate(data.to)}</strong>.
        </p>
        {signature}
      </section>

      <section style={{ breakBefore: "page", marginTop: "3rem" }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ marginBottom: ".2rem" }}>MINISTRY OF EDUCATION</h2>
          <div style={{ fontWeight: 600 }}>STATE DEPARTMENT FOR BASIC EDUCATION</div>
        </div>
        <table style={{ margin: "1.25rem 0" }}>
          <tbody>
            <tr><td><strong>Name of school:</strong> <em>{data.school}</em></td><td><strong>Zone:</strong> <em>{content.zone || "—"}</em></td></tr>
            <tr><td><strong>Name of head teacher:</strong> <em>{content.headTeacher || "—"}</em></td><td><strong>TSC no.:</strong> {content.tscNo || "—"}</td></tr>
          </tbody>
        </table>
        <h3 style={{ textAlign: "center", textDecoration: "underline" }}>
          Audit report for the period {longDate(data.from)} to {longDate(data.to)}
        </h3>
        <p>We made the following observations from the school&apos;s books of account and financial statements for the period.</p>

        <h3>1. Capitation grants</h3>
        <p>The school received grants as detailed below:</p>
        <table>
          <thead><tr><th>S/No.</th><th>Tranche</th><th className="n">{tuition}</th><th className="n">{operations}</th></tr></thead>
          <tbody>
            {data.grants.map((g, i) => (
              <tr key={i}><td>{i + 1}.</td><td>Tranche {i + 1}</td><td className="n">{g.tuition === null ? "nil" : formatKes(g.tuition)}</td><td className="n">{g.operations === null ? "nil" : formatKes(g.operations)}</td></tr>
            ))}
            <tr className="total">
              <td colSpan={2}>Total</td>
              <td className="n">{formatKes(data.grants.reduce((a, g) => a + (g.tuition ?? 0), 0))}</td>
              <td className="n">{formatKes(data.grants.reduce((a, g) => a + (g.operations ?? 0), 0))}</td>
            </tr>
          </tbody>
        </table>

        <h3>2. Procurement of instructional materials</h3>
        <p>The school spent a total of <strong>KES {formatKes(data.procurementTotal)}</strong> from the tuition account in the period.</p>
        {data.procurement.length > 0 && (
          <table>
            <thead><tr><th className="n">Amount (KES)</th><th>Supplier / payee</th><th>Cheque no.</th></tr></thead>
            <tbody>
              {data.procurement.map((m, i) => (
                <tr key={i}><td className="n">{formatKes(m.amount)}</td><td>{m.payee}</td><td className="mono">{m.chequeNo || "—"}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {paragraphs(content.procurement).length > 0 && (
          <><p>We made the following observations on procurement in the period:</p>
            <ul>{paragraphs(content.procurement).map((p, i) => <li key={i}>{p}</li>)}</ul></>
        )}

        <h3>3. Management of the general operations account</h3>
        {paragraphs(content.management).map((p, i) => <p key={i}>{p}</p>)}
        {!paragraphs(content.management).length && <p className="note">None recorded.</p>}

        <h3>4. Maintenance of books of account and financial statements</h3>
        <table>
          <thead><tr><th>S/No.</th><th>Item</th><th>Observation</th></tr></thead>
          <tbody>
            {BOOKS_CHECKLIST.map((item, i) => (
              <tr key={item}><td>{i + 1}.</td><td>{item}</td><td>{content.books[item] || "—"}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="note" style={{ marginTop: ".5rem" }}>
          Bank statement balances entered in the books:{" "}
          {data.accounts.map((a) => `${a.account} ${a.statements.entered} of ${a.statements.months} months`).join("; ")}.
        </p>
        {signature}
      </section>

      {data.accounts.map((a) => (
        <AccountStatements key={a.account} school={data.school} a={a} cur={cur} pri={pri} />
      ))}
    </article>
  );
}
