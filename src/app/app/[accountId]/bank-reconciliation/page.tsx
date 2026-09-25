import { bankEffect, can, formatKes, monthsToClose, monthsToReopen, toKes } from "@/domain";
import { nextFinancialYear, nextYearBook } from "@/server/books";
import { getReconciliation } from "@/server/reconciliation";
import { getTxns, upTo } from "@/server/queries";
import { loadBook } from "@/server/book-context";
import { monthName } from "@/server/periods";
import { BookTabs } from "../book-tabs";
import { MonthPicker } from "../month-picker";
import { ReportShell } from "../report-shell";
import { StatementForm } from "./statement-form";
import { ClearToggle } from "./clear-toggle";
import { CloseMonth } from "./close-month";

export default async function Page({ params, searchParams }: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { accountId } = await params;
  const { month: asked } = await searchParams;

  const {
    reconciliation: r, period, periods, month, school, account, fy, hasStatement, posted,
  } = await getReconciliation(accountId, asked);

  const { fy: book, user } = await loadBook(accountId);
  const txns = upTo(await getTxns(book.id), month).filter((t) => bankEffect(t) !== 0);
  // Closing June closes the year: point on to next year's book.
  const closed = period.status === "closed";
  const yearEnd = closed && month === book.endsOn.slice(0, 7);
  const nextLabel = nextFinancialYear(fy.label);
  const nextId = yearEnd ? await nextYearBook(school.id, account.type, fy.label) : null;
  const nextYear = !yearEnd ? null : nextId
    ? { label: nextLabel, href: `/app/${nextId}/receipts`, exists: true }
    : {
      label: nextLabel,
      exists: false,
      href: `/app/new?${new URLSearchParams({
        school: school.name, level: school.level, type: account.type, fy: nextLabel,
      })}`,
    };

  const outstanding = new Set([...r.uncredited, ...r.unpresented].map((i) => i.id));

  const Row = ({ label, amount, sign }: { label: string; amount: number; sign?: string }) => (
    <tr>
      <td>{label}</td>
      <td className="n">{sign}{formatKes(amount)}</td>
    </tr>
  );

  return (
    <ReportShell
      title="Bank reconciliation statement"
      sub={<>{monthName(period.month)} — {school.name}, {account.name} account</>}
      school={school.name} level={school.level} account={account.name} fyLabel={fy.label}
      period={monthName(period.month)}
      csvHref={`/app/${accountId}/bank-reconciliation/export?month=${month}`}
    >
      <BookTabs accountId={accountId} active="bank-reconciliation" />
      <MonthPicker accountId={accountId} report="bank-reconciliation" periods={periods} active={month} posted={posted} />

      <StatementForm
        accountId={accountId}
        periodId={period.id}
        statementBank={period.statementBank !== null ? String(toKes(period.statementBank)) : ""}
        statementDate={period.statementDate ?? ""}
      />

      {!hasStatement ? (
        <p className="note" style={{ marginTop: "1.5rem" }}>
          Enter the closing balance from the bank statement above. Until it is entered there is
          nothing to reconcile the book against.
        </p>
      ) : (
        <>
          <div className="card" style={{ maxWidth: 760, marginTop: "1.6rem" }}>
            <table>
              <tbody>
                <Row label="Balance per cash book — bank column" amount={r.perCashBook} />
                {r.uncredited.length > 0 && (
                  <tr className="carry">
                    <td>Less deposits not yet credited by the bank</td>
                    <td className="n">({formatKes(r.uncreditedTotal)})</td>
                  </tr>
                )}
                {r.unpresented.length > 0 && (
                  <Row label="Add cheques not yet presented" amount={r.unpresentedTotal} />
                )}
                <Row label="Balance the statement should show" amount={r.expectedStatement} />
                <Row label="Balance per bank statement" amount={r.statementBalance} />
                <tr className="total">
                  <td>Difference</td>
                  <td className="n">{formatKes(r.difference)}</td>
                </tr>
              </tbody>
            </table>

            {/* With nothing ticked, the statement is expected to still read the
                opening balance, and the difference means nothing yet. */}
            {txns.length > 0 && outstanding.size === txns.length && (
              <p className="note" style={{ marginTop: "1rem", color: "var(--alarm)" }}>
                No entry is ticked as shown yet, so all {txns.length} are treated as not on the
                statement. Tick them off below before reading the difference.
              </p>
            )}
            <p className={`verdict ${r.reconciled ? "ok" : "off"}`}>
              {r.reconciled
                ? "The book agrees with the statement. This month can be closed."
                : r.difference < 0
                  ? `The bank has taken ${formatKes(-r.difference)} that the book does not show. `
                    + "Read the entries off the statement — charges, standing orders — and post them."
                  : `The statement shows ${formatKes(r.difference)} that the book does not. `
                    + "Read the entries off the statement — interest, direct credits — and post them."}
            </p>

          </div>

          <h2>Tick each entry off against the statement</h2>
          <p className="note" style={{ marginTop: "-.75rem", marginBottom: "1.25rem" }}>
            Every entry starts as ☐ outstanding. Click it to mark it ☑ shown once you find it on the
            bank statement. Whatever is left outstanding is listed above as a deposit not yet
            credited or a cheque not yet presented — nothing is ticked on your behalf.
          </p>

          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Particulars</th><th>Ref</th>
                  <th className="n">Into bank</th><th className="n">Out of bank</th>
                  <th className="no-print">On the statement</th>
                </tr>
              </thead>
              <tbody>
                {txns.length === 0 && (
                  <tr><td colSpan={6} className="note">Nothing has gone through the bank this month.</td></tr>
                )}
                {txns.map((t) => {
                  const effect = bankEffect(t);
                  const isOut = outstanding.has(t.id);
                  return (
                    <tr key={t.id} className={isOut ? "carry" : undefined}>
                      <td className="mono" style={{ color: "var(--muted)" }}>{t.date}</td>
                      <td>{t.particulars}</td>
                      <td className="mono">
                        {(t.kind === "receipt" ? t.receiptNo : t.chequeNo) ?? "—"}
                      </td>
                      <td className="n">{effect > 0 ? formatKes(effect) : "—"}</td>
                      <td className="n">{effect < 0 ? formatKes(-effect) : "—"}</td>
                      <td className="no-print">
                        <ClearToggle
                          accountId={accountId}
                          transactionId={t.id}
                          cleared={!isOut}
                          defaultDate={t.date}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <CloseMonth
        accountId={accountId}
        month={period.month}
        monthName={monthName(period.month)}
        closed={closed}
        reconciled={hasStatement && r.reconciled}
        closes={(monthsToClose(periods, period.month).months ?? []).map(monthName)}
        reopens={(monthsToReopen(periods, period.month).months ?? []).map(monthName)}
        canClose={can(user.role, "period.close") && !user.readOnly}
        canReopen={can(user.role, "period.reopen") && !user.readOnly}
        nextYear={nextYear}
      />
    </ReportShell>
  );
}
