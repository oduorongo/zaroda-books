import { csvResponse, docToCsv, reportDoc } from "@/server/reports";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await params;
  const url = new URL(request.url);
  const doc = await reportDoc(accountId, "bank-reconciliation", url.searchParams.get("month") ?? undefined);
  if (url.searchParams.get("format") === "json") return Response.json(doc);
  return csvResponse(docToCsv(doc));
}
