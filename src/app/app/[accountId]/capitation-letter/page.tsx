import {
  TERMS, can, formatKes, maskAccountNo, termRoman,
} from "@/domain";
import {
  letterBooks, letterDetailsFor, letterFor, loadLetterBook, parseLetterChoice,
} from "@/server/capitation-letter";
import { BackLink } from "../../back-link";
import { LetterDetailsForm } from "./details-form";
import { LetterPdfButton } from "./letter-pdf-button";

export default async function CapitationLetterPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { accountId } = await params;
  const { user, school } = await loadLetterBook(accountId);

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    for (const x of [v ?? []].flat()) query.append(k, x);
  }
  const choice = parseLetterChoice(query);

  const [books, details] = await Promise.all([
    letterBooks(school.id, school.level),
    letterDetailsFor(school),
  ]);
  const prepared = choice ? await letterFor(accountId, choice) : null;
  const letter = prepared?.letter;
  const exportHref = `/app/${accountId}/capitation-letter/export?${query.toString()}`;

  const today = new Date().toISOString().slice(0, 10);
  const ticked = new Set(choice?.receiptIds ?? []);

  return (
    <div style={{ maxWidth: 820 }}>
      <div className="no-print" style={{ marginBottom: ".75rem" }}>
        <BackLink />
      </div>

      <div className="no-print">
        <h1>Capitation letter</h1>
        <p className="sub">
          {school.name}. The letter to the Principal Secretary confirming the capitation received
          for a term. Tick the receipts it covers; the amounts and total are taken from them.
        </p>

        <details className="card" style={{ marginBottom: "1.35rem" }} open={!details.postalAddress}>
          <summary style={{ cursor: "pointer", fontWeight: 500 }}>
            Letter details — addresses, signatory and bank accounts
          </summary>
          <div style={{ marginTop: "1rem" }}>
            <LetterDetailsForm
              accountId={accountId}
              details={details}
              locked={!can(user.role, "letter.edit")}
              books={books.map(({ account }) => ({
                id: account.id,
                name: account.name,
                number: account.bankAccountNo ?? "",
                bankName: account.bankName ?? "",
                bankBranch: account.bankBranch ?? "",
              }))}
            />
          </div>
        </details>

        <form method="get" className="card stack" style={{ marginBottom: "1.35rem" }}>
          <div className="grid-2">
            <label className="field">Term
              <select name="term" defaultValue={choice?.term ?? ""} required>
                <option value="" disabled>Choose…</option>
                {TERMS.map((t) => <option key={t} value={t}>Term {termRoman(t)}</option>)}
              </select>
            </label>
            <label className="field">Year
              <input name="year" type="number" min={2000} max={2100} defaultValue={choice?.year ?? today.slice(0, 4)} required />
            </label>
            <label className="field">Date of the letter
              <input name="date" type="date" defaultValue={choice?.date ?? today} required />
            </label>
          </div>

          {books.map(({ account, fy, receipts }) => (
            <fieldset key={account.id} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="eyebrow">{account.name} · FY {fy.label}</legend>
              {receipts.length === 0 && <p className="note">No receipts posted in this book.</p>}
              {receipts.map((r) => (
                <label key={r.id} style={{ display: "flex", gap: ".6rem", alignItems: "baseline", padding: ".3rem 0" }}>
                  <input type="checkbox" name="r" value={r.id} defaultChecked={ticked.has(r.id)} />
                  <span style={{ flex: 1 }}>
                    {r.date} · {r.particulars}{r.receiptNo ? ` · ${r.receiptNo}` : ""}
                  </span>
                  <span className="mono">{formatKes(r.cash + r.bank)}</span>
                </label>
              ))}
            </fieldset>
          ))}

          <button type="submit" className="btn btn-primary">Prepare letter</button>
          {query.size > 0 && !choice && (
            <p className="error">Choose the term, the year, the date and at least one receipt.</p>
          )}
        </form>
      </div>

      {letter && (
        <>
          <div className="report-actions no-print" style={{ marginBottom: "1rem" }}>
            <LetterPdfButton href={exportHref} />
            <a className="btn btn-quiet" href={exportHref} download>Download Word</a>
          </div>

          <div className="card" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "12pt", lineHeight: 1.5 }}>
            <div style={{ textAlign: "right" }}>
              {letter.sender.map((l) => <div key={l}>{l}</div>)}
              <div style={{ marginTop: "1em" }}>{letter.date}</div>
            </div>

            <div style={{ marginTop: "1em" }}>TO</div>
            {letter.addressee.map((l) => <div key={l}>{l}</div>)}

            <div style={{ marginTop: "1em" }}>THRO&apos;</div>
            {letter.through.map((l) => <div key={l}>{l}</div>)}

            <p>Dear Sir / Madam,</p>
            <p style={{ fontWeight: 700, textDecoration: "underline" }}>{letter.subject}</p>
            <p>{letter.opening}</p>

            <table>
              <thead>
                <tr>
                  <th>ACCOUNT NAME</th><th>ACCOUNT NO.</th>
                  {letter.showBankColumn && <th>BANK</th>}
                  <th className="n">AMOUNT (KSh)</th>
                </tr>
              </thead>
              <tbody>
                {letter.rows.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    {/* Masked on screen; the PDF and Word files print it in full. */}
                    <td className="mono">{maskAccountNo(r.number) || "—"}</td>
                    {letter.showBankColumn && <td>{r.bank}</td>}
                    <td className="n">{r.amount}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>TOTAL</td><td />
                  {letter.showBankColumn && <td />}
                  <td className="n">{letter.total}</td>
                </tr>
              </tbody>
            </table>

            <p>{letter.bankLine}</p>
            <p>Thank you in advance.</p>
            <p>Yours faithfully,</p>
            <div style={{ height: "4.5em" }} />
            {letter.signature.map((l) => <div key={l}>{l}</div>)}
          </div>
        </>
      )}
    </div>
  );
}
