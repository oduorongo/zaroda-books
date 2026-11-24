import { voucherBookDocs } from "@/server/reports";

const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export async function GET(request: Request, { params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const q = new URL(request.url).searchParams;
  const ids = q.get("ids")?.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 500);
  return Response.json(await voucherBookDocs(accountId, { ids, from: day(q.get("from")), to: day(q.get("to")) }));
}
