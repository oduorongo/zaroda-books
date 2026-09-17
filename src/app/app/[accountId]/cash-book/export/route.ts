import { csvResponse, docToCsv, reportDoc } from "@/server/reports";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await params;
  const url = new URL(request.url);
  const doc = await reportDoc(accountId, "cash-book", url.searchParams.get("month") ?? undefined);
  // The PDF is drawn in the browser from this same document.
  if (url.searchParams.get("format") === "json") return Response.json(doc);
  return csvResponse(docToCsv(doc));
}
