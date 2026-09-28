import { openDocumentForToken } from "@/server/documents";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string; documentId: string }> }) {
  const { token, documentId } = await params;
  try {
    return await openDocumentForToken(token, documentId);
  } catch {
    return new Response("Not found.", { status: 404 });
  }
}
