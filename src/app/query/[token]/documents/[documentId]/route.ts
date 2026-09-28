import { get } from "@vercel/blob";
import { queryDocumentForToken } from "@/server/audit-queries";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string; documentId: string }> }) {
  const { token, documentId } = await params;
  try {
    const doc = await queryDocumentForToken(token, documentId);
    const found = await get(doc.blobPath!, { access: "private" });
    if (!found || found.statusCode !== 200) throw new Error();
    return new Response(found.stream, {
      headers: { "Content-Type": found.blob.contentType, "Cache-Control": "private, no-store" },
    });
  } catch {
    return new Response("Not found.", { status: 404 });
  }
}
