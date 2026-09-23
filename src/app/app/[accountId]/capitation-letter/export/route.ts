import { notFound } from "next/navigation";
import { letterFor, parseLetterChoice } from "@/server/capitation-letter";
import { letterDocx } from "@/server/letter-docx";

/** The letter with account numbers in full: ?format=json feeds the PDF button, anything else is the Word file. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await params;
  const query = new URL(request.url).searchParams;
  const choice = parseLetterChoice(query);
  if (!choice) notFound();

  const { letter, filename } = await letterFor(accountId, choice);
  if (query.get("format") === "json") return Response.json({ letter, filename });

  return new Response(await letterDocx(letter), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${filename}.docx"`,
    },
  });
}
