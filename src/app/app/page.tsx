import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { getOrgBooks } from "@/server/queries";
import { BookChooser } from "./book-chooser";

/**
 * Where login lands. No book opens by itself: opening the first on the list
 * sent a freelancer's receipts into whichever school sorted first.
 */
export default async function AppIndex() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const books = await getOrgBooks(user.orgId, user.bookScope);
  if (!books.length) redirect("/app/new");

  return (
    <div style={{ maxWidth: 820 }}>
      <h1>Choose a book</h1>
      <p className="sub">Open the school and year you are entering for.</p>
      <BookChooser
        books={books.map((b) => ({
          accountId: b.account.id,
          school: b.school.name,
          level: b.school.level,
          account: b.account.name,
          fyLabel: b.fyLabel ?? "",
        }))}
      />
    </div>
  );
}
