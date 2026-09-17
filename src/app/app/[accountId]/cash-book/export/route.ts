import { csvResponse, reportCsv } from "@/server/reports";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await params;
  const month = new URL(request.url).searchParams.get("month") ?? undefined;
  return csvResponse(await reportCsv(accountId, "cash-book", month));
}
