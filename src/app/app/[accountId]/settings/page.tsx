import { financialYearInProgress, financialYearLabels } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getTxns } from "@/server/queries";
import { FinancialYearForm } from "./form";
import { ArchiveForm } from "./archive-form";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const { fy, school, account } = await loadBook(accountId);
  const entries = (await getTxns(fy.id)).length;

  // The year the book is on may be older than the list a new book is offered,
  // so it is always included — otherwise the form would show the wrong one.
  const offered = financialYearLabels(financialYearInProgress(), 2022);
  const years = offered.includes(fy.label)
    ? offered
    : [...offered, fy.label].sort().reverse();

  return (
    <>
      <h1>Book settings</h1>
      <p className="sub">
        {school.name} — {account.name}, FY {fy.label}.
      </p>

      <h2>Financial year</h2>
      <FinancialYearForm
        accountId={accountId}
        current={fy.label}
        years={years}
        entries={entries}
      />

      <h2>Archive this book</h2>
      <ArchiveForm accountId={accountId} schoolName={school.name} entries={entries} />
    </>
  );
}
