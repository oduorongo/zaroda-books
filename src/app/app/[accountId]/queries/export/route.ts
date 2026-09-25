import { QUERY_STATUS_LABEL } from "@/domain";
import { loadBook } from "@/server/book-context";
import { queriesForAccount } from "@/server/audit-queries";
import { csvResponse, docToCsv, type ReportDoc } from "@/server/reports";

export async function GET(request: Request, { params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { fy, school, account } = await loadBook(accountId);
  const queries = await queriesForAccount(accountId);

  const doc: ReportDoc = {
    title: "Audit queries",
    school: school.name,
    level: school.level,
    account: account.name,
    fyLabel: fy.label,
    period: `${queries.length} quer${queries.length === 1 ? "y" : "ies"}`,
    landscape: false,
    filename: `${school.name} ${account.name} ${fy.label} audit queries`.replace(/[^\w]+/g, "-").toLowerCase(),
    sections: queries.map((q) => ({
      heading: `${q.subject} — ${QUERY_STATUS_LABEL[q.status]}`,
      columns: ["Date", "From", "Message"],
      rows: q.messages.map((m) => [
        m.at.toISOString().slice(0, 10),
        `${m.fromAuditor ? "Auditor" : "School"}: ${m.name}`,
        m.body,
      ]),
    })),
  };
  if (new URL(request.url).searchParams.get("format") === "json") return Response.json(doc);
  return csvResponse(docToCsv(doc));
}
