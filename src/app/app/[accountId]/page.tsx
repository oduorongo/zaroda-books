import { redirect } from "next/navigation";

/** Opening a book lands on where it stands. */
export default async function BookIndex({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  redirect(`/app/${accountId}/progress`);
}
