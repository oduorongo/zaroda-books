import {
  can, maskAccountNo, receiptTerm,
} from "@/domain";
import {
  letterBooks, letterDetailsFor, letterFor, loadLetterBook, parseLetterChoice,
} from "@/server/capitation-letter";
import { BackLink } from "../../back-link";
import { LetterDetailsForm } from "./details-form";
import { LetterPdfButton } from "./letter-pdf-button";
import { ChooseLetterForm } from "./choose-form";

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

  return (
    <div style={{ maxWidth: 820 }}>
      <div className="no-print" style={{ marginBottom: ".75rem" }}>
        <BackLink />
      </div>

      <div className="no-print">
        <h1>Capitation letter</h1>
        <p className="sub">
          {school.name}. The letter to the Principal Secretary confirming the capitation received
          for a term. One letter covers all of the school's capitation accounts together. Tick the
          receipts it covers; each account's amount and the total are taken from them.
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

        <ChooseLetterForm
          // A new choice from the address starts the form afresh.
          key={query.toString()}
          books={books.map(({ account, fy, receipts }) => ({
            id: account.id,
            name: account.name,
            fyLabel: fy.label,
            receipts: receipts.map((r) => {
              const read = receiptTerm(r);
              return {
                id: r.id, date: r.date, particulars: r.particulars, receiptNo: r.receiptNo,
                amount: r.cash + r.bank, term: read?.term ?? null, year: read?.year ?? null,
              };
            }),
          }))}
          initial={{
            term: choice ? String(choice.term) : (query.get("term") ?? ""),
            year: choice ? String(choice.year) : (query.get("year") ?? today.slice(0, 4)),
            date: choice?.date ?? today,
            ticked: choice?.receiptIds ?? [],
          }}
          invalid={query.size > 0 && !choice}
        />
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
