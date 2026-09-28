import { openProjectLetter } from "@/server/documents";

export async function GET(_req: Request, { params }: { params: Promise<{ accountId: string; letterId: string }> }) {
  const { accountId, letterId } = await params;
  try {
    return await openProjectLetter(accountId, letterId);
  } catch {
    return new Response("Not found.", { status: 404 });
  }
}
