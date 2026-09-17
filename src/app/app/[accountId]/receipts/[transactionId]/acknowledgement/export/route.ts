import { acknowledgementDoc, csvResponse, docToCsv } from "@/server/reports";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ accountId: string; transactionId: string }> },
) {
  const { accountId, transactionId } = await params;
  const doc = await acknowledgementDoc(accountId, transactionId);
  if (new URL(request.url).searchParams.get("format") === "json") return Response.json(doc);
  return csvResponse(docToCsv(doc));
}
