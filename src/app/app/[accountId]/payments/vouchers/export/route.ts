import { voucherBookDocs } from "@/server/reports";

export async function GET(_request: Request, { params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  return Response.json(await voucherBookDocs(accountId));
}
