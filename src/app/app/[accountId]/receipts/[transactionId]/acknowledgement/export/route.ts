import { acknowledgementCsv, csvResponse } from "@/server/reports";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ accountId: string; transactionId: string }> },
) {
  const { accountId, transactionId } = await params;
  return csvResponse(await acknowledgementCsv(accountId, transactionId));
}
