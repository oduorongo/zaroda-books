import { notFound } from "next/navigation";
import { can } from "@/domain";
import { loadBook } from "@/server/book-context";
import { issuedReportsOn, parseClearance, parseContent, parsePrimary } from "@/server/audit-reports";
import { PrimaryStatements } from "../../../../audit/primary-statements";
import type { IpsasData } from "@/server/audit-reports";
import { ClearanceMemo } from "../../../../audit/clearance-memo";
import { IpsasReport } from "../../../../audit/ipsas-report";
import { BackLink } from "../../../back-link";
import { PrintButton } from "../../print-button";

/** An issued audit report on this school, as the auditor issued it. */
export default async function SchoolAuditReportPage({ params }: {
  params: Promise<{ accountId: string; reportId: string }>;
}) {
  const { accountId, reportId } = await params;
  const { user, school } = await loadBook(accountId);
  if (!can(user.role, "book.sendForAudit")) notFound();
  const report = (await issuedReportsOn(school.id)).find((r) => r.id === reportId);
  if (!report?.snapshot) notFound();

  return (
    <>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <BackLink />
        <PrintButton />
      </div>
      {report.kind === "clearance" ? (
        <ClearanceMemo data={JSON.parse(report.snapshot)} memo={parseClearance(report.content)}
          periodTo={report.periodTo} issuedAt={report.issuedAt} />
      ) : report.kind === "primary" ? (
        <PrimaryStatements data={JSON.parse(report.snapshot)} content={parsePrimary(report.content)} issuedAt={report.issuedAt} />
      ) : (
        <IpsasReport data={JSON.parse(report.snapshot) as IpsasData} content={parseContent(report.content)} issuedAt={report.issuedAt} />
      )}
    </>
  );
}
