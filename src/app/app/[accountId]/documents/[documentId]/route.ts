import { openPaymentDocument } from "@/server/documents";

export async function GET(_req: Request, { params }: { params: Promise<{ accountId: string; documentId: string }> }) {
  const { accountId, documentId } = await params;
  try {
    return await openPaymentDocument(accountId, documentId);
  } catch {
    return new Response("Not found.", { status: 404 });
  }
}
