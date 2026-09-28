import { openBankStatement } from "@/server/documents";

export async function GET(_req: Request, { params }: { params: Promise<{ accountId: string; statementId: string }> }) {
  const { accountId, statementId } = await params;
  try {
    return await openBankStatement(accountId, statementId);
  } catch {
    return new Response("Not found.", { status: 404 });
  }
}
